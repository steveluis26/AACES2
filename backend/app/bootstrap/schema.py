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
          estado VARCHAR(50) DEFAULT 'activo',
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
          estado VARCHAR(50) DEFAULT 'activo',
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
          categoria VARCHAR(50) NOT NULL DEFAULT 'basico',
          estado VARCHAR(50) NOT NULL DEFAULT 'activo',
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
          plan VARCHAR(50) NOT NULL DEFAULT 'trial',
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
          telefono VARCHAR(50),
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
          telefono VARCHAR(50),
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
          resultado VARCHAR(50),
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
          codigo_validacion VARCHAR(50) NOT NULL,
          folio VARCHAR(50),
          storage_provider VARCHAR(50) NOT NULL,
          storage_key VARCHAR(500) NOT NULL,
          pdf_hash VARCHAR(64) NOT NULL,
          html_snapshot TEXT,
          documento_metadata JSONB DEFAULT '{}',
          emitido_por UUID REFERENCES aaces.usuarios(id) ON DELETE SET NULL,
          fecha_emision TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          estatus VARCHAR(50) DEFAULT 'emitido' NOT NULL,
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
          tipo VARCHAR(50) NOT NULL DEFAULT 'QR',
          resultado VARCHAR(50) NOT NULL DEFAULT 'VALIDA',
          CONSTRAINT check_tipo_verificacion CHECK (tipo IN ('QR', 'LINK', 'API')),
          CONSTRAINT check_resultado_verificacion CHECK (resultado IN ('VALIDA', 'REVOCADA', 'EXPIRADA', 'NO_EXISTE'))
        )
    """))


async def create_notificaciones(conn: AsyncConnection) -> None:
    # V007: centro de notificaciones + registro de recordatorios.
    # La clave determinística con UNIQUE por organización hace el job
    # diario idempotente (nunca duplica avisos).
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.notificaciones (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
          tipo VARCHAR(50) NOT NULL,
          clave VARCHAR(200) NOT NULL,
          titulo VARCHAR(200) NOT NULL,
          mensaje TEXT NOT NULL,
          destinatario_correo VARCHAR(255),
          referencia_tipo VARCHAR(50),
          referencia_id UUID,
          dias_restantes INTEGER,
          leida BOOLEAN NOT NULL DEFAULT false,
          email_estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
          email_error TEXT,
          fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          fecha_envio TIMESTAMP WITH TIME ZONE,
          fecha_lectura TIMESTAMP WITH TIME ZONE,
          CONSTRAINT uq_notificacion_org_clave UNIQUE (organizacion_id, clave),
          CONSTRAINT check_tipo_notificacion CHECK (tipo IN (
            'constancia_por_vencer', 'curso_proximo', 'suscripcion_por_vencer',
            'pago_fallido', 'curso_sin_participantes')),
          CONSTRAINT check_email_estado_notificacion CHECK (email_estado IN (
            'pendiente', 'enviado', 'fallido', 'omitido'))
        )
    """))
    for idx in [
        "CREATE INDEX IF NOT EXISTS idx_notificaciones_org ON aaces.notificaciones (organizacion_id)",
        "CREATE INDEX IF NOT EXISTS idx_notificaciones_org_leida ON aaces.notificaciones (organizacion_id, leida)",
        "CREATE INDEX IF NOT EXISTS idx_notificaciones_fecha ON aaces.notificaciones (fecha_creacion)",
    ]:
        await conn.execute(text(idx))


