-- Migration: Add missing columns to participantes table
-- Generated to match SQLAlchemy model

SET search_path TO aaces, public;

-- Add pax_id column
ALTER TABLE aaces.participantes 
ADD COLUMN IF NOT EXISTS pax_id VARCHAR(20) UNIQUE;

-- Add apellido_paterno column
ALTER TABLE aaces.participantes 
ADD COLUMN IF NOT EXISTS apellido_paterno VARCHAR(100);

-- Add apellido_materno column
ALTER TABLE aaces.participantes 
ADD COLUMN IF NOT EXISTS apellido_materno VARCHAR(100);

-- Add cliente_id column with foreign key
ALTER TABLE aaces.participantes 
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES aaces.clientes(id) ON DELETE SET NULL;

-- Add numero_documento_encrypted column
ALTER TABLE aaces.participantes 
ADD COLUMN IF NOT EXISTS numero_documento_encrypted BYTEA;

-- Add index for pax_id
CREATE INDEX IF NOT EXISTS idx_participantes_pax_id ON aaces.participantes(pax_id);

-- Add index for cliente_id
CREATE INDEX IF NOT EXISTS idx_participantes_cliente_id ON aaces.participantes(cliente_id);

-- Add index for nombres_apellidos composite
CREATE INDEX IF NOT EXISTS idx_participantes_nombres_apellidos ON aaces.participantes(nombre, apellido, apellido_paterno, apellido_materno);

-- Update existing records: generate pax_id for rows that don't have it
UPDATE aaces.participantes 
SET pax_id = 'PAX-' || upper(substring(md5(random()::text || id::text || clock_timestamp()::text) from 1 for 9))
WHERE pax_id IS NULL;

-- Make pax_id NOT NULL after populating
ALTER TABLE aaces.participantes 
ALTER COLUMN pax_id SET NOT NULL;

COMMENT ON COLUMN aaces.participantes.pax_id IS 'Código único de participante (PAX-XXXXXXXXX)';
COMMENT ON COLUMN aaces.participantes.apellido_paterno IS 'Apellido paterno del participante';
COMMENT ON COLUMN aaces.participantes.apellido_materno IS 'Apellido materno del participante';
COMMENT ON COLUMN aaces.participantes.cliente_id IS 'Referencia al cliente propietario del participante';
COMMENT ON COLUMN aaces.participantes.numero_documento_encrypted IS 'Número de documento encriptado para seguridad';
