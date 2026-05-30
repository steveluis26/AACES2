-- AACES Database Schema - Enterprise Ready Version
-- PostgreSQL Migration Script

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS aaces;
SET search_path TO aaces, public;

-- =====================================================
-- TABLE: clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS clientes ( 
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL, 
    correo VARCHAR(255) UNIQUE NOT NULL, 
    password_hash VARCHAR(255) NOT NULL,
    ciudad_base VARCHAR(100),
    categoria VARCHAR(20) DEFAULT 'basico' CHECK (categoria IN ('basico', 'premium', 'enterprise')), 
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido', 'eliminado')),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_cambio_categoria TIMESTAMP,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    intentos_fallidos INTEGER DEFAULT 0 CHECK (intentos_fallidos >= 0),
    bloqueado_hasta TIMESTAMP WITH TIME ZONE,
    -- GDPR/Protección de datos
    acepta_terminos BOOLEAN DEFAULT FALSE,
    fecha_acepta_terminos TIMESTAMP WITH TIME ZONE,
    datos_procesados BOOLEAN DEFAULT TRUE,
    fecha_eliminacion_logica TIMESTAMP WITH TIME ZONE,
    -- Campos de auditoría
    creado_por UUID REFERENCES clientes(id),
    actualizado_por UUID REFERENCES clientes(id)
);