async def create_catalogo(conn: AsyncConnection) -> None:
    # V008: catálogo de cursos + paquetes por organización.
    # Tablas nuevas: CREATE TABLE IF NOT EXISTS es suficiente (no hay drift
    # legacy). Además se agrega la columna opcional catalogo_curso_id a cursos
    # con su FK, porque la tabla legacy no la tiene (lección: toda columna
    # nueva en tabla existente necesita reparación explícita).
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.catalogo_cursos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
          nombre VARCHAR(200) NOT NULL,
          descripcion TEXT,
          duracion_horas INTEGER NOT NULL DEFAULT 8,
          vigencia_meses INTEGER NOT NULL DEFAULT 24,
          precio NUMERIC(10,2) NOT NULL DEFAULT 0,
          moneda VARCHAR(3) NOT NULL DEFAULT 'MXN',
          ciudad VARCHAR(100),
          estado VARCHAR(100),
          modalidad VARCHAR(20) NOT NULL DEFAULT 'presencial',
          publicado BOOLEAN NOT NULL DEFAULT false,
          activo BOOLEAN NOT NULL DEFAULT true,
          fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT check_modalidad_catalogo CHECK (modalidad IN ('presencial', 'virtual', 'mixta')),
          CONSTRAINT check_duracion_catalogo CHECK (duracion_horas > 0),
          CONSTRAINT check_vigencia_catalogo CHECK (vigencia_meses > 0),
          CONSTRAINT check_precio_catalogo CHECK (precio >= 0)
        )
    """))
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.paquetes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
          nombre VARCHAR(200) NOT NULL,
          descripcion TEXT,
          precio NUMERIC(10,2) NOT NULL DEFAULT 0,
          moneda VARCHAR(3) NOT NULL DEFAULT 'MXN',
          publicado BOOLEAN NOT NULL DEFAULT false,
          activo BOOLEAN NOT NULL DEFAULT true,
          fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT check_precio_paquete CHECK (precio >= 0)
        )
    """))
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.paquete_cursos (
          paquete_id UUID NOT NULL REFERENCES aaces.paquetes(id) ON DELETE CASCADE,
          catalogo_curso_id UUID NOT NULL REFERENCES aaces.catalogo_cursos(id) ON DELETE CASCADE,
          PRIMARY KEY (paquete_id, catalogo_curso_id)
        )
    """))
    # Columna de vínculo en cursos (tabla legacy): ADD COLUMN IF NOT EXISTS + FK.
    await conn.execute(text(
        "ALTER TABLE IF EXISTS aaces.cursos ADD COLUMN IF NOT EXISTS catalogo_curso_id UUID"
    ))
    try:
        async with conn.begin_nested():
            await conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cursos_catalogo_curso') THEN
                        ALTER TABLE aaces.cursos
                            ADD CONSTRAINT fk_cursos_catalogo_curso
                            FOREIGN KEY (catalogo_curso_id) REFERENCES aaces.catalogo_cursos(id)
                            ON DELETE SET NULL;
                    END IF;
                END $$;
            """))
    except Exception:
        pass
    for idx in [
        "CREATE INDEX IF NOT EXISTS idx_catalogo_org ON aaces.catalogo_cursos (organizacion_id)",
        "CREATE INDEX IF NOT EXISTS idx_catalogo_publicado ON aaces.catalogo_cursos (publicado)",
        "CREATE INDEX IF NOT EXISTS idx_catalogo_ciudad ON aaces.catalogo_cursos (ciudad)",
        "CREATE INDEX IF NOT EXISTS idx_catalogo_estado ON aaces.catalogo_cursos (estado)",
        "CREATE INDEX IF NOT EXISTS idx_paquetes_org ON aaces.paquetes (organizacion_id)",
        "CREATE INDEX IF NOT EXISTS idx_paquetes_publicado ON aaces.paquetes (publicado)",
    ]:
        await conn.execute(text(idx))


