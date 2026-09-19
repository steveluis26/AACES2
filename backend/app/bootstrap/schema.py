from __future__ import annotations
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)


async def create_aaces_schema(conn: AsyncConnection) -> None:
    await conn.execute(text("CREATE SCHEMA IF NOT EXISTS aaces"))
    await conn.execute(text("SET search_path TO aaces"))


async def create_extensions(conn: AsyncConnection) -> None:
    for ext in ["pgcrypto", "uuid-ossp"]:
        try:
            await conn.execute(text(f'CREATE EXTENSION IF NOT EXISTS "{ext}"'))
        except Exception:
            pass


async def create_metadata_tables(conn: AsyncConnection) -> None:
    from app.models import Base
    await conn.execute(text("SET search_path TO aaces"))
    await conn.run_sync(Base.metadata.create_all)


async def create_tipos_curso(conn: AsyncConnection) -> None:
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


async def create_grupos_curso(conn: AsyncConnection) -> None:
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


async def create_clientes(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.clientes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nombre VARCHAR(100) NOT NULL,
          correo VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          ciudad_base VARCHAR(100),
          categoria VARCHAR(20) NOT NULL DEFAULT 'basico',
          estado VARCHAR(20) NOT NULL DEFAULT 'activo',
          fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          fecha_cambio_categoria TIMESTAMP WITH TIME ZONE,
          ultimo_acceso TIMESTAMP WITH TIME ZONE,
          intentos_fallidos INTEGER DEFAULT 0,
          bloqueado_hasta TIMESTAMP WITH TIME ZONE,
          acepta_terminos BOOLEAN DEFAULT false,
          fecha_acepta_terminos TIMESTAMP WITH TIME ZONE,
          datos_procesados BOOLEAN DEFAULT true,
          fecha_eliminacion_logica TIMESTAMP WITH TIME ZONE,
          must_change_password BOOLEAN DEFAULT false,
          vigencia_desde DATE,
          vigencia_hasta DATE,
          plan VARCHAR(20) NOT NULL DEFAULT 'trial',
          cursos_creados INTEGER NOT NULL DEFAULT 0,
          cursos_max INTEGER NOT NULL DEFAULT 10,
          descuento_pct INTEGER NOT NULL DEFAULT 0,
          organizacion_id UUID REFERENCES aaces.organizaciones(id) ON DELETE SET NULL,
          CONSTRAINT check_categoria CHECK (categoria IN ('basico', 'premium', 'enterprise')),
          CONSTRAINT check_estado_cliente CHECK (estado IN ('activo', 'suspendido', 'eliminado'))
        )
    """))


async def create_contactos(conn: AsyncConnection) -> None:
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


async def create_planes(conn: AsyncConnection) -> None:
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


async def create_organizaciones(conn: AsyncConnection) -> None:
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
          notas_admin TEXT,
          stripe_customer_id VARCHAR(255)
        )
    """))
    await conn.execute(text("ALTER TABLE aaces.organizaciones ALTER COLUMN id SET DEFAULT gen_random_uuid()"))


