-- V005: Validación STPS de organizaciones (Agente Capacitador Externo)
-- Agrega los campos para validar a una organización como ACE/STPS real
-- antes de permitirle emitir constancias oficiales. Sin validación, la
-- organización solo puede emitir constancias de PRUEBA (con marca de agua).
--
-- Fecha: 2026-09-19
-- Fase: 2 (multi-tenancy)
--
-- Ejecutar: psql -d <bd> -f V005__stps_validacion_organizacion.sql
--
-- Nota: Todas las sentencias son idempotentes (IF NOT EXISTS). El arranque
-- del backend ya aplica estas columnas vía app/bootstrap/schema.py
-- (ensure_schema); este archivo es el registro formal/versionado.
--
-- Rollback: ALTER TABLE aaces.organizaciones DROP COLUMN stps_registro,
-- DROP COLUMN stps_validado, DROP COLUMN stps_validado_en;
-- (con pérdida de datos de validación; no ejecutar en producción sin respaldo).

BEGIN;

CREATE SCHEMA IF NOT EXISTS aaces;

-- 1. Registro/clave del Agente Capacitador Externo ante la STPS
ALTER TABLE IF EXISTS aaces.organizaciones
    ADD COLUMN IF NOT EXISTS stps_registro VARCHAR(50);

-- 2. Bandera de validación (solo plataforma puede activarla vía
--    PUT /organizaciones/{org_id}/validar-stps)
ALTER TABLE IF EXISTS aaces.organizaciones
    ADD COLUMN IF NOT EXISTS stps_validado BOOLEAN DEFAULT false;

-- 3. Fecha de validación
ALTER TABLE IF EXISTS aaces.organizaciones
    ADD COLUMN IF NOT EXISTS stps_validado_en TIMESTAMPTZ;

-- Índice para filtrar organizaciones validadas
CREATE INDEX IF NOT EXISTS idx_organizaciones_stps_validado
    ON aaces.organizaciones (stps_validado);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS aaces.schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);
INSERT INTO aaces.schema_version (version, description)
VALUES (5, 'Validación STPS de organizaciones (V005)')
ON CONFLICT (version) DO NOTHING;

COMMIT;
