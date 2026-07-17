import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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

logger = logging.getLogger(__name__)

def setup_logging():
    logging.basicConfig(
        level=logging.INFO if not settings.DEBUG else logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SET search_path TO aaces"))
            await ensure_schema(conn)
            await conn.commit()
        async with engine.connect() as conn:
            await conn.execute(text("SET search_path TO aaces"))
            await ensure_indexes(conn)
            await conn.commit()
        async with engine.connect() as conn:
            await conn.execute(text("SET search_path TO aaces"))
            await ensure_seed_data(conn, security_service.hash_password)
            await conn.commit()
        async with engine.connect() as conn:
            await conn.execute(text("SET search_path TO aaces"))
            await ensure_schema_version(conn)
            await conn.commit()
        async with engine.connect() as conn:
            await conn.execute(text("SET search_path TO aaces"))
            health = await check_schema_health(conn)
            if health.status == "BROKEN":
                logger.error("Schema health BROKEN: missing %s", health.missing_tables)
    except Exception as e:
        logger.warning(f"Could not connect to database: {e}")
        logger.info("Application starting without database connection")
    yield
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

# Serve generated documents
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
app.mount("/storage", StaticFiles(directory=settings.STORAGE_DIR), name="storage")

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
