import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
        async with engine.begin() as conn:
            await conn.execute(text("SET search_path TO aaces"))
            # Extensions
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\""))
            except Exception:
                pass
            # tipos_curso table and index
            try:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS tipos_curso (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                      nombre VARCHAR(200) NOT NULL,
                      descripcion TEXT,
                      costo_por_persona NUMERIC(10,2) DEFAULT 0,
                      estado VARCHAR(20) DEFAULT 'activo',
                      fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                await conn.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_curso_cliente_nombre ON tipos_curso (cliente_id, nombre)"
                ))
                await conn.execute(text("""
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
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS grupo_curso_items (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      grupo_id UUID NOT NULL REFERENCES grupos_curso(id) ON DELETE CASCADE,
                      tipo_curso_id UUID NOT NULL REFERENCES tipos_curso(id) ON DELETE CASCADE,
                      UNIQUE(grupo_id, tipo_curso_id)
                    )
                """))
            except Exception:
                pass
            # Contactos table
            try:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS aaces.contactos (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      nombre VARCHAR(200) NOT NULL,
                      email VARCHAR(255) NOT NULL,
                      empresa VARCHAR(200),
                      asunto VARCHAR(50) NOT NULL,
                      mensaje TEXT NOT NULL,
                      leido BOOLEAN DEFAULT false,
                      respondido BOOLEAN DEFAULT false,
                      fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                      fecha_leido TIMESTAMP WITH TIME ZONE,
                      notas_admin TEXT
                    )
                """))
            except Exception:
                pass
            # New schema tables: planes, organizaciones, usuarios, suscripciones, registro_intentos
            try:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS aaces.planes (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      codigo VARCHAR(50) UNIQUE NOT NULL,
                      nombre VARCHAR(100) NOT NULL,
                      descripcion TEXT,
                      precio_mensual NUMERIC(10,2) DEFAULT 0,
                      precio_anual NUMERIC(10,2) DEFAULT 0,
                      cursos_max INTEGER DEFAULT 10,
                      usuarios_max INTEGER DEFAULT 1,
                      constancias_max INTEGER DEFAULT 50,
                      incluye_marketplace BOOLEAN DEFAULT false,
                      incluye_api BOOLEAN DEFAULT false,
                      incluye_white_label BOOLEAN DEFAULT false,
                      incluye_soporte_prioritario BOOLEAN DEFAULT false,
                      activo BOOLEAN DEFAULT true,
                      fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                await conn.execute(text("ALTER TABLE aaces.planes ALTER COLUMN id SET DEFAULT gen_random_uuid()"))
                await conn.execute(text("ALTER TABLE aaces.planes ALTER COLUMN activo SET DEFAULT true"))
                await conn.execute(text("ALTER TABLE aaces.organizaciones ALTER COLUMN id SET DEFAULT gen_random_uuid()"))
                await conn.execute(text("ALTER TABLE aaces.usuarios ALTER COLUMN id SET DEFAULT gen_random_uuid()"))
                await conn.execute(text("ALTER TABLE aaces.suscripciones ALTER COLUMN id SET DEFAULT gen_random_uuid()"))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS aaces.organizaciones (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      rfc VARCHAR(13) UNIQUE NOT NULL,
                      razon_social VARCHAR(200) NOT NULL,
                      nombre_comercial VARCHAR(200),
                      email_contacto VARCHAR(255),
                      telefono VARCHAR(20),
                      estado VARCHAR(100),
                      ciudad VARCHAR(100),
                      direccion TEXT,
                      estatus VARCHAR(30) DEFAULT 'pendiente' NOT NULL,
                      fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                      fecha_activacion TIMESTAMP WITH TIME ZONE,
                      fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                      notas_admin TEXT
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS aaces.usuarios (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
                      nombre VARCHAR(100) NOT NULL,
                      correo VARCHAR(255) NOT NULL,
                      password_hash VARCHAR(255) NOT NULL,
                      rol VARCHAR(30) DEFAULT 'admin' NOT NULL,
                      telefono VARCHAR(20),
                      activo BOOLEAN DEFAULT true,
                      ultimo_acceso TIMESTAMP WITH TIME ZONE,
                      intentos_fallidos INTEGER DEFAULT 0,
                      bloqueado_hasta TIMESTAMP WITH TIME ZONE,
                      must_change_password BOOLEAN DEFAULT false,
                      fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                      fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                      UNIQUE(organizacion_id, correo)
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS aaces.suscripciones (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
                      plan_id UUID NOT NULL REFERENCES planes(id),
                      estatus VARCHAR(30) DEFAULT 'pendiente' NOT NULL,
                      fecha_inicio DATE,
                      fecha_fin DATE,
                      cursos_max INTEGER,
                      usuarios_max INTEGER,
                      constancias_max INTEGER,
                      metodo_pago VARCHAR(50),
                      referencia_pago VARCHAR(100),
                      fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                      fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                      activada_por UUID
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS aaces.templates (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      organizacion_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
                      template_group_id UUID NOT NULL,
                      tipo_documento VARCHAR(30) NOT NULL,
                      version INTEGER NOT NULL,
                      nombre VARCHAR(200) NOT NULL,
                      activa BOOLEAN DEFAULT false,
                      recursos JSONB DEFAULT '{}',
                      config JSONB DEFAULT '{}',
                      html_template TEXT DEFAULT '',
                      fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                      creada_por UUID REFERENCES usuarios(id),
                      UNIQUE(organizacion_id, template_group_id, version),
                      CONSTRAINT check_tipo_documento CHECK (tipo_documento IN ('CONSTANCIA', 'DC3', 'DIPLOMA', 'CREDENCIAL', 'OTRO'))
                    )
                """))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_templates_org_tipo ON aaces.templates (organizacion_id, tipo_documento)"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_templates_org_activa ON aaces.templates (organizacion_id, activa)"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_templates_group_id ON aaces.templates (template_group_id)"))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS aaces.registro_intentos (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      rfc VARCHAR(13),
                      correo VARCHAR(255),
                      ip_origen VARCHAR(45),
                      user_agent TEXT,
                      resultado VARCHAR(20),
                      detalle TEXT,
                      fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS aaces.documentos_emitidos (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
                      template_id UUID REFERENCES aaces.templates(id) ON DELETE SET NULL,
                      template_version INTEGER,
                      tipo_documento VARCHAR(30) NOT NULL,
                      codigo_validacion UUID NOT NULL DEFAULT gen_random_uuid(),
                      storage_provider VARCHAR(50) NOT NULL,
                      storage_key VARCHAR(500) NOT NULL,
                      pdf_hash VARCHAR(64) NOT NULL,
                      html_snapshot TEXT,
                       documento_metadata JSONB DEFAULT '{}',
                      emitido_por UUID REFERENCES aaces.usuarios(id) ON DELETE SET NULL,
                      fecha_emision TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                      estatus VARCHAR(20) DEFAULT 'emitido' NOT NULL,
                      CONSTRAINT check_tipo_documento_emitido CHECK (tipo_documento IN ('CONSTANCIA', 'DC3', 'DIPLOMA', 'CREDENCIAL', 'OTRO')),
                      CONSTRAINT check_estatus_documento CHECK (estatus IN ('emitido', 'cancelado', 'reemitido'))
                    )
                """))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_docs_org_tipo ON aaces.documentos_emitidos (organizacion_id, tipo_documento)"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_docs_validacion ON aaces.documentos_emitidos (codigo_validacion)"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_docs_emision ON aaces.documentos_emitidos (fecha_emision)"))
            except Exception as e:
                logger.warning(f"Failed to create new schema tables: {e}")
            # Fix existing rows where activo is NULL (from previous schema without DEFAULT)
            try:
                await conn.execute(text("UPDATE aaces.planes SET activo = true WHERE activo IS NULL"))
            except Exception:
                pass
            # Fix usuarios.activo y suscripciones (mismo problema de DEFAULT faltante)
            try:
                await conn.execute(text("ALTER TABLE aaces.usuarios ALTER COLUMN activo SET DEFAULT true"))
                await conn.execute(text("UPDATE aaces.usuarios SET activo = true WHERE activo IS NULL"))
                await conn.execute(text("ALTER TABLE aaces.suscripciones ALTER COLUMN estatus SET DEFAULT 'pendiente'"))
            except Exception:
                pass
            # Seed default plans
            try:
                res = await conn.execute(text("SELECT COUNT(*) FROM aaces.planes"))
                if int(res.scalar() or 0) == 0:
                    await conn.execute(
                        text("""
                            INSERT INTO aaces.planes (id, codigo, nombre, descripcion, precio_mensual, cursos_max, usuarios_max, constancias_max, incluye_soporte_prioritario, activo)
                            VALUES (gen_random_uuid(), 'trial', 'Prueba', 'Plan gratuito para probar la plataforma', 0, 10, 1, 50, false, true)
                        """)
                    )
                    await conn.execute(
                        text("""
                            INSERT INTO aaces.planes (id, codigo, nombre, descripcion, precio_mensual, cursos_max, usuarios_max, constancias_max, incluye_soporte_prioritario, activo)
                            VALUES (gen_random_uuid(), 'profesional', 'Profesional', 'Plan ideal para capacitadoras en crecimiento', 399, 999999, 3, 500, true, true)
                        """)
                    )
                    await conn.execute(
                        text("""
                            INSERT INTO aaces.planes (id, codigo, nombre, descripcion, precio_mensual, cursos_max, usuarios_max, constancias_max, incluye_marketplace, incluye_api, incluye_white_label, incluye_soporte_prioritario, activo)
                            VALUES (gen_random_uuid(), 'empresa', 'Empresa', 'Solución completa para grandes organizaciones', 799, 999999, 999999, 999999, true, true, true, true, true)
                        """)
                    )
                    logger.info("Default plans seeded successfully")
            except Exception as e:
                logger.warning(f"Failed to seed plans: {e}")
            # Add organizacion_id to clientes for migration linking
            try:
                await conn.execute(text("ALTER TABLE IF EXISTS aaces.clientes ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES aaces.organizaciones(id) ON DELETE SET NULL"))
            except Exception:
                pass
            # Ensure subcursos relation
            try:
                await conn.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS curso_padre_id UUID REFERENCES cursos(id) ON DELETE CASCADE"))
                await conn.execute(text("ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES grupos_curso(id) ON DELETE SET NULL"))
            except Exception:
                pass
            
            # Optional pricing columns in curso_participante
            try:
                await conn.execute(text("ALTER TABLE IF EXISTS curso_participante ADD COLUMN IF NOT EXISTS costo_asignado NUMERIC(10,2) DEFAULT 0"))
                await conn.execute(text("ALTER TABLE IF EXISTS curso_participante ADD COLUMN IF NOT EXISTS descuento NUMERIC(10,2) DEFAULT 0"))
            except Exception:
                pass
            # Vigencia columns for clientes
            try:
                await conn.execute(text("ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS vigencia_desde DATE"))
                await conn.execute(text("ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS vigencia_hasta DATE"))
                await conn.execute(text("ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false"))
            except Exception:
                pass
            # Default gen_random_uuid for clientes.id (legacy table)
            try:
                await conn.execute(text("ALTER TABLE aaces.clientes ALTER COLUMN id SET DEFAULT gen_random_uuid()"))
            except Exception:
                pass
            # Widen codigo_validacion in curso_participante for UUID v4 (36 chars)
            try:
                await conn.execute(text("ALTER TABLE aaces.curso_participante ALTER COLUMN codigo_validacion TYPE VARCHAR(36)"))
            except Exception:
                pass
            # Seed admin if empty
            try:
                res = await conn.execute(text("SELECT COUNT(*) FROM clientes"))
                count = int(res.scalar() or 0)
                if count == 0:
                    logger.info("No users found, seeding admin...")
                    ph = security_service.hash_password("admin123")
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

# Serve uploaded files
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Serve generated documents
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
app.mount("/storage", StaticFiles(directory=settings.STORAGE_DIR), name="storage")

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