async def create_usuarios_plataforma(conn: AsyncConnection) -> None:
    """Crear tabla usuarios_plataforma si no existe. Idempotente."""
    # Verificar si tabla ya existe
    result = await conn.execute(text("""
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'aaces' AND table_name = 'usuarios_plataforma'
    """))
    if result.scalar():
        logger.info("usuarios_plataforma ya existe, saltando creación")
        # Agregar columnas faltantes si no existen
        await conn.execute(text("""
            ALTER TABLE aaces.usuarios_plataforma 
            ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ
        """))
        return
    
    await conn.execute(text("""
        CREATE TABLE aaces.usuarios_plataforma (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            correo VARCHAR(255) UNIQUE NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            rol VARCHAR(30) DEFAULT 'super_admin' NOT NULL,
            activo BOOLEAN DEFAULT true NOT NULL,
            intentos_fallidos INTEGER DEFAULT 0,
            bloqueado_hasta TIMESTAMPTZ,
            ultimo_acceso TIMESTAMPTZ,
            fecha_creacion TIMESTAMPTZ DEFAULT now() NOT NULL,
            fecha_actualizacion TIMESTAMPTZ DEFAULT now() NOT NULL
        )
    """))
    await conn.execute(text("""
        ALTER TABLE aaces.usuarios_plataforma
        ADD CONSTRAINT check_rol_plataforma CHECK (rol IN ('super_admin'))
    """))
    await conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_usuarios_plataforma_correo ON aaces.usuarios_plataforma (correo)
    """))
    logger.info("usuarios_plataforma creada")


async def create_usuarios(conn: AsyncConnection) -> None:
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
    await conn.execute(text("ALTER TABLE aaces.usuarios ALTER COLUMN id SET DEFAULT gen_random_uuid()"))
    await conn.execute(text("ALTER TABLE aaces.usuarios ALTER COLUMN activo SET DEFAULT true"))


async def alter_usuarios_add_constraints(conn: AsyncConnection) -> None:
    """Agregar constraints a usuarios: CHECK rol, FK explícita. Idempotente."""
    await conn.execute(text("SET search_path TO aaces"))
    
    # 1. Verificar y agregar CHECK constraint para rol
    try:
        async with conn.begin_nested():
            await conn.execute(text("""
            ALTER TABLE aaces.usuarios 
            ADD CONSTRAINT check_rol_usuario CHECK (rol IN ('admin', 'staff'))
        """))
        logger.info("check_rol_usuario agregado a usuarios")
    except Exception as e:
        logger.info(f"check_rol_usuario ya existe en usuarios: {e}")
    
    # 2. Verificar y agregar FK explícita (nombre conocido)
    try:
        async with conn.begin_nested():
            await conn.execute(text("""
            ALTER TABLE aaces.usuarios 
            ADD CONSTRAINT fk_usuarios_organizacion 
            FOREIGN KEY (organizacion_id) REFERENCES aaces.organizaciones(id) ON DELETE CASCADE
        """))
        logger.info("fk_usuarios_organizacion agregada")
    except Exception as e:
        logger.info(f"fk_usuarios_organizacion ya existe: {e}")
    
    # 3. Asegurar organizacion_id NOT NULL (ya debería serlo por create_usuarios)
    result = await conn.execute(text("""
        SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = 'aaces' 
        AND table_name = 'usuarios' 
        AND column_name = 'organizacion_id'
    """))
    if result.scalar() == 'YES':
        # Verificar si hay NULLs antes de aplicar
        null_count = await conn.execute(text("SELECT count(*) FROM aaces.usuarios WHERE organizacion_id IS NULL"))
        if null_count.scalar() == 0:
            await conn.execute(text("ALTER TABLE aaces.usuarios ALTER COLUMN organizacion_id SET NOT NULL"))
            logger.info("organizacion_id SET NOT NULL en usuarios")
        else:
            logger.warning(f"Hay {null_count.scalar()} usuarios con organizacion_id=NULL, no se aplica NOT NULL")
    else:
        logger.info("organizacion_id ya es NOT NULL")


async def create_suscripciones(conn: AsyncConnection) -> None:
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
    await conn.execute(text("ALTER TABLE aaces.suscripciones ALTER COLUMN id SET DEFAULT gen_random_uuid()"))
    await conn.execute(text("ALTER TABLE aaces.suscripciones ALTER COLUMN estatus SET DEFAULT 'pendiente'"))


async def create_templates(conn: AsyncConnection) -> None:
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


async def create_registro_intentos(conn: AsyncConnection) -> None:
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


async def create_documentos_emitidos(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.documentos_emitidos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
          template_id UUID REFERENCES aaces.templates(id) ON DELETE SET NULL,
          template_version INTEGER,
          tipo_documento VARCHAR(30) NOT NULL,
          codigo_validacion UUID NOT NULL DEFAULT gen_random_uuid(),
          folio VARCHAR(50),
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


async def create_verificaciones(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.verificaciones (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          documento_id UUID REFERENCES aaces.documentos_emitidos(id) ON DELETE CASCADE,
          codigo VARCHAR(36) NOT NULL,
          fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          ip VARCHAR(45),
          user_agent TEXT,
          tipo VARCHAR(20) NOT NULL DEFAULT 'QR',
          resultado VARCHAR(20) NOT NULL DEFAULT 'VALIDA',
          CONSTRAINT check_tipo_verificacion CHECK (tipo IN ('QR', 'LINK', 'API')),
          CONSTRAINT check_resultado_verificacion CHECK (resultado IN ('VALIDA', 'REVOCADA', 'EXPIRADA', 'NO_EXISTE'))
        )
    """))


