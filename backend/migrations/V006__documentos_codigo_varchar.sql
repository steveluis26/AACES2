-- V006: documentos_emitidos.codigo_validacion de UUID a VARCHAR(20)
--
-- El flujo legacy "asignar constancia" (clientes.py) genera códigos públicos
-- de 8 caracteres (ej. 9F41F3BE) en curso_participante.codigo_validacion
-- (VARCHAR(20)). El servicio nuevo /constancias/emitir reutiliza ese código
-- existente, pero documentos_emitidos.codigo_validacion es UUID → el INSERT
-- truena con "invalid input syntax for type uuid" (500).
--
-- Se unifica a VARCHAR(20) para que ambos flujos usen el mismo formato.
-- Idempotente: verifica el tipo actual antes de alterar.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'aaces'
          AND table_name = 'documentos_emitidos'
          AND column_name = 'codigo_validacion'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE aaces.documentos_emitidos
            ALTER COLUMN codigo_validacion TYPE VARCHAR(20)
            USING codigo_validacion::text;
        -- El default gen_random_uuid() ya no aplica a VARCHAR; se quita
        ALTER TABLE aaces.documentos_emitidos
            ALTER COLUMN codigo_validacion DROP DEFAULT;
    END IF;
END $$;
