-- AACES Migration 003: Plan, descuento, y columnas de control
-- Agrega soporte para plan trial, límite de cursos, y descuento manual

BEGIN;

-- Cliente: plan, límite de cursos, descuento
ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'trial';
ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS cursos_creados INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS cursos_max INTEGER NOT NULL DEFAULT 10;
ALTER TABLE IF EXISTS clientes ADD COLUMN IF NOT EXISTS descuento_pct INTEGER NOT NULL DEFAULT 0;

-- Índices para los nuevos campos
CREATE INDEX IF NOT EXISTS idx_clientes_plan ON clientes(plan);

COMMIT;