-- Índices para performance en clientes
CREATE INDEX IF NOT EXISTS idx_clientes_correo ON clientes(correo);
CREATE INDEX IF NOT EXISTS idx_clientes_categoria ON clientes(categoria);
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);
CREATE INDEX IF NOT EXISTS idx_clientes_fecha_creacion ON clientes(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_clientes_ultimo_acceso ON clientes(ultimo_acceso);

-- =====================================================
-- TABLE: capacitadores
-- =====================================================
CREATE TABLE IF NOT EXISTS capacitadores ( 
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL, 
    correo VARCHAR(255) UNIQUE,
    telefono VARCHAR(20),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    fecha_inicio_vigencia DATE,
    fecha_fin_vigencia DATE,
    estado_pago VARCHAR(20) DEFAULT 'pendiente' CHECK (estado_pago IN ('pagado', 'vencido', 'pendiente', 'cancelado')),
    acceso_activo BOOLEAN DEFAULT FALSE,
    -- Campos adicionales para trazabilidad
    documento_identidad VARCHAR(50),
    especialidad VARCHAR(100),
    nivel_certificacion VARCHAR(50),
    -- Auditoría
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    creado_por UUID REFERENCES clientes(id),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_por UUID REFERENCES clientes(id)
);

-- Índices para capacitadores
CREATE INDEX IF NOT EXISTS idx_capacitadores_cliente_id ON capacitadores(cliente_id);
CREATE INDEX IF NOT EXISTS idx_capacitadores_correo ON capacitadores(correo);
CREATE INDEX IF NOT EXISTS idx_capacitadores_estado_pago ON capacitadores(estado_pago);
CREATE INDEX IF NOT EXISTS idx_capacitadores_acceso_activo ON capacitadores(acceso_activo);
CREATE INDEX IF NOT EXISTS idx_capacitadores_vigencia ON capacitadores(fecha_inicio_vigencia, fecha_fin_vigencia);

-- =====================================================
-- TABLE: cursos
-- =====================================================
CREATE TABLE IF NOT EXISTS cursos ( 
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    codigo_curso VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(200) NOT NULL, 
    ciudad VARCHAR(100) NOT NULL, 
    fecha_inicio DATE NOT NULL, 
    fecha_fin DATE NOT NULL,
    duracion_horas INTEGER NOT NULL CHECK (duracion_horas > 0),
    modalidad VARCHAR(20) CHECK (modalidad IN ('presencial', 'virtual', 'mixta')),
    capacitador_id UUID REFERENCES capacitadores(id),
    duracion_validacion INTEGER, -- en meses
    costo_total DECIMAL(10,2),
    moneda VARCHAR(3) DEFAULT 'USD',
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado', 'en_espera', 'cancelado')),
    empresa_contratante VARCHAR(200),
    descripcion TEXT,
    objetivos TEXT,
    requisitos TEXT,
    -- Campos de auditoría
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    creado_por UUID REFERENCES clientes(id),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_por UUID REFERENCES clientes(id)
);

-- Índices críticos para performance en cursos
CREATE INDEX IF NOT EXISTS idx_cursos_cliente_id ON cursos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cursos_codigo_curso ON cursos(codigo_curso);
CREATE INDEX IF NOT EXISTS idx_cursos_fechas ON cursos(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_cursos_estado ON cursos(estado);
CREATE INDEX IF NOT EXISTS idx_cursos_ciudad ON cursos(ciudad);
CREATE INDEX IF NOT EXISTS idx_cursos_capacitador_id ON cursos(capacitador_id);

-- =====================================================
-- TABLE: participantes
-- =====================================================
CREATE TABLE IF NOT EXISTS participantes ( 
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_documento VARCHAR(20) CHECK (tipo_documento IN ('DNI', 'PASAPORTE', 'CEDULA', 'OTRO')),
    numero_documento VARCHAR(50) UNIQUE,
    numero_documento_encrypted BYTEA, -- Campo encriptado para seguridad
    nombre VARCHAR(100) NOT NULL, 
    apellido VARCHAR(100),
    correo VARCHAR(255),
    telefono VARCHAR(20),
    ciudad_origen VARCHAR(100),
    fecha_nacimiento DATE,
    genero VARCHAR(10) CHECK (genero IN ('M', 'F', 'Otro')),
    empresa VARCHAR(200),
    cargo VARCHAR(100),
    nivel_educacion VARCHAR(50),
    -- Campos de contacto adicionales
    direccion TEXT,
    codigo_postal VARCHAR(20),
    pais VARCHAR(50) DEFAULT 'Ecuador',
    -- Auditoría
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para participantes
CREATE INDEX IF NOT EXISTS idx_participantes_documento ON participantes(numero_documento);
CREATE INDEX IF NOT EXISTS idx_participantes_correo ON participantes(correo);
CREATE INDEX IF NOT EXISTS idx_participantes_nombre ON participantes(nombre, apellido);

-- =====================================================
-- TABLE: curso_participante
-- =====================================================
CREATE TABLE IF NOT EXISTS curso_participante ( 
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    participante_id UUID NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
    estado_pago VARCHAR(20) CHECK (estado_pago IN ('pagado', 'anticipo', 'pendiente', 'cancelado')),
    valor_pagado DECIMAL(10,2) DEFAULT 0,
    fecha_pago TIMESTAMP WITH TIME ZONE,
    fecha_participacion DATE,
    fecha_inicio_vigencia DATE,
    fecha_expiracion DATE,
    id_certificado VARCHAR(50) UNIQUE,
    codigo_validacion VARCHAR(20) UNIQUE, -- Código corto para validación pública
    estado_acreditacion BOOLEAN DEFAULT FALSE,
    calificacion DECIMAL(5,2) CHECK (calificacion >= 0 AND calificacion <= 100),
    asistencia DECIMAL(5,2) DEFAULT 0 CHECK (asistencia >= 0 AND asistencia <= 100),
    observaciones TEXT,
    -- Documentos generados
    certificado_url TEXT,
    fecha_emision_certificado TIMESTAMP WITH TIME ZONE,
    -- Auditoría
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    creado_por UUID REFERENCES clientes(id),
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_por UUID REFERENCES clientes(id),
    -- Constraint único para evitar duplicados
    UNIQUE(curso_id, participante_id)
);

-- Índices críticos para curso_participante
CREATE INDEX IF NOT EXISTS idx_curso_participante_curso_id ON curso_participante(curso_id);
CREATE INDEX IF NOT EXISTS idx_curso_participante_participante_id ON curso_participante(participante_id);
CREATE INDEX IF NOT EXISTS idx_curso_participante_certificado ON curso_participante(id_certificado);
CREATE INDEX IF NOT EXISTS idx_curso_participante_validacion ON curso_participante(codigo_validacion);
CREATE INDEX IF NOT EXISTS idx_curso_participante_estado_acreditacion ON curso_participante(estado_acreditacion);
CREATE INDEX IF NOT EXISTS idx_curso_participante_fechas ON curso_participante(fecha_inicio_vigencia, fecha_expiracion);

-- =====================================================
-- TABLE: pagos
-- =====================================================
CREATE TABLE IF NOT EXISTS pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id),
    curso_participante_id UUID REFERENCES curso_participante(id),
    tipo_pago VARCHAR(30) CHECK (tipo_pago IN ('participante', 'capacitador', 'curso_completo')),
    monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    moneda VARCHAR(3) DEFAULT 'USD',
    metodo_pago VARCHAR(50) CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'paypal', 'otro')),
    referencia_pago VARCHAR(100),
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    estado_pago VARCHAR(20) DEFAULT 'completado' CHECK (estado_pago IN ('pendiente', 'completado', 'fallido', 'reembolsado')),
    comprobante_url TEXT,
    notas TEXT,
    -- Auditoría
    creado_por UUID REFERENCES clientes(id),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para pagos
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_id ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_curso_participante_id ON pagos(curso_participante_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON pagos(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_tipo ON pagos(tipo_pago);

-- =====================================================
-- TABLE: validaciones_publicas
-- =====================================================
CREATE TABLE IF NOT EXISTS validaciones_publicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_validacion VARCHAR(20) REFERENCES curso_participante(codigo_validacion),
    fecha_validacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_validacion INET,
    user_agent TEXT,
    resultado BOOLEAN DEFAULT TRUE,
    intentos INTEGER DEFAULT 1 CHECK (intentos > 0),
    -- Para limitar intentos de validación
    UNIQUE(codigo_validacion, ip_validacion)
);

-- Índices para validaciones_publicas
CREATE INDEX IF NOT EXISTS idx_validaciones_codigo ON validaciones_publicas(codigo_validacion);
CREATE INDEX IF NOT EXISTS idx_validaciones_fecha ON validaciones_publicas(fecha_validacion);
CREATE INDEX IF NOT EXISTS idx_validaciones_ip ON validaciones_publicas(ip_validacion);

-- =====================================================
-- TABLE: auditoria_cambios
-- =====================================================
CREATE TABLE IF NOT EXISTS auditoria_cambios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabla_nombre VARCHAR(50) NOT NULL,
    operacion VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    usuario_id UUID,
    fecha_cambio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip_origen INET,
    user_agent TEXT
);

