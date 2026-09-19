-- V009: lista de espera del directorio + perfil público de la organización
--
-- lista_espera: captura leads desde /marketplace (empresas que buscan
-- capacitación y agencias que quieren publicar). Reemplaza el mailto.
-- tipo: 'empresa' | 'agencia'.
--
-- Perfil público: logo_url, sitio_web y descripcion_publica en organizaciones
-- (tabla existente → ADD COLUMN IF NOT EXISTS). Es lo que una empresa mira
-- primero en el futuro directorio.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.

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
);

CREATE INDEX IF NOT EXISTS idx_lista_espera_email ON aaces.lista_espera(email);
CREATE INDEX IF NOT EXISTS idx_lista_espera_tipo ON aaces.lista_espera(tipo);
CREATE INDEX IF NOT EXISTS idx_lista_espera_fecha ON aaces.lista_espera(fecha_creacion);

ALTER TABLE aaces.organizaciones ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);
ALTER TABLE aaces.organizaciones ADD COLUMN IF NOT EXISTS sitio_web VARCHAR(255);
ALTER TABLE aaces.organizaciones ADD COLUMN IF NOT EXISTS descripcion_publica TEXT;