async def create_lista_espera(conn: AsyncConnection) -> None:
    # V009: leads capturados desde /marketplace (lista de espera del directorio).
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.lista_espera (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nombre VARCHAR(200) NOT NULL,
          email VARCHAR(255) NOT NULL,
          empresa VARCHAR(200),
          ciudad VARCHAR(100),
          tipo VARCHAR(20) NOT NULL DEFAULT 'empresa',
          mensaje TEXT,
          fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT check_tipo_lista_espera CHECK (tipo IN ('empresa', 'agencia'))
        )
    """))
    for idx in [
        "CREATE INDEX IF NOT EXISTS idx_lista_espera_email ON aaces.lista_espera (email)",
        "CREATE INDEX IF NOT EXISTS idx_lista_espera_tipo ON aaces.lista_espera (tipo)",
        "CREATE INDEX IF NOT EXISTS idx_lista_espera_fecha ON aaces.lista_espera (fecha_creacion)",
    ]:
        await conn.execute(text(idx))


async def create_legacy_fixes(conn: AsyncConnection) -> None:
    for stmt in [
        "ALTER TABLE IF EXISTS aaces.clientes ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES aaces.organizaciones(id) ON DELETE SET NULL",
        # El register de Fase 2 inserta la fila puente en clientes con estas
        # columnas; la tabla legacy puede no tenerlas (el CREATE TABLE las
        # agregó sin reparación ADD COLUMN). Sin esto el registro truena con 500.
        "ALTER TABLE IF EXISTS aaces.clientes ADD COLUMN IF NOT EXISTS plan VARCHAR(50) NOT NULL DEFAULT 'trial'",
        "ALTER TABLE IF EXISTS aaces.clientes ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) NOT NULL DEFAULT 'basico'",
        "ALTER TABLE IF EXISTS aaces.clientes ADD COLUMN IF NOT EXISTS estado VARCHAR(50) NOT NULL DEFAULT 'activo'",
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
        "ALTER TABLE IF EXISTS aaces.participantes ADD COLUMN IF NOT EXISTS pax_id VARCHAR(50)",
        "UPDATE aaces.participantes SET pax_id = 'PAX-' || upper(substr(md5(random()::text || id::text), 1, 9)) WHERE pax_id IS NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_participantes_pax_id ON aaces.participantes(pax_id)",
        # El INSERT de create_participante incluye `pais`, pero la tabla legacy
        # no tiene la columna (se agregó al modelo sin reparación ADD COLUMN).
        "ALTER TABLE IF EXISTS aaces.participantes ADD COLUMN IF NOT EXISTS pais VARCHAR(50) DEFAULT 'Mexico'",
        # La tabla legacy aaces.participantes no tiene cliente_id (la migración
        # 001 la creó sin esa columna). Fase 2 filtra por cliente_id para
        # el aislamiento multi-tenant; sin esto todo el módulo truena con 500.
        "ALTER TABLE IF EXISTS aaces.participantes ADD COLUMN IF NOT EXISTS cliente_id UUID",
        "CREATE INDEX IF NOT EXISTS idx_participantes_cliente_id ON aaces.participantes(cliente_id)",
        # El INSERT que vincula participante→curso usa costo_asignado/descuento
        # y varios SELECT usan empresa_participacion, pero la tabla legacy no
        # tiene esas columnas (no están ni en la migración 001 ni en el modelo).
        "ALTER TABLE IF EXISTS aaces.curso_participante ADD COLUMN IF NOT EXISTS costo_asignado NUMERIC(10,2) DEFAULT 0",
        "ALTER TABLE IF EXISTS aaces.curso_participante ADD COLUMN IF NOT EXISTS descuento NUMERIC(10,2) DEFAULT 0",
        "ALTER TABLE IF EXISTS aaces.curso_participante ADD COLUMN IF NOT EXISTS empresa_participacion VARCHAR(200)",
        # V009: perfil público de la organización para el futuro directorio.
        # La tabla legacy no tiene estas columnas (lección permanente: toda
        # columna nueva en tabla existente necesita su ADD COLUMN explícito).
        "ALTER TABLE IF EXISTS aaces.organizaciones ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)",
        "ALTER TABLE IF EXISTS aaces.organizaciones ADD COLUMN IF NOT EXISTS sitio_web VARCHAR(255)",
        "ALTER TABLE IF EXISTS aaces.organizaciones ADD COLUMN IF NOT EXISTS descripcion_publica TEXT",
        # documentos_emitidos.codigo_validacion es UUID pero el flujo legacy
        # "asignar constancia" genera códigos públicos de 8 chars (VARCHAR).
        # El servicio /constancias/emitir reutiliza el código existente →
        # el INSERT truena con "invalid input syntax for type uuid" (500).
        # Se unifica a VARCHAR(50) para que ambos flujos usen el mismo formato
        # (50 acomoda UUIDs existentes de 36 chars y códigos nuevos de 8).
        # Orden: primero DROP DEFAULT (gen_random_uuid bloquea el cambio de tipo),
        # luego ALTER TYPE. Si ya es VARCHAR, ambos son no-op (no fallan).
        "ALTER TABLE aaces.documentos_emitidos ALTER COLUMN codigo_validacion DROP DEFAULT",
        "ALTER TABLE aaces.documentos_emitidos ALTER COLUMN codigo_validacion TYPE VARCHAR(50) USING codigo_validacion::text",
    ]:
        try:
            async with conn.begin_nested():
                await conn.execute(text(stmt))
        except Exception as e:
            # Log solo para el fix crítico de documentos_emitidos (debug producción)
            if "documentos_emitidos" in stmt and "codigo_validacion" in stmt:
                logger.warning(f"LEGACY_FIX documentos_emitidos falló: {stmt[:80]} | Error: {e}")
            pass


async def create_archivos_almacenados(conn: AsyncConnection) -> None:
    # PDF de constancias guardados en la base: el disco de Render se borra en cada deploy.
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.archivos_almacenados (
          clave TEXT PRIMARY KEY,
          contenido BYTEA NOT NULL,
          tamano INTEGER,
          fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))
    # Las ligas viejas apuntaban a /storage, que Vercel no redirige al backend
    await conn.execute(text("""
        UPDATE aaces.curso_participante
        SET certificado_url = '/api/v1/archivos/' || substring(certificado_url FROM 10)
        WHERE certificado_url LIKE '/storage/%'
    """))


async def create_cupo_constancias(conn: AsyncConnection) -> None:
    """Límite de constancias por plan.

    Regla: cuenta la primera vez que un participante recibe folio y QR en un curso
    (curso_participante.codigo_validacion pasa de vacío a tener valor). Reemitir,
    regenerar o descargar no cuenta; cancelar no devuelve. El conteo y el bloqueo
    viven en un trigger para que ningún camino de emisión se lo salte."""
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.consumo_constancias (
          curso_participante_id UUID PRIMARY KEY,
          organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
          fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
          de_paquete BOOLEAN NOT NULL DEFAULT false
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_consumo_org_fecha ON aaces.consumo_constancias (organizacion_id, fecha)"))
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.paquetes_constancias (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
          cantidad INTEGER NOT NULL CHECK (cantidad > 0),
          restantes INTEGER NOT NULL CHECK (restantes >= 0),
          referencia_pago VARCHAR(100),
          nota TEXT,
          fecha_compra TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_paquetes_org ON aaces.paquetes_constancias (organizacion_id)"))

    # Estado del cupo de una organización (lo usan el trigger y la API)
    await conn.execute(text("""
        CREATE OR REPLACE FUNCTION aaces.cupo_constancias(p_org UUID)
        RETURNS TABLE (plan_codigo TEXT, plan_nombre TEXT, limite INTEGER, usados INTEGER,
                       periodo_inicio DATE, periodo_fin DATE, extra INTEGER,
                       ilimitado BOOLEAN, es_prueba BOOLEAN, activa BOOLEAN)
        LANGUAGE plpgsql STABLE AS $$
        DECLARE
          s RECORD;
          v_hay BOOLEAN;
          hoy DATE := (now() AT TIME ZONE 'America/Mexico_City')::date;
          k INTEGER;
        BEGIN
          SELECT p.codigo, p.nombre, COALESCE(su.constancias_max, p.constancias_max) AS lim,
                 COALESCE(su.fecha_inicio, su.fecha_creacion::date, hoy) AS fi
            INTO s
            FROM aaces.suscripciones su JOIN aaces.planes p ON p.id = su.plan_id
           WHERE su.organizacion_id = p_org AND su.estatus = 'activa'
             AND (su.fecha_fin IS NULL OR su.fecha_fin >= hoy)
           ORDER BY su.fecha_inicio DESC NULLS LAST, su.fecha_creacion DESC
           LIMIT 1;
          v_hay := FOUND;

          SELECT COALESCE(SUM(pc.restantes), 0)::int INTO extra
            FROM aaces.paquetes_constancias pc WHERE pc.organizacion_id = p_org;

          IF NOT v_hay THEN
            plan_codigo := NULL; plan_nombre := NULL; limite := 0; ilimitado := false;
            es_prueba := false; activa := false; periodo_inicio := NULL; periodo_fin := NULL;
            SELECT count(*)::int INTO usados FROM aaces.consumo_constancias c
             WHERE c.organizacion_id = p_org AND NOT c.de_paquete
               AND c.fecha >= date_trunc('month', now());
            RETURN NEXT; RETURN;
          END IF;

          plan_codigo := s.codigo; plan_nombre := s.nombre; activa := true;
          es_prueba := (s.codigo = 'trial');
          limite := COALESCE(s.lim, 0);
          ilimitado := (s.lim IS NULL OR s.lim >= 999999);

          IF es_prueba THEN
            -- La prueba da un total, no un cupo mensual
            periodo_inicio := NULL; periodo_fin := NULL;
            SELECT count(*)::int INTO usados FROM aaces.consumo_constancias c
             WHERE c.organizacion_id = p_org AND NOT c.de_paquete;
          ELSE
            -- Periodo mensual anclado al día en que empezó la suscripción
            k := (EXTRACT(YEAR FROM age(hoy, s.fi)) * 12 + EXTRACT(MONTH FROM age(hoy, s.fi)))::int;
            periodo_inicio := (s.fi + make_interval(months => k))::date;
            periodo_fin := (s.fi + make_interval(months => k + 1))::date;
            SELECT count(*)::int INTO usados FROM aaces.consumo_constancias c
             WHERE c.organizacion_id = p_org AND NOT c.de_paquete
               AND (c.fecha AT TIME ZONE 'America/Mexico_City')::date >= periodo_inicio;
          END IF;
          RETURN NEXT;
        END $$;
    """))

    await conn.execute(text("""
        CREATE OR REPLACE FUNCTION aaces.tg_consumo_constancia() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE
          v_org UUID;
          e RECORD;
          v_paq UUID;
        BEGIN
          IF NEW.codigo_validacion IS NULL OR NEW.codigo_validacion = '' THEN RETURN NEW; END IF;
          IF TG_OP = 'UPDATE' AND COALESCE(OLD.codigo_validacion, '') <> '' THEN RETURN NEW; END IF;
          IF EXISTS (SELECT 1 FROM aaces.consumo_constancias WHERE curso_participante_id = NEW.id) THEN
            RETURN NEW;  -- ya se contó (p. ej. se le quitó y se le volvió a dar)
          END IF;

          SELECT cl.organizacion_id INTO v_org
            FROM aaces.cursos c JOIN aaces.clientes cl ON cl.id = c.cliente_id
           WHERE c.id = NEW.curso_id;
          IF v_org IS NULL THEN RETURN NEW; END IF;

          -- Un emisor a la vez por organización, para no rebasar el cupo en paralelo
          PERFORM pg_advisory_xact_lock(hashtext('cupo:' || v_org::text));
          SELECT * INTO e FROM aaces.cupo_constancias(v_org);

          IF e.activa AND (e.ilimitado OR e.usados < e.limite) THEN
            INSERT INTO aaces.consumo_constancias (curso_participante_id, organizacion_id)
            VALUES (NEW.id, v_org);
            RETURN NEW;
          END IF;

          IF e.activa AND e.extra > 0 THEN
            SELECT id INTO v_paq FROM aaces.paquetes_constancias
             WHERE organizacion_id = v_org AND restantes > 0
             ORDER BY fecha_compra LIMIT 1 FOR UPDATE;
            UPDATE aaces.paquetes_constancias SET restantes = restantes - 1 WHERE id = v_paq;
            INSERT INTO aaces.consumo_constancias (curso_participante_id, organizacion_id, de_paquete)
            VALUES (NEW.id, v_org, true);
            RETURN NEW;
          END IF;

          RAISE EXCEPTION 'CUPO_CONSTANCIAS_AGOTADO'
            USING ERRCODE = 'P0001',
                  HINT = CASE WHEN e.activa THEN 'Llegaste al límite de constancias de tu plan.'
                              ELSE 'Tu suscripción no está activa.' END;
        END $$;
    """))
    await conn.execute(text("DROP TRIGGER IF EXISTS trg_consumo_constancia ON aaces.curso_participante"))
    await conn.execute(text("""
        CREATE TRIGGER trg_consumo_constancia
        BEFORE INSERT OR UPDATE OF codigo_validacion ON aaces.curso_participante
        FOR EACH ROW EXECUTE FUNCTION aaces.tg_consumo_constancia()
    """))

    # Historial: constancias emitidas antes de existir el límite (no se bloquean)
    await conn.execute(text("""
        INSERT INTO aaces.consumo_constancias (curso_participante_id, organizacion_id, fecha)
        SELECT cp.id, cl.organizacion_id, LEAST(COALESCE(cp.fecha_emision_certificado, cp.fecha_creacion, now()), now())
          FROM aaces.curso_participante cp
          JOIN aaces.cursos c ON c.id = cp.curso_id
          JOIN aaces.clientes cl ON cl.id = c.cliente_id
         WHERE COALESCE(cp.codigo_validacion, '') <> '' AND cl.organizacion_id IS NOT NULL
        ON CONFLICT (curso_participante_id) DO NOTHING
    """))
    await conn.execute(text("UPDATE aaces.consumo_constancias SET fecha = now() WHERE fecha > now()"))

    # Avisos de cupo al 80% y 100%
    await conn.execute(text("ALTER TABLE aaces.notificaciones DROP CONSTRAINT IF EXISTS check_tipo_notificacion"))
    await conn.execute(text("""
        ALTER TABLE aaces.notificaciones ADD CONSTRAINT check_tipo_notificacion CHECK (tipo IN (
          'constancia_por_vencer', 'curso_proximo', 'suscripcion_por_vencer',
          'pago_fallido', 'curso_sin_participantes', 'cupo_constancias'))
    """))


async def create_plantillas_pdf(conn: AsyncConnection) -> None:
    # Plantillas de DC-3/constancias hechas con el formato propio del cliente (PDF).
    # El archivo se guarda en la base de datos: el disco de Render no es persistente.
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS aaces.plantillas_pdf (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
          nombre VARCHAR(200) NOT NULL,
          archivo BYTEA NOT NULL,
          archivo_nombre VARCHAR(255),
          paginas JSONB NOT NULL DEFAULT '[]',
          campos JSONB NOT NULL DEFAULT '[]',
          activa BOOLEAN NOT NULL DEFAULT true,
          fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_plantillas_pdf_org ON aaces.plantillas_pdf(organizacion_id)"
    ))
    # Datos del trabajador que pide el DC-3 oficial (opcionales).
    await conn.execute(text("ALTER TABLE IF EXISTS aaces.participantes ADD COLUMN IF NOT EXISTS curp VARCHAR(18)"))
    await conn.execute(text("ALTER TABLE IF EXISTS aaces.participantes ADD COLUMN IF NOT EXISTS ocupacion VARCHAR(150)"))


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
        create_notificaciones,
        create_catalogo,
        create_lista_espera,
        create_plantillas_pdf,
        create_archivos_almacenados,
        create_cupo_constancias,
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