-- Índices para auditoria_cambios
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria_cambios(tabla_nombre);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria_cambios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria_cambios(fecha_cambio);
CREATE INDEX IF NOT EXISTS idx_auditoria_operacion ON auditoria_cambios(operacion);

-- =====================================================
-- TABLE: grupos_espera
-- =====================================================
CREATE TABLE IF NOT EXISTS grupos_espera (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    nombre_grupo VARCHAR(100) NOT NULL,
    capacidad_maxima INTEGER NOT NULL CHECK (capacidad_maxima > 0),
    fecha_inicio_espera DATE NOT NULL,
    fecha_fin_espera DATE,
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'completo', 'cerrado')),
    notas TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para grupos_espera
CREATE INDEX IF NOT EXISTS idx_grupos_espera_cliente_id ON grupos_espera(cliente_id);
CREATE INDEX IF NOT EXISTS idx_grupos_espera_curso_id ON grupos_espera(curso_id);
CREATE INDEX IF NOT EXISTS idx_grupos_espera_estado ON grupos_espera(estado);

-- =====================================================
-- TABLE: grupo_espera_participante
-- =====================================================
CREATE TABLE IF NOT EXISTS grupo_espera_participante (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_espera_id UUID NOT NULL REFERENCES grupos_espera(id) ON DELETE CASCADE,
    participante_id UUID NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'en_espera' CHECK (estado IN ('en_espera', 'confirmado', 'cancelado', 'expirado')),
    prioridad INTEGER DEFAULT 1 CHECK (prioridad > 0),
    notas TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(grupo_espera_id, participante_id)
);

