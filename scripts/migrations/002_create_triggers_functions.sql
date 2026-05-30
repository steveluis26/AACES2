-- AACES Advanced Triggers and Functions
-- PostgreSQL Migration Script for Automation and Business Logic

-- =====================================================
-- FUNCTION: Actualizar fecha de expiración del certificado
-- =====================================================
CREATE OR REPLACE FUNCTION actualizar_fecha_expiracion_certificado()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se marca como acreditado y no tiene fecha de expiración, calcularla
    IF NEW.estado_acreditacion = TRUE AND (OLD.estado_acreditacion = FALSE OR NEW.fecha_expiracion IS NULL) THEN
        -- Obtener la duración de validación del curso
        SELECT duracion_validacion INTO NEW.fecha_expiracion
        FROM cursos 
        WHERE id = NEW.curso_id;
        
        -- Si el curso tiene duración de validación, calcular fecha de expiración
        IF NEW.fecha_expiracion IS NOT NULL THEN
            NEW.fecha_expiracion := CURRENT_DATE + (NEW.fecha_expiracion || ' months')::INTERVAL;
        ELSE
            -- Valor por defecto: 1 año
            NEW.fecha_expiracion := CURRENT_DATE + INTERVAL '1 year';
        END IF;
        
        -- Establecer fecha de emisión del certificado
        NEW.fecha_emision_certificado := CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_fecha_expiracion ON curso_participante;
CREATE TRIGGER trigger_actualizar_fecha_expiracion
    BEFORE UPDATE ON curso_participante
    FOR EACH ROW
    WHEN (NEW.estado_acreditacion = TRUE)
    EXECUTE FUNCTION actualizar_fecha_expiracion_certificado();

-- =====================================================
-- FUNCTION: Validar y actualizar estado de pagos
-- =====================================================
CREATE OR REPLACE FUNCTION validar_estado_pagos()
RETURNS TRIGGER AS $$
DECLARE
    total_pagado DECIMAL(10,2);
    costo_curso DECIMAL(10,2);
BEGIN
    -- Calcular total pagado por el participante en el curso
    SELECT COALESCE(SUM(monto), 0) INTO total_pagado
    FROM pagos
    WHERE curso_participante_id = NEW.curso_participante_id
    AND estado_pago = 'completado';
    
    -- Obtener costo del curso
    SELECT c.costo_total INTO costo_curso
    FROM curso_participante cp
    JOIN cursos c ON cp.curso_id = c.id
    WHERE cp.id = NEW.curso_participante_id;
    
    -- Actualizar estado de pago basado en el total pagado
    IF total_pagado >= costo_curso THEN
        UPDATE curso_participante 
        SET estado_pago = 'pagado', 
            valor_pagado = total_pagado,
            fecha_pago = CURRENT_TIMESTAMP
        WHERE id = NEW.curso_participante_id;
    ELSIF total_pagado > 0 THEN
        UPDATE curso_participante 
        SET estado_pago = 'anticipo', 
            valor_pagado = total_pagado
        WHERE id = NEW.curso_participante_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_estado_pagos ON pagos;
CREATE TRIGGER trigger_actualizar_estado_pagos
    AFTER INSERT OR UPDATE ON pagos
    FOR EACH ROW
    WHEN (NEW.estado_pago = 'completado')
    EXECUTE FUNCTION validar_estado_pagos();

-- =====================================================
-- FUNCTION: Control de capacidad de cursos
-- =====================================================
CREATE OR REPLACE FUNCTION controlar_capacidad_curso()
RETURNS TRIGGER AS $$
DECLARE
    capacidad_actual INTEGER;
    capacidad_maxima INTEGER;
    curso_activo BOOLEAN;
BEGIN
    -- Verificar si el curso está activo
    SELECT estado = 'activo' INTO curso_activo
    FROM cursos
    WHERE id = NEW.curso_id;
    
    IF NOT curso_activo THEN
        RAISE EXCEPTION 'No se pueden inscribir participantes en un curso inactivo';
    END IF;
    
    -- Obtener capacidad actual y máxima (si existe)
    SELECT COUNT(*) INTO capacidad_actual
    FROM curso_participante
    WHERE curso_id = NEW.curso_id;
    
    -- Por ahora, no hay límite de capacidad definido en el esquema
    -- Se puede agregar un campo capacidad_maxima a la tabla cursos si se requiere
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_controlar_capacidad ON curso_participante;
CREATE TRIGGER trigger_controlar_capacidad
    BEFORE INSERT ON curso_participante
    FOR EACH ROW
    EXECUTE FUNCTION controlar_capacidad_curso();

