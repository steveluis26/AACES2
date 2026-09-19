-- V007: tabla notificaciones (centro de notificaciones + recordatorios)
--
-- El job diario de recordatorios genera una fila por aviso para el admin de
-- cada organización y además intenta enviarla por correo. La columna `clave`
-- es determinística (tipo:referencia:variante) con UNIQUE por organización:
-- el job es idempotente y nunca crea duplicados aunque se ejecute varias veces
-- (reintentos, catch-up al arranque, etc.).
--
-- Tipos: constancia_por_vencer, curso_proximo, suscripcion_por_vencer,
--        pago_fallido, curso_sin_participantes
-- email_estado: pendiente | enviado | fallido | omitido
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + DO para constraints/índices.

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
    fecha_lectura TIMESTAMP WITH TIME ZONE
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_notificacion_org_clave'
    ) THEN
        ALTER TABLE aaces.notificaciones
            ADD CONSTRAINT uq_notificacion_org_clave
            UNIQUE (organizacion_id, clave);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_tipo_notificacion'
    ) THEN
        ALTER TABLE aaces.notificaciones
            ADD CONSTRAINT check_tipo_notificacion
            CHECK (tipo IN ('constancia_por_vencer', 'curso_proximo',
                            'suscripcion_por_vencer', 'pago_fallido',
                            'curso_sin_participantes'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_email_estado_notificacion'
    ) THEN
        ALTER TABLE aaces.notificaciones
            ADD CONSTRAINT check_email_estado_notificacion
            CHECK (email_estado IN ('pendiente', 'enviado', 'fallido', 'omitido'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notificaciones_org
    ON aaces.notificaciones (organizacion_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_org_leida
    ON aaces.notificaciones (organizacion_id, leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_fecha
    ON aaces.notificaciones (fecha_creacion);