-- Índices para grupo_espera_participante
CREATE INDEX IF NOT EXISTS idx_grupo_espera_participante_grupo_id ON grupo_espera_participante(grupo_espera_id);
CREATE INDEX IF NOT EXISTS idx_grupo_espera_participante_participante_id ON grupo_espera_participante(participante_id);
CREATE INDEX IF NOT EXISTS idx_grupo_espera_participante_estado ON grupo_espera_participante(estado);

-- =====================================================
-- FUNCTION: Generar código de validación único
-- =====================================================
CREATE OR REPLACE FUNCTION generar_codigo_validacion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.codigo_validacion IS NULL THEN
        NEW.codigo_validacion := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Generar ID de certificado único
-- =====================================================
CREATE OR REPLACE FUNCTION generar_id_certificado()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_certificado IS NULL AND NEW.estado_acreditacion = TRUE THEN
        NEW.id_certificado := 'CERT-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger para generar código de validación
DROP TRIGGER IF EXISTS trigger_generar_codigo_validacion ON curso_participante;
CREATE TRIGGER trigger_generar_codigo_validacion
    BEFORE INSERT ON curso_participante
    FOR EACH ROW
    EXECUTE FUNCTION generar_codigo_validacion();

-- Trigger para generar ID de certificado
DROP TRIGGER IF EXISTS trigger_generar_id_certificado ON curso_participante;
CREATE TRIGGER trigger_generar_id_certificado
    BEFORE UPDATE ON curso_participante
    FOR EACH ROW
    WHEN (NEW.estado_acreditacion = TRUE AND (OLD.estado_acreditacion = FALSE OR OLD.id_certificado IS NULL))
    EXECUTE FUNCTION generar_id_certificado();

-- Trigger para actualizar fecha de actualización
CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas que lo necesitan
DROP TRIGGER IF EXISTS trigger_actualizar_fecha_clientes ON clientes;
CREATE TRIGGER trigger_actualizar_fecha_clientes
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_fecha_capacitadores ON capacitadores;
CREATE TRIGGER trigger_actualizar_fecha_capacitadores
    BEFORE UPDATE ON capacitadores
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_fecha_cursos ON cursos;
CREATE TRIGGER trigger_actualizar_fecha_cursos
    BEFORE UPDATE ON cursos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_fecha_participantes ON participantes;
CREATE TRIGGER trigger_actualizar_fecha_participantes
    BEFORE UPDATE ON participantes
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_fecha_curso_participante ON curso_participante;
CREATE TRIGGER trigger_actualizar_fecha_curso_participante
    BEFORE UPDATE ON curso_participante
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

