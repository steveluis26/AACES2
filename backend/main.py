import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from contextlib import asynccontextmanager
import logging
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.api.v1.router import api_router
from app.services.security import security_service
from app.errors import DomainError, InvalidCredentialsError, AccountBlockedError, OrganizationPendingError, OrganizationSuspendedError, ResourceNotFoundError
from app.bootstrap.schema import ensure_schema
from app.bootstrap.indexes import ensure_indexes
from app.bootstrap.seed import ensure_seed_data
from app.bootstrap.version import ensure_schema_version
from app.bootstrap.health import check_schema_health


async def _job_recordatorios() -> None:
    """Envuelve el job diario con su propia sesión de BD."""
    from app.core.database import AsyncSessionLocal
    from app.services.recordatorios import ejecutar_recordatorios

    async with AsyncSessionLocal() as db:
        try:
            resumen = await ejecutar_recordatorios(db)
            logger.info("Job recordatorios OK: %s", resumen)
        except Exception:
            logger.exception("Job recordatorios falló")
            try:
                await db.rollback()
            except Exception:
                pass


def _iniciar_scheduler_recordatorios():
    """Programa el job diario 7:00 AM (America/Mexico_City) + catch-up al arranque.

    El job es idempotente (clave UNIQUE por aviso), así que el catch-up nunca
    duplica: solo genera los avisos que falten si el contenedor estuvo caído.
    """
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    from zoneinfo import ZoneInfo

    tz = ZoneInfo("America/Mexico_City")
    sched = AsyncIOScheduler(timezone=tz)
    sched.add_job(
        _job_recordatorios,
        CronTrigger(hour=7, minute=0, timezone=tz),
        id="recordatorios_diarios",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    sched.start()
    logger.info("Scheduler de recordatorios iniciado (diario 7:00 America/Mexico_City)")
    return sched

logger = logging.getLogger(__name__)

def setup_logging():
    logging.basicConfig(
        level=logging.INFO if not settings.DEBUG else logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    # Schema setup (errors are fatal)
    async with engine.connect() as conn:
        await conn.execute(text("SET search_path TO aaces"))
        await ensure_schema(conn)
        await conn.commit()
    async with engine.connect() as conn:
        await conn.execute(text("SET search_path TO aaces"))
        await ensure_indexes(conn)
        await conn.commit()
    # Seed data (errors are fatal - don't catch)
    async with engine.connect() as conn:
        await conn.execute(text("SET search_path TO aaces"))
        await ensure_seed_data(conn, security_service.hash_password)
        await conn.commit()
        logger.info("Seed data completed successfully")
    # Schema version/health (errors are fatal)
    async with engine.connect() as conn:
        await conn.execute(text("SET search_path TO aaces"))
        await ensure_schema_version(conn)
        await conn.commit()
    async with engine.connect() as conn:
        await conn.execute(text("SET search_path TO aaces"))
        health = await check_schema_health(conn)
        if health.status == "BROKEN":
            logger.error("Schema health BROKEN: missing %s", health.missing_tables)
            raise RuntimeError("Schema health BROKEN")
    # Recordatorios: scheduler diario + catch-up idempotente al arranque
    scheduler = _iniciar_scheduler_recordatorios()
    try:
        await _job_recordatorios()
    except Exception:
        logger.exception("Catch-up inicial de recordatorios falló")
    yield
    try:
        scheduler.shutdown(wait=False)
    except Exception as e:
        logger.warning(f"Error deteniendo scheduler: {e}")
    try:
        await engine.dispose()
    except Exception as e:
        logger.warning(f"Error disposing database engine: {e}")

app = FastAPI(
    title="AACES API",
    description="Sistema de Gestión de Capacitaciones y Certificaciones",
    version="1.0.0",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    openapi_url="/api/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Page", "X-Per-Page"]
)

# Serve uploaded files
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Documentos generados: ahora viven en la base (el disco de Render no persiste).
# Las ligas viejas /storage/... se redirigen a /api/v1/archivos/...
@app.get("/storage/{clave:path}", include_in_schema=False)
async def storage_legacy(clave: str):
    return RedirectResponse(url=f"/api/v1/archivos/{clave}", status_code=301)

# Include API router
app.include_router(api_router, prefix="/api/v1")

# Domain error handler (ADR-018)
DOMAIN_STATUS_MAP = {
    InvalidCredentialsError: 401,
    AccountBlockedError: 423,
    OrganizationPendingError: 403,
    OrganizationSuspendedError: 403,
    ResourceNotFoundError: 404,
}

@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError):
    status_code = 400
    for exc_type, http_status in DOMAIN_STATUS_MAP.items():
        if isinstance(exc, exc_type):
            status_code = http_status
            break
    return JSONResponse(
        status_code=status_code,
        content={"detail": str(exc)},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    # Los 500 silenciosos son imposibles de diagnosticar sin el traceback.
    # Se registra el error completo en el log y se devuelve un 500 genérico.
    logger.exception("Error no controlado en %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "AACES - Sistema de Gestión de Capacitaciones y Certificaciones",
        "version": "1.0.0",
        "docs": "/api/docs" if settings.DEBUG else None,
        "health": "healthy"
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": "2024-01-01T00:00:00Z"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info" if not settings.DEBUG else "debug"
    )