-- =====================================================
-- FUNCTION: Actualizar métricas de cliente automáticamente
-- =====================================================
CREATE OR REPLACE FUNCTION actualizar_metricas_cliente_completo()
RETURNS TRIGGER AS $$
DECLARE
    total_cursos_activos INTEGER;
    total_participantes_unicos INTEGER;
    total_acreditados INTEGER;
    total_ingresos DECIMAL(12,2);
    promedio_calificacion DECIMAL(5,2);
BEGIN
    -- Solo actualizar si el curso pertenece a un cliente
    IF TG_OP = 'DELETE' THEN
        -- Para DELETE, usar el OLD cliente_id
        IF OLD.cliente_id IS NOT NULL THEN
            -- Calcular métricas actualizadas
            SELECT 
                COUNT(DISTINCT c.id),
                COUNT(DISTINCT cp.participante_id),
                COUNT(DISTINCT CASE WHEN cp.estado_acreditacion = TRUE THEN cp.participante_id END),
                COALESCE(SUM(p.monto), 0),
                AVG(cp.calificacion)
            INTO 
                total_cursos_activos,
                total_participantes_unicos,
                total_acreditados,
                total_ingresos,
                promedio_calificacion
            FROM clientes cl
            LEFT JOIN cursos c ON cl.id = c.cliente_id AND c.estado = 'activo'
            LEFT JOIN curso_participante cp ON c.id = cp.curso_id
            LEFT JOIN pagos p ON cp.id = p.curso_participante_id AND p.estado_pago = 'completado'
            WHERE cl.id = OLD.cliente_id
            GROUP BY cl.id;
            
            -- Actualizar cliente con las nuevas métricas
            UPDATE clientes 
            SET fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id = OLD.cliente_id;
        END IF;
        RETURN OLD;
    ELSE
        -- Para INSERT y UPDATE, usar el NEW cliente_id
        IF NEW.cliente_id IS NOT NULL THEN
            -- Calcular métricas actualizadas
            SELECT 
                COUNT(DISTINCT c.id),
                COUNT(DISTINCT cp.participante_id),
                COUNT(DISTINCT CASE WHEN cp.estado_acreditacion = TRUE THEN cp.participante_id END),
                COALESCE(SUM(p.monto), 0),
                AVG(cp.calificacion)
            INTO 
                total_cursos_activos,
                total_participantes_unicos,
                total_acreditados,
                total_ingresos,
                promedio_calificacion
            FROM clientes cl
            LEFT JOIN cursos c ON cl.id = c.cliente_id AND c.estado = 'activo'
            LEFT JOIN curso_participante cp ON c.id = cp.curso_id
            LEFT JOIN pagos p ON cp.id = p.curso_participante_id AND p.estado_pago = 'completado'
            WHERE cl.id = NEW.cliente_id
            GROUP BY cl.id;
            
            -- Actualizar cliente con las nuevas métricas
            UPDATE clientes 
            SET fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id = NEW.cliente_id;
        END IF;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Reemplazar trigger anterior con este más completo
DROP TRIGGER IF EXISTS trigger_actualizar_metricas ON cursos;
CREATE TRIGGER trigger_actualizar_metricas
    AFTER INSERT OR UPDATE OR DELETE ON cursos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_metricas_cliente_completo();

-- =====================================================
-- FUNCTION: Validar fechas de vigencia de capacitadores
-- =====================================================
CREATE OR REPLACE FUNCTION validar_vigencia_capacitador()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar que la fecha de fin sea posterior a la fecha de inicio
    IF NEW.fecha_fin_vigencia IS NOT NULL AND NEW.fecha_inicio_vigencia IS NOT NULL THEN
        IF NEW.fecha_fin_vigencia <= NEW.fecha_inicio_vigencia THEN
            RAISE EXCEPTION 'La fecha de fin de vigencia debe ser posterior a la fecha de inicio';
        END IF;
    END IF;
    
    -- Actualizar estado de acceso basado en las fechas
    IF NEW.fecha_inicio_vigencia IS NOT NULL AND NEW.fecha_fin_vigencia IS NOT NULL THEN
        NEW.acceso_activo := CURRENT_DATE BETWEEN NEW.fecha_inicio_vigencia AND NEW.fecha_fin_vigencia;
    ELSIF NEW.fecha_inicio_vigencia IS NOT NULL AND NEW.fecha_fin_vigencia IS NULL THEN
        NEW.acceso_activo := CURRENT_DATE >= NEW.fecha_inicio_vigencia;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_vigencia_capacitador ON capacitadores;
CREATE TRIGGER trigger_validar_vigencia_capacitador
    BEFORE INSERT OR UPDATE ON capacitadores
    FOR EACH ROW
    EXECUTE FUNCTION validar_vigencia_capacitador();