async def create_legacy_fixes(conn: AsyncConnection) -> None:
    for stmt in [
        "ALTER TABLE IF EXISTS aaces.clientes ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES aaces.organizaciones(id) ON DELETE SET NULL",
        # El register de Fase 2 inserta la fila puente en clientes con estas
        # columnas; la tabla legacy puede no tenerlas (el CREATE TABLE las
        # agregó sin reparación ADD COLUMN). Sin esto el registro truena con 500.
        "ALTER TABLE IF EXISTS aaces.clientes ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'trial'",
        "ALTER TABLE IF EXISTS aaces.clientes ADD COLUMN IF NOT EXISTS categoria VARCHAR(20) NOT NULL DEFAULT 'basico'",
        "ALTER TABLE IF EXISTS aaces.clientes ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'activo'",
        # La tabla real tiene estas columnas NOT NULL pero sin DEFAULT
        # (el CREATE TABLE sí les pone DEFAULT). Sin esto, cualquier INSERT
        # a clientes que no las incluya truena con NotNullViolation.
        "ALTER TABLE IF EXISTS aaces.clientes ADD COLUMN IF NOT EXISTS cursos_creados INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE IF EXISTS aaces.clientes ADD COLUMN IF NOT EXISTS cursos_max INTEGER NOT NULL DEFAULT 10",
        "ALTER TABLE IF EXISTS aaces.clientes ADD COLUMN IF NOT EXISTS descuento_pct INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE IF EXISTS aaces.clientes ALTER COLUMN cursos_creados SET DEFAULT 0",
        "ALTER TABLE IF EXISTS aaces.clientes ALTER COLUMN cursos_max SET DEFAULT 10",
        "ALTER TABLE IF EXISTS aaces.clientes ALTER COLUMN descuento_pct SET DEFAULT 0",
        "ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS curso_padre_id UUID REFERENCES cursos(id) ON DELETE CASCADE",
        "ALTER TABLE IF EXISTS cursos ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES grupos_curso(id) ON DELETE SET NULL",
        "ALTER TABLE IF EXISTS curso_participante ADD COLUMN IF NOT EXISTS costo_asignado NUMERIC(10,2) DEFAULT 0",
        "ALTER TABLE IF EXISTS curso_participante ADD COLUMN IF NOT EXISTS descuento NUMERIC(10,2) DEFAULT 0",
        "ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS vigencia_desde DATE",
        "ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS vigencia_hasta DATE",
        "ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false",
        "ALTER TABLE aaces.clientes ALTER COLUMN id SET DEFAULT gen_random_uuid()",
        "ALTER TABLE aaces.curso_participante ALTER COLUMN codigo_validacion TYPE VARCHAR(36)",
        "UPDATE aaces.planes SET activo = true WHERE activo IS NULL",
        "ALTER TABLE aaces.usuarios ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false",
        "ALTER TABLE aaces.organizaciones ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)",
        "UPDATE aaces.usuarios SET activo = true WHERE activo IS NULL",
        # Fase 2: validación STPS del Agente Capacitador Externo.
        # Solo una org con stps_validado puede emitir constancias oficiales
        # (las de trial llevan marca de agua PRUEBA hasta validarse).
        "ALTER TABLE IF EXISTS aaces.organizaciones ADD COLUMN IF NOT EXISTS stps_registro VARCHAR(50)",
        "ALTER TABLE IF EXISTS aaces.organizaciones ADD COLUMN IF NOT EXISTS stps_validado BOOLEAN DEFAULT false",
        "ALTER TABLE IF EXISTS aaces.organizaciones ADD COLUMN IF NOT EXISTS stps_validado_en TIMESTAMPTZ",
        # Participantes: el modelo declara pax_id pero la tabla legacy no la tiene.
        # Se agrega nullable + backfill para no romper filas existentes.
        "ALTER TABLE IF EXISTS aaces.participantes ADD COLUMN IF NOT EXISTS pax_id VARCHAR(20)",
        "UPDATE aaces.participantes SET pax_id = 'PAX-' || upper(substr(md5(random()::text || id::text), 1, 9)) WHERE pax_id IS NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_participantes_pax_id ON aaces.participantes(pax_id)",
        # El INSERT de create_participante incluye `pais`, pero la tabla legacy
        # no tiene la columna (se agregó al modelo sin reparación ADD COLUMN).
        "ALTER TABLE IF EXISTS aaces.participantes ADD COLUMN IF NOT EXISTS pais VARCHAR(50) DEFAULT 'Mexico'",
    ]:
        try:
            async with conn.begin_nested():
                await conn.execute(text(stmt))
        except Exception:
            pass


async def ensure_schema(conn: AsyncConnection) -> None:
    logger.info("Ensuring database schema...")
    await create_aaces_schema(conn)
    await create_extensions(conn)
    for fn in [
        create_planes,
        create_organizaciones,
        create_clientes,
        create_tipos_curso,
        create_grupos_curso,
        create_contactos,
        create_usuarios_plataforma,      # NEW: tabla para super_admin (sin organizacion_id)
        create_usuarios,
        alter_usuarios_add_constraints,   # NEW: CHECK rol + FK explícita + NOT NULL
        create_suscripciones,
        create_templates,
        create_registro_intentos,
        create_documentos_emitidos,
        create_verificaciones,
        create_metadata_tables,
        create_legacy_fixes,
    ]:
        try:
            async with conn.begin_nested():
                await fn(conn)
        except Exception as e:
            logger.warning(f"Schema step {fn.__name__} failed: {e}")
            logger.warning(f"Step {fn.__name__} error type: {type(e).__name__}")
    logger.info("Database schema ensured.")