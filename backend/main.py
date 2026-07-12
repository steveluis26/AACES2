from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from sqlalchemy import text
import uuid

from app.core.config import settings
from app.core.database import engine
from app.api.v1.router import api_router
from app.services.security import security_service

logger = logging.getLogger(__name__)

def setup_logging():
    """Configure logging for the application."""
    logging.basicConfig(
        level=logging.INFO if not settings.DEBUG else logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    # Create tables if they don't exist
    try:
        from app.models import Base
        async with engine.begin() as conn:
            await conn.execute(text("CREATE SCHEMA IF NOT EXISTS aaces"))
            await conn.execute(text("SET search_path TO aaces"))
            await conn.run_sync(Base.metadata.create_all)
        async with engine.connect() as conn:
            await conn.execute(text("SET search_path TO aaces"))
            # Extensions
            try:
                async with conn.begin():
                    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
                    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\""))
            except Exception:
                pass
            # tipos_curso table and index
            try:
                async with conn.begin():
                    await conn.execute(text(
                        """
                        CREATE TABLE IF NOT EXISTS tipos_curso (
                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                          nombre VARCHAR(200) NOT NULL,
                          descripcion TEXT,
                          costo_por_persona NUMERIC(10,2) DEFAULT 0,
                          estado VARCHAR(20) DEFAULT 'activo',
                          fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        )
                        """
                    ))
                    await conn.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_curso_cliente_nombre ON tipos_curso (cliente_id, nombre)"
                    ))
                    await conn.execute(text(
                        """
                        CREATE TABLE IF NOT EXISTS grupos_curso (
                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                          nombre VARCHAR(200) NOT NULL,
                          descripcion TEXT,
                          precio_base NUMERIC(10,2) DEFAULT 0,
                          precio_promocional NUMERIC(10,2),
                          estado VARCHAR(20) DEFAULT 'activo',
                          fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                        )
                        """
                    ))
                    await conn.execute(text(
                        """
                        CREATE TABLE IF NOT EXISTS grupo_curso_items (
                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          grupo_id UUID NOT NULL REFERENCES grupos_curso(id) ON DELETE CASCADE,
                          tipo_curso_id UUID NOT NULL REFERENCES tipos_curso(id) ON DELETE CASCADE,
                          UNIQUE(grupo_id, tipo_curso_id)
                        )
                        """
                    ))
            except Exception:
                pass
            # Ensure subcursos relation
            try:
                async with conn.begin():
                    await conn.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS curso_padre_id UUID REFERENCES cursos(id) ON DELETE CASCADE"))
                    await conn.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES grupos_curso(id) ON DELETE SET NULL"))
            except Exception:
                pass
            
            # Optional pricing columns in curso_participante
            try:
                async with conn.begin():
                    await conn.execute(text("ALTER TABLE IF EXISTS curso_participante ADD COLUMN IF NOT EXISTS costo_asignado NUMERIC(10,2) DEFAULT 0"))
                    await conn.execute(text("ALTER TABLE IF EXISTS curso_participante ADD COLUMN IF NOT EXISTS descuento NUMERIC(10,2) DEFAULT 0"))
            except Exception:
                pass
            # Vigencia columns for clientes
            try:
                async with conn.begin():
                    await conn.execute(text("ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS vigencia_desde DATE"))
                    await conn.execute(text("ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS vigencia_hasta DATE"))
                    await conn.execute(text("ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false"))
                
            except Exception:
                pass
            # Seed admin if empty
            try:
                res = await conn.execute(text("SELECT COUNT(*) FROM clientes"))
                count = int(res.scalar() or 0)
                if count == 0:
                    logger.info("No users found, seeding admin...")
                    ph = security_service.hash_password("admin123")
                    async with conn.begin():
                        await conn.execute(
                            text(
                                "INSERT INTO clientes (id, nombre, correo, password_hash, categoria, estado, acepta_terminos, plan, cursos_max, cursos_creados, descuento_pct) VALUES (:id, :nombre, :correo, :ph, 'enterprise', 'activo', true, 'ilimitado', 999999, 0, 0)"
                            ),
                            {"id": str(uuid.uuid4()), "nombre": "Administrador", "correo": "admin@aaces.com", "ph": ph},
                        )
                    logger.info("Admin seeded successfully")
            except Exception as e:
                logger.warning(f"Failed to seed admin: {e}")
            logger.info("Database tables created successfully")
    except Exception as e:
        logger.warning(f"Could not connect to database: {e}")
        logger.info("Application starting without database connection")
    yield
    # Shutdown
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

# Include API router
app.include_router(api_router, prefix="/api/v1")

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