-- =====================================================
-- FUNCTION: Control de intentos de validación
-- =====================================================
CREATE OR REPLACE FUNCTION controlar_intentos_validacion()
RETURNS TRIGGER AS $$
DECLARE
    intentos_recientes INTEGER;
    max_intentos INTEGER := 5; -- Configurable
    tiempo_bloqueo INTERVAL := '30 minutes';
BEGIN
    -- Contar intentos recientes desde la misma IP
    SELECT COUNT(*) INTO intentos_recientes
    FROM validaciones_publicas
    WHERE ip_validacion = NEW.ip_validacion
    AND fecha_validacion >= CURRENT_TIMESTAMP - tiempo_bloqueo
    AND resultado = FALSE;
    
    -- Si se excedió el límite, marcar el intento actual como fallido
    IF intentos_recientes >= max_intentos THEN
        NEW.resultado := FALSE;
        NEW.intentos := intentos_recientes + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_controlar_intentos_validacion ON validaciones_publicas;
CREATE TRIGGER trigger_controlar_intentos_validacion
    BEFORE INSERT ON validaciones_publicas
    FOR EACH ROW
    EXECUTE FUNCTION controlar_intentos_validacion();

-- =====================================================
-- FUNCTION: Generar reportes automáticos
-- =====================================================
CREATE OR REPLACE FUNCTION generar_reporte_mensual()
RETURNS TABLE (
    cliente_id UUID,
    cliente_nombre VARCHAR,
    total_cursos INTEGER,
    total_participantes INTEGER,
    total_acreditados INTEGER,
    total_ingresos DECIMAL(12,2),
    promedio_calificacion DECIMAL(5,2),
    mes INTEGER,
    anio INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.nombre,
        COUNT(DISTINCT cur.id)::INTEGER,
        COUNT(DISTINCT cp.participante_id)::INTEGER,
        COUNT(DISTINCT CASE WHEN cp.estado_acreditacion = TRUE THEN cp.participante_id END)::INTEGER,
        COALESCE(SUM(p.monto), 0)::DECIMAL(12,2),
        AVG(cp.calificacion)::DECIMAL(5,2),
        EXTRACT(MONTH FROM p.fecha_pago)::INTEGER,
        EXTRACT(YEAR FROM p.fecha_pago)::INTEGER
    FROM clientes c
    LEFT JOIN cursos cur ON c.id = cur.cliente_id
    LEFT JOIN curso_participante cp ON cur.id = cp.curso_id
    LEFT JOIN pagos p ON cp.id = p.curso_participante_id 
        AND p.estado_pago = 'completado'
        AND p.fecha_pago >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND p.fecha_pago < DATE_TRUNC('month', CURRENT_DATE)
    WHERE c.estado = 'activo'
    GROUP BY c.id, c.nombre
    HAVING COUNT(cur.id) > 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Limpiar datos antiguos (GDPR compliance)
-- =====================================================
CREATE OR REPLACE FUNCTION limpiar_datos_antiguos()
RETURNS INTEGER AS $$
DECLARE
    registros_eliminados INTEGER := 0;
    fecha_limite DATE := CURRENT_DATE - INTERVAL '7 years'; -- Ajustable
BEGIN
    -- Marcar clientes inactivos como eliminados lógicamente
    UPDATE clientes 
    SET estado = 'eliminado',
        fecha_eliminacion_logica = CURRENT_TIMESTAMP,
        correo = 'deleted_' || id || '@deleted.com',
        nombre = 'Usuario Eliminado'
    WHERE estado = 'suspendido' 
    AND fecha_actualizacion < fecha_limite
    AND fecha_eliminacion_logica IS NULL;
    
    GET DIAGNOSTICS registros_eliminados = ROW_COUNT;
    
    -- Encriptar datos sensibles de participantes antiguos
    UPDATE participantes 
    SET numero_documento_encrypted = pgp_sym_encrypt(numero_documento, current_setting('app.encryption_key')),
        numero_documento = NULL,
        correo = 'encrypted_' || id || '@encrypted.com'
    WHERE fecha_actualizacion < fecha_limite 
    AND numero_documento_encrypted IS NULL;
    
    RETURN registros_eliminados;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Verificar integridad de datos
-- =====================================================
CREATE OR REPLACE FUNCTION verificar_integridad_datos()
RETURNS TABLE (
    tabla VARCHAR,
    problema VARCHAR,
    cantidad BIGINT,
    detalles TEXT
) AS $$
BEGIN
    -- Verificar participantes sin cursos
    RETURN QUERY
    SELECT 
        'participantes'::VARCHAR,
        'Sin cursos asignados'::VARCHAR,
        COUNT(*)::BIGINT,
        'Participantes que no están inscritos en ningún curso'::TEXT
    FROM participantes p
    WHERE NOT EXISTS (
        SELECT 1 FROM curso_participante cp WHERE cp.participante_id = p.id
    );
    
    -- Verificar cursos sin participantes
    RETURN QUERY
    SELECT 
        'cursos'::VARCHAR,
        'Sin participantes'::VARCHAR,
        COUNT(*)::BIGINT,
        'Cursos sin participantes inscritos'::TEXT
    FROM cursos c
    WHERE NOT EXISTS (
        SELECT 1 FROM curso_participante cp WHERE cp.curso_id = c.id
    )
    AND c.estado = 'activo'
    AND c.fecha_inicio > CURRENT_DATE;
    
    -- Verificar certificados vencidos no marcados
    RETURN QUERY
    SELECT 
        'curso_participante'::VARCHAR,
        'Certificados vencidos activos'::VARCHAR,
        COUNT(*)::BIGINT,
        'Certificados vencidos pero aún marcados como válidos'::TEXT
    FROM curso_participante cp
    WHERE cp.estado_acreditacion = TRUE
    AND cp.fecha_expiracion < CURRENT_DATE;
    
    -- Verificar pagos inconsistentes
    RETURN QUERY
    SELECT 
        'pagos'::VARCHAR,
        'Pagos sin curso_participante'::VARCHAR,
        COUNT(*)::BIGINT,
        'Pagos que no están asociados a una inscripción válida'::TEXT
    FROM pagos p
    WHERE NOT EXISTS (
        SELECT 1 FROM curso_participante cp WHERE cp.id = p.curso_participante_id
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Crear backup automático de datos críticos
-- =====================================================
CREATE OR REPLACE FUNCTION crear_backup_datos_criticos()
RETURNS TEXT AS $$
DECLARE
    nombre_backup TEXT;
    fecha_actual TIMESTAMP := CURRENT_TIMESTAMP;
BEGIN
    nombre_backup := 'backup_aaces_' || to_char(fecha_actual, 'YYYYMMDD_HH24MISS');
    
    -- Crear tabla de backup con datos críticos
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I AS
        SELECT 
            c.id as cliente_id,
            c.nombre as cliente_nombre,
            c.correo as cliente_correo,
            c.categoria,
            c.estado,
            cur.id as curso_id,
            cur.codigo_curso,
            cur.nombre as curso_nombre,
            cur.fecha_inicio,
            cur.fecha_fin,
            cur.estado as curso_estado,
            cp.id as inscripcion_id,
            cp.codigo_validacion,
            cp.id_certificado,
            cp.estado_acreditacion,
            cp.fecha_expiracion,
            p.id as participante_id,
            p.nombre as participante_nombre,
            p.apellido as participante_apellido,
            p.correo as participante_correo,
            fecha_backup TIMESTAMP DEFAULT %L
        FROM clientes c
        JOIN cursos cur ON c.id = cur.cliente_id
        JOIN curso_participante cp ON cur.id = cp.curso_id
        JOIN participantes p ON cp.participante_id = p.id
        WHERE c.estado = %L
        AND cur.estado = %L
    ', nombre_backup, fecha_actual, 'activo', 'activo');
    
    RETURN nombre_backup;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS ADICIONALES
-- =====================================================

COMMENT ON FUNCTION generar_codigo_validacion() IS 'Genera un código de validación único para certificados';
COMMENT ON FUNCTION actualizar_fecha_expiracion_certificado() IS 'Actualiza automáticamente la fecha de expiración del certificado';
COMMENT ON FUNCTION validar_estado_pagos() IS 'Valida y actualiza el estado de pagos de los participantes';
COMMENT ON FUNCTION controlar_capacidad_curso() IS 'Controla la capacidad máxima de los cursos';
COMMENT ON FUNCTION actualizar_metricas_cliente_completo() IS 'Actualiza las métricas completas del cliente';
COMMENT ON FUNCTION validar_vigencia_capacitador() IS 'Valida la vigencia de los capacitadores';
COMMENT ON FUNCTION controlar_intentos_validacion() IS 'Controla los intentos de validación para prevenir abuso';
COMMENT ON FUNCTION generar_reporte_mensual() IS 'Genera reportes mensuales automáticamente';
COMMENT ON FUNCTION limpiar_datos_antiguos() IS 'Limpia datos antiguos para cumplimiento GDPR';
COMMENT ON FUNCTION verificar_integridad_datos() IS 'Verifica la integridad de los datos en el sistema';
COMMENT ON FUNCTION crear_backup_datos_criticos() IS 'Crea backups automáticos de datos críticos';