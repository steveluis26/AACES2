-- V004: Document Engine Tables (Sprints 1-4C)
-- Creación de tablas para el motor documental: templates,
-- documentos_emitidos, verificaciones, y tablas de soporte
-- multi-tenant (organizaciones, usuarios, planes, suscripciones).
--
-- Ejecutar: psql -d aaces -f V004__document_engine.sql
--
-- Nota: Todas las tablas se crean con IF NOT EXISTS y en el orden
-- correcto de dependencias de FK para evitar errores.

BEGIN;

CREATE SCHEMA IF NOT EXISTS aaces;
SET search_path TO aaces;

-- 1. Planes (sin FK)
CREATE TABLE IF NOT EXISTS aaces.planes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(10,2) DEFAULT 0,
    documentos_limite INTEGER DEFAULT 0,
    includes_reportes BOOLEAN DEFAULT false,
    includes_api BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Organizaciones (sin FK)
CREATE TABLE IF NOT EXISTS aaces.organizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razon_social VARCHAR(255) NOT NULL,
    nombre_comercial VARCHAR(255),
    rfc VARCHAR(13) UNIQUE,
    logo_url TEXT,
    sitio_web VARCHAR(255),
    estatus VARCHAR(20) DEFAULT 'activo',
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_estatus_org CHECK (estatus IN ('activo', 'pendiente', 'suspendida'))
);

-- 3. Usuarios (FK: organizaciones)
CREATE TABLE IF NOT EXISTS aaces.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    correo VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) DEFAULT 'admin',
    activo BOOLEAN DEFAULT true,
    intentos_fallidos INTEGER DEFAULT 0,
    bloqueado_hasta TIMESTAMP WITH TIME ZONE,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_rol CHECK (rol IN ('admin', 'operador', 'consultor'))
);

-- 4. Suscripciones (FK: organizaciones, planes)
CREATE TABLE IF NOT EXISTS aaces.suscripciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES aaces.planes(id) ON DELETE RESTRICT,
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    activa BOOLEAN DEFAULT true,
    stripe_subscription_id VARCHAR(255),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_fechas_suscripcion CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio)
);

-- 5. Templates (FK: organizaciones, usuarios)
CREATE TABLE IF NOT EXISTS aaces.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizacion_id UUID NOT NULL REFERENCES aaces.organizaciones(id) ON DELETE CASCADE,
    template_group_id UUID NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    tipo_documento VARCHAR(20) NOT NULL DEFAULT 'CONSTANCIA',
    html_content TEXT NOT NULL,
    css_content TEXT,
    activa BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    creada_por UUID REFERENCES aaces.usuarios(id),
    UNIQUE(organizacion_id, template_group_id, version),
    CONSTRAINT check_tipo_documento_template CHECK (tipo_documento IN ('CONSTANCIA', 'DC3', 'DIPLOMA', 'CREDENCIAL', 'OTRO'))
);

-- 6. Documentos emitidos (FK: organizaciones, templates, usuarios)
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
);

-- 7. Verificaciones (FK: documentos_emitidos)
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
);

-- 8. Registro de intentos (sin FK, tabla auxiliar)
CREATE TABLE IF NOT EXISTS aaces.registro_intentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfc VARCHAR(13),
    correo VARCHAR(255),
    ip_origen VARCHAR(45),
    user_agent TEXT,
    resultado VARCHAR(20),
    detalle TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_organizaciones_rfc ON aaces.organizaciones (rfc);
CREATE INDEX IF NOT EXISTS idx_organizaciones_estatus ON aaces.organizaciones (estatus);
CREATE INDEX IF NOT EXISTS idx_usuarios_org ON aaces.usuarios (organizacion_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON aaces.usuarios (correo);
CREATE INDEX IF NOT EXISTS idx_suscripciones_org ON aaces.suscripciones (organizacion_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_activas ON aaces.suscripciones (organizacion_id, activa);
CREATE INDEX IF NOT EXISTS idx_templates_org_tipo ON aaces.templates (organizacion_id, tipo_documento);
CREATE INDEX IF NOT EXISTS idx_templates_org_activa ON aaces.templates (organizacion_id, activa);
CREATE INDEX IF NOT EXISTS idx_templates_group_id ON aaces.templates (template_group_id);
CREATE INDEX IF NOT EXISTS idx_docs_org_tipo ON aaces.documentos_emitidos (organizacion_id, tipo_documento);
CREATE INDEX IF NOT EXISTS idx_docs_validacion ON aaces.documentos_emitidos (codigo_validacion);
CREATE INDEX IF NOT EXISTS idx_docs_emision ON aaces.documentos_emitidos (fecha_emision);
CREATE INDEX IF NOT EXISTS idx_docs_org_emision ON aaces.documentos_emitidos (organizacion_id, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_docs_org_estado ON aaces.documentos_emitidos (organizacion_id, estatus);
CREATE INDEX IF NOT EXISTS idx_docs_folio ON aaces.documentos_emitidos (folio);
CREATE INDEX IF NOT EXISTS idx_verificaciones_codigo ON aaces.verificaciones (codigo);
CREATE INDEX IF NOT EXISTS idx_verificaciones_fecha ON aaces.verificaciones (fecha);
CREATE INDEX IF NOT EXISTS idx_verificaciones_documento ON aaces.verificaciones (documento_id);
CREATE INDEX IF NOT EXISTS idx_clientes_org_id ON aaces.clientes (organizacion_id);
CREATE INDEX IF NOT EXISTS idx_registro_intentos_fecha ON aaces.registro_intentos (fecha);

-- Vincular clientes legacy con organizaciones (columna agregada en main.py)
ALTER TABLE aaces.clientes ADD COLUMN IF NOT EXISTS organizacion_id UUID REFERENCES aaces.organizaciones(id) ON DELETE SET NULL;
ALTER TABLE aaces.clientes ADD COLUMN IF NOT EXISTS vigencia_desde DATE;
ALTER TABLE aaces.clientes ADD COLUMN IF NOT EXISTS vigencia_hasta DATE;
ALTER TABLE aaces.clientes ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Schema version tracking
CREATE TABLE IF NOT EXISTS aaces.schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);
INSERT INTO aaces.schema_version (version, description)
VALUES (4, 'Document engine tables (V004)')
ON CONFLICT (version) DO NOTHING;

COMMIT;