-- =====================================================
-- FUNCTION: Auditoría de cambios
-- =====================================================
CREATE OR REPLACE FUNCTION auditar_cambios()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO auditoria_cambios (tabla_nombre, operacion, usuario_id, datos_anteriores, datos_nuevos, ip_origen, user_agent)
        VALUES (
            TG_TABLE_NAME, 
            'UPDATE', 
            current_setting('app.current_user_id', TRUE)::UUID, 
            row_to_json(OLD), 
            row_to_json(NEW),
            current_setting('app.client_ip', TRUE)::INET,
            current_setting('app.user_agent', TRUE)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO auditoria_cambios (tabla_nombre, operacion, usuario_id, datos_anteriores, ip_origen, user_agent)
        VALUES (
            TG_TABLE_NAME, 
            'DELETE', 
            current_setting('app.current_user_id', TRUE)::UUID, 
            row_to_json(OLD),
            current_setting('app.client_ip', TRUE)::INET,
            current_setting('app.user_agent', TRUE)
        );
        RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria_cambios (tabla_nombre, operacion, usuario_id, datos_nuevos, ip_origen, user_agent)
        VALUES (
            TG_TABLE_NAME, 
            'INSERT', 
            current_setting('app.current_user_id', TRUE)::UUID, 
            row_to_json(NEW),
            current_setting('app.client_ip', TRUE)::INET,
            current_setting('app.user_agent', TRUE)
        );
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar auditoría a tablas críticas
DROP TRIGGER IF EXISTS trigger_auditar_clientes ON clientes;
CREATE TRIGGER trigger_auditar_clientes
    AFTER INSERT OR UPDATE OR DELETE ON clientes
    FOR EACH ROW EXECUTE FUNCTION auditar_cambios();

DROP TRIGGER IF EXISTS trigger_auditar_capacitadores ON capacitadores;
CREATE TRIGGER trigger_auditar_capacitadores
    AFTER INSERT OR UPDATE OR DELETE ON capacitadores
    FOR EACH ROW EXECUTE FUNCTION auditar_cambios();

DROP TRIGGER IF EXISTS trigger_auditar_cursos ON cursos;
CREATE TRIGGER trigger_auditar_cursos
    AFTER INSERT OR UPDATE OR DELETE ON cursos
    FOR EACH ROW EXECUTE FUNCTION auditar_cambios();

DROP TRIGGER IF EXISTS trigger_auditar_participantes ON participantes;
CREATE TRIGGER trigger_auditar_participantes
    AFTER INSERT OR UPDATE OR DELETE ON participantes
    FOR EACH ROW EXECUTE FUNCTION auditar_cambios();

DROP TRIGGER IF EXISTS trigger_auditar_curso_participante ON curso_participante;
CREATE TRIGGER trigger_auditar_curso_participante
    AFTER INSERT OR UPDATE OR DELETE ON curso_participante
    FOR EACH ROW EXECUTE FUNCTION auditar_cambios();

-- =====================================================
-- FUNCTION: Actualizar métricas del cliente
-- =====================================================
CREATE OR REPLACE FUNCTION actualizar_metricas_cliente()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar contador de cursos del cliente
    UPDATE clientes 
    SET fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id = NEW.cliente_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_metricas ON cursos;
CREATE TRIGGER trigger_actualizar_metricas
    AFTER INSERT OR UPDATE ON cursos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_metricas_cliente();

-- =====================================================
-- VISTAS MATERIALIZADAS PARA REPORTES
-- =====================================================

-- Vista de resumen de cliente
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_resumen_cliente AS
SELECT 
    c.id as cliente_id,
    c.nombre as cliente_nombre,
    c.categoria,
    c.estado,
    COUNT(DISTINCT cur.id) as total_cursos,
    COUNT(DISTINCT cp.participante_id) as total_participantes,
    COUNT(DISTINCT CASE WHEN cp.estado_acreditacion = true THEN cp.participante_id END) as total_acreditados,
    SUM(CASE WHEN p.estado_pago = 'completado' THEN p.monto ELSE 0 END) as total_ingresos,
    AVG(cp.calificacion) as promedio_calificaciones,
    MAX(cp.fecha_actualizacion) as ultima_actualizacion
FROM clientes c
LEFT JOIN cursos cur ON c.id = cur.cliente_id AND cur.estado = 'activo'
LEFT JOIN curso_participante cp ON cur.id = cp.curso_id
LEFT JOIN pagos p ON cp.id = p.curso_participante_id AND p.estado_pago = 'completado'
WHERE c.estado = 'activo'
GROUP BY c.id, c.nombre, c.categoria, c.estado;

CREATE INDEX IF NOT EXISTS idx_mv_resumen_cliente_id ON mv_resumen_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mv_resumen_cliente_categoria ON mv_resumen_cliente(categoria);

-- Vista de certificados próximos a vencer
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_certificados_proximos_vencer AS
SELECT 
    cp.id,
    cp.codigo_validacion,
    cp.id_certificado,
    cp.fecha_expiracion,
    cp.estado_acreditacion,
    p.nombre as participante_nombre,
    p.apellido as participante_apellido,
    p.correo as participante_correo,
    c.nombre as curso_nombre,
    c.codigo_curso,
    cl.nombre as cliente_nombre,
    CASE 
        WHEN cp.fecha_expiracion <= CURRENT_DATE + INTERVAL '30 days' THEN 'pronto_a_vencer'
        WHEN cp.fecha_expiracion <= CURRENT_DATE + INTERVAL '7 days' THEN 'muy_pronto'
        WHEN cp.fecha_expiracion <= CURRENT_DATE THEN 'vencido'
        ELSE 'vigente'
    END as estado_vencimiento
FROM curso_participante cp
JOIN participantes p ON cp.participante_id = p.id
JOIN cursos c ON cp.curso_id = c.id
JOIN clientes cl ON c.cliente_id = cl.id
WHERE cp.estado_acreditacion = TRUE 
    AND cp.fecha_expiracion IS NOT NULL
    AND cp.fecha_expiracion <= CURRENT_DATE + INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS idx_mv_certificados_vencer_fecha ON mv_certificados_proximos_vencer(fecha_expiracion);
CREATE INDEX IF NOT EXISTS idx_mv_certificados_vencer_estado ON mv_certificados_proximos_vencer(estado_vencimiento);

-- Función para refrescar vistas materializadas
CREATE OR REPLACE FUNCTION refrescar_vistas_materializadas()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_resumen_cliente;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_certificados_proximos_vencer;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERMISOS Y SEGURIDAD
-- =====================================================

-- Crear roles de base de datos
CREATE ROLE aaces_app_user;
CREATE ROLE aaces_read_only;
CREATE ROLE aaces_admin;

-- Conceder permisos básicos
GRANT USAGE ON SCHEMA aaces TO aaces_app_user, aaces_read_only, aaces_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA aaces TO aaces_app_user;
GRANT SELECT ON ALL TABLES IN SCHEMA aaces TO aaces_read_only;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA aaces TO aaces_admin;

-- Conceder permisos en secuencias
GRANT USAGE ON ALL SEQUENCES IN SCHEMA aaces TO aaces_app_user, aaces_admin;

-- Conceder permisos en funciones
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA aaces TO aaces_app_user, aaces_admin;

-- Permisos para vistas materializadas
GRANT SELECT ON ALL TABLES IN SCHEMA aaces TO aaces_app_user, aaces_read_only, aaces_admin;

-- Configurar permisos por defecto para futuras tablas
ALTER DEFAULT PRIVILEGES IN SCHEMA aaces GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aaces_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA aaces GRANT SELECT ON TABLES TO aaces_read_only;
ALTER DEFAULT PRIVILEGES IN SCHEMA aaces GRANT ALL ON TABLES TO aaces_admin;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - SEGURIDAD A NIVEL DE FILA
-- =====================================================

-- Habilitar RLS en tablas críticas
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacitadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_participante ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para clientes (solo pueden ver su propio registro)
CREATE POLICY clientes_self_policy ON clientes
    FOR ALL TO aaces_app_user
    USING (id = current_setting('app.current_client_id')::UUID);

-- Políticas de seguridad para capacitadores (solo del cliente actual)
CREATE POLICY capacitadores_cliente_policy ON capacitadores
    FOR ALL TO aaces_app_user
    USING (cliente_id = current_setting('app.current_client_id')::UUID);

-- Políticas de seguridad para cursos (solo del cliente actual)
CREATE POLICY cursos_cliente_policy ON cursos
    FOR ALL TO aaces_app_user
    USING (cliente_id = current_setting('app.current_client_id')::UUID);

-- Políticas de seguridad para curso_participante (solo de cursos del cliente actual)
CREATE POLICY curso_participante_cliente_policy ON curso_participante
    FOR ALL TO aaces_app_user
    USING (
        curso_id IN (
            SELECT id FROM cursos 
            WHERE cliente_id = current_setting('app.current_client_id')::UUID
        )
    );

-- Políticas de seguridad para pagos (solo del cliente actual)
CREATE POLICY pagos_cliente_policy ON pagos
    FOR ALL TO aaces_app_user
    USING (cliente_id = current_setting('app.current_client_id')::UUID);

-- =====================================================
-- FUNCTION: Encriptación de datos sensibles
-- =====================================================

CREATE OR REPLACE FUNCTION encriptar_dato(dato TEXT, clave TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(dato, clave);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION desencriptar_dato(dato_encriptado BYTEA, clave TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(dato_encriptado, clave);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Insertar participante con datos encriptados
-- =====================================================
CREATE OR REPLACE FUNCTION insertar_participante_seguro(
    p_tipo_documento VARCHAR,
    p_numero_documento VARCHAR,
    p_nombre VARCHAR,
    p_apellido VARCHAR,
    p_correo VARCHAR,
    p_telefono VARCHAR,
    p_clave_encriptacion TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
    clave_encriptacion_final TEXT;
BEGIN
    -- Usar clave proporcionada o generar una temporal
    IF p_clave_encriptacion IS NULL THEN
        clave_encriptacion_final := current_setting('app.encryption_key', TRUE);
    ELSE
        clave_encriptacion_final := p_clave_encriptacion;
    END IF;
    
    INSERT INTO participantes (
        tipo_documento, 
        numero_documento, 
        numero_documento_encrypted, 
        nombre, 
        apellido, 
        correo, 
        telefono
    )
    VALUES (
        p_tipo_documento,
        p_numero_documento,
        CASE WHEN p_numero_documento IS NOT NULL THEN pgp_sym_encrypt(p_numero_documento, clave_encriptacion_final) ELSE NULL END,
        p_nombre,
        p_apellido,
        p_correo,
        p_telefono
    )
    RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE clientes IS 'Tabla de clientes del sistema AACES con información de autenticación y perfil';
COMMENT ON TABLE capacitadores IS 'Tabla de capacitadores asociados a los clientes';
COMMENT ON TABLE cursos IS 'Tabla de cursos organizados por los clientes';
COMMENT ON TABLE participantes IS 'Tabla de participantes en los cursos';
COMMENT ON TABLE curso_participante IS 'Tabla intermedia que relaciona cursos con participantes';
COMMENT ON TABLE pagos IS 'Tabla de pagos realizados por los participantes';
COMMENT ON TABLE validaciones_publicas IS 'Tabla de auditoría para validaciones públicas de certificados';
COMMENT ON TABLE auditoria_cambios IS 'Tabla de auditoría de cambios en el sistema';
COMMENT ON TABLE grupos_espera IS 'Tabla de grupos de espera para cursos';
COMMENT ON TABLE grupo_espera_participante IS 'Tabla de participantes en grupos de espera';

-- =====================================================
-- FINALIZACIÓN
-- =====================================================

-- Establecer propietario de las tablas
ALTER TABLE clientes OWNER TO aaces_admin;
ALTER TABLE capacitadores OWNER TO aaces_admin;
ALTER TABLE cursos OWNER TO aaces_admin;
ALTER TABLE participantes OWNER TO aaces_admin;
ALTER TABLE curso_participante OWNER TO aaces_admin;
ALTER TABLE pagos OWNER TO aaces_admin;
ALTER TABLE validaciones_publicas OWNER TO aaces_admin;
ALTER TABLE auditoria_cambios OWNER TO aaces_admin;
ALTER TABLE grupos_espera OWNER TO aaces_admin;
ALTER TABLE grupo_espera_participante OWNER TO aaces_admin;

-- Reset search path
RESET search_path;

-- Mensaje de finalización
SELECT 'Base de datos AACES creada exitosamente con todas las mejoras de seguridad y performance' AS mensaje;