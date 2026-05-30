-- =============================================
-- ESQUEMA COMPLETO AACES - MIGRACIÓN INICIAL
-- =============================================

-- 1. EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLA CLIENTES (USUARIOS DEL SISTEMA)
CREATE TABLE clientes ( 
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
  intentos_fallidos INTEGER DEFAULT 0,
  bloqueado_hasta TIMESTAMP WITH TIME ZONE,
  acepta_terminos BOOLEAN DEFAULT FALSE,
  fecha_acepta_terminos TIMESTAMP WITH TIME ZONE,
  datos_procesados BOOLEAN DEFAULT TRUE,
  fecha_eliminacion_logica TIMESTAMP WITH TIME ZONE
);

-- 3. TABLA CAPACITADORES
CREATE TABLE capacitadores ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL, 
  correo VARCHAR(255) UNIQUE,
  telefono VARCHAR(20),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  fecha_inicio_vigencia DATE,
  fecha_fin_vigencia DATE,
  estado_pago VARCHAR(20) DEFAULT 'pendiente' CHECK (estado_pago IN ('pagado', 'vencido', 'pendiente', 'cancelado')),
  acceso_activo BOOLEAN DEFAULT FALSE,
  documento_identidad VARCHAR(50),
  especialidad VARCHAR(100),
  nivel_certificacion VARCHAR(50),
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  creado_por UUID REFERENCES clientes(id),
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  actualizado_por UUID REFERENCES clientes(id)
);

-- 4. TABLA CURSOS
CREATE TABLE cursos ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  codigo_curso VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(200) NOT NULL, 
  ciudad VARCHAR(100) NOT NULL, 
  fecha_inicio DATE NOT NULL, 
  fecha_fin DATE NOT NULL,
  duracion_horas INTEGER NOT NULL CHECK (duracion_horas > 0),
  modalidad VARCHAR(20) CHECK (modalidad IN ('presencial', 'virtual', 'mixta')),
  capacitador_id UUID REFERENCES capacitadores(id),
  duracion_validacion INTEGER,
  costo_total DECIMAL(10,2),
  moneda VARCHAR(3) DEFAULT 'MXN',
  estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado', 'en_espera', 'cancelado')),
  empresa_contratante VARCHAR(200),
  descripcion TEXT,
  objetivos TEXT,
  requisitos TEXT,
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  creado_por UUID REFERENCES clientes(id),
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  actualizado_por UUID REFERENCES clientes(id)
);

-- 5. TABLA PARTICIPANTES
CREATE TABLE participantes ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apellido_paterno VARCHAR(100),
  apellido_materno VARCHAR(100),
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
  direccion TEXT,
  codigo_postal VARCHAR(20),
  pais VARCHAR(50) DEFAULT 'Mexico',
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABLA CURSO_PARTICIPANTE (RELACIÓN MUCHOS A MUCHOS)
CREATE TABLE curso_participante ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id UUID REFERENCES cursos(id) ON DELETE CASCADE,
  participante_id UUID REFERENCES participantes(id) ON DELETE CASCADE,
  estado_pago VARCHAR(20) CHECK (estado_pago IN ('pagado', 'anticipo', 'pendiente', 'cancelado')),
  valor_pagado DECIMAL(10,2) DEFAULT 0,
  fecha_pago TIMESTAMP WITH TIME ZONE,
  fecha_participacion DATE,
  fecha_inicio_vigencia DATE,
  fecha_expiracion DATE,
  id_certificado VARCHAR(50) UNIQUE,
  codigo_validacion VARCHAR(20) UNIQUE,
  estado_acreditacion BOOLEAN DEFAULT FALSE,
  calificacion DECIMAL(5,2) CHECK (calificacion >= 0 AND calificacion <= 100),
  asistencia DECIMAL(5,2) DEFAULT 0 CHECK (asistencia >= 0 AND asistencia <= 100),
  observaciones TEXT,
  certificado_url TEXT,
  fecha_emision_certificado TIMESTAMP WITH TIME ZONE,
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  creado_por UUID REFERENCES clientes(id),
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  actualizado_por UUID REFERENCES clientes(id),
  UNIQUE(curso_id, participante_id)
);

-- 7. TABLA PAGOS
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id),
  curso_participante_id UUID REFERENCES curso_participante(id) ON DELETE CASCADE,
  tipo_pago VARCHAR(30) CHECK (tipo_pago IN ('participante', 'capacitador', 'curso_completo')),
  monto DECIMAL(10,2) NOT NULL,
  moneda VARCHAR(3) DEFAULT 'USD',
  metodo_pago VARCHAR(50) CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'paypal', 'otro')),
  referencia_pago VARCHAR(100),
  fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  estado_pago VARCHAR(20) DEFAULT 'completado' CHECK (estado_pago IN ('pendiente', 'completado', 'fallido', 'reembolsado')),
  comprobante_url TEXT,
  notas TEXT,
  creado_por UUID REFERENCES clientes(id),
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLA VALIDACIONES PUBLICAS
CREATE TABLE validaciones_publicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_validacion VARCHAR(20) REFERENCES curso_participante(codigo_validacion),
  fecha_validacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_validacion INET,
  user_agent TEXT,
  resultado BOOLEAN DEFAULT TRUE,
  intentos INTEGER DEFAULT 1,
  UNIQUE(codigo_validacion, ip_validacion)
);

-- 9. TABLA PANEL_MAESTRO_METRICA
CREATE TABLE panel_maestro_metrica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  cursos_registrados INTEGER DEFAULT 0,
  participantes_totales INTEGER DEFAULT 0,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cliente_id)
);

-- 10. TABLA AUDITORIA_CAMBIOS
CREATE TABLE auditoria_cambios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_nombre VARCHAR(50),
  operacion VARCHAR(10),
  usuario_id UUID,
  fecha_cambio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  datos_anteriores JSONB,
  datos_nuevos JSONB
);

-- =============================================
-- ÍNDICES PARA OPTIMIZACIÓN DE CONSULTAS
-- =============================================

-- Índices para clientes
CREATE INDEX idx_clientes_correo ON clientes(correo);
CREATE INDEX idx_clientes_categoria ON clientes(categoria);
CREATE INDEX idx_clientes_estado ON clientes(estado);
CREATE INDEX idx_clientes_fecha_creacion ON clientes(fecha_creacion);

-- Índices para capacitadores
CREATE INDEX idx_capacitadores_cliente_id ON capacitadores(cliente_id);
CREATE INDEX idx_capacitadores_correo ON capacitadores(correo);
CREATE INDEX idx_capacitadores_estado_pago ON capacitadores(estado_pago);
CREATE INDEX idx_capacitadores_acceso_activo ON capacitadores(acceso_activo);

-- Índices para cursos
CREATE INDEX idx_cursos_cliente_id ON cursos(cliente_id);
CREATE INDEX idx_cursos_codigo_curso ON cursos(codigo_curso);
CREATE INDEX idx_cursos_fechas ON cursos(fecha_inicio, fecha_fin);
CREATE INDEX idx_cursos_estado ON cursos(estado);
CREATE INDEX idx_cursos_ciudad ON cursos(ciudad);
CREATE INDEX idx_cursos_capacitador_id ON cursos(capacitador_id);

-- Índices para participantes
-- Eliminado índice de documento; no se usa
CREATE INDEX idx_participantes_correo ON participantes(correo);
CREATE INDEX idx_participantes_nombre ON participantes(nombre, apellido);

-- Índices para curso_participante
CREATE INDEX idx_curso_participante_curso_id ON curso_participante(curso_id);
CREATE INDEX idx_curso_participante_participante_id ON curso_participante(participante_id);
CREATE INDEX idx_curso_participante_certificado ON curso_participante(id_certificado);
CREATE INDEX idx_curso_participante_validacion ON curso_participante(codigo_validacion);
CREATE INDEX idx_curso_participante_estado_acreditacion ON curso_participante(estado_acreditacion);
CREATE INDEX idx_curso_participante_fechas ON curso_participante(fecha_inicio_vigencia, fecha_expiracion);

-- Índices para pagos
CREATE INDEX idx_pagos_cliente_id ON pagos(cliente_id);
CREATE INDEX idx_pagos_curso_participante_id ON pagos(curso_participante_id);
CREATE INDEX idx_pagos_fecha_pago ON pagos(fecha_pago);
CREATE INDEX idx_pagos_estado ON pagos(estado_pago);

-- Índices para validaciones
CREATE INDEX idx_validaciones_codigo ON validaciones_publicas(codigo_validacion);
CREATE INDEX idx_validaciones_fecha ON validaciones_publicas(fecha_validacion);

-- =============================================
-- FUNCIONES Y TRIGGERS
-- =============================================

-- 1. Trigger para generar código de validación único
CREATE OR REPLACE FUNCTION generar_codigo_validacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo_validacion IS NULL THEN
    NEW.codigo_validacion := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generar_codigo_validacion
  BEFORE INSERT ON curso_participante
  FOR EACH ROW
  EXECUTE FUNCTION generar_codigo_validacion();

-- 2. Trigger para actualizar fecha de actualización
CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_cliente_fecha
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_fecha_actualizacion();

CREATE TRIGGER trigger_actualizar_capacitador_fecha
  BEFORE UPDATE ON capacitadores
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_fecha_actualizacion();

CREATE TRIGGER trigger_actualizar_curso_fecha
  BEFORE UPDATE ON cursos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_fecha_actualizacion();

CREATE TRIGGER trigger_actualizar_participante_fecha
  BEFORE UPDATE ON participantes
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_fecha_actualizacion();

CREATE TRIGGER trigger_actualizar_curso_participante_fecha
  BEFORE UPDATE ON curso_participante
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_fecha_actualizacion();

-- 3. Trigger para actualizar métricas del cliente
CREATE OR REPLACE FUNCTION actualizar_metricas_cliente()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE panel_maestro_metrica 
  SET 
    cursos_registrados = (SELECT COUNT(*) FROM cursos WHERE cliente_id = NEW.cliente_id AND estado = 'activo'),
    participantes_totales = (SELECT COUNT(DISTINCT cp.participante_id) FROM curso_participante cp JOIN cursos c ON cp.curso_id = c.id WHERE c.cliente_id = NEW.cliente_id),
    fecha_actualizacion = CURRENT_TIMESTAMP
  WHERE cliente_id = NEW.cliente_id;
  
  IF NOT FOUND THEN
    INSERT INTO panel_maestro_metrica (cliente_id, cursos_registrados, participantes_totales)
    VALUES (NEW.cliente_id, 1, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_metricas
  AFTER INSERT OR UPDATE ON cursos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_metricas_cliente();

-- 4. Trigger para auditoría de cambios
CREATE OR REPLACE FUNCTION auditar_cambios()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO auditoria_cambios (tabla_nombre, operacion, usuario_id, datos_anteriores, datos_nuevos)
    VALUES (TG_TABLE_NAME, 'UPDATE', current_setting('app.current_user_id')::UUID, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO auditoria_cambios (tabla_nombre, operacion, usuario_id, datos_anteriores)
    VALUES (TG_TABLE_NAME, 'DELETE', current_setting('app.current_user_id')::UUID, row_to_json(OLD));
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar auditoría a tablas críticas
CREATE TRIGGER trigger_auditar_clientes
  AFTER UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION auditar_cambios();

-- =============================================
-- VISTAS MATERIALIZADAS PARA REPORTES
-- =============================================

CREATE MATERIALIZED VIEW mv_resumen_cliente AS
SELECT 
  c.id as cliente_id,
  c.nombre as cliente_nombre,
  COUNT(DISTINCT cur.id) as total_cursos,
  COUNT(DISTINCT cp.participante_id) as total_participantes,
  COUNT(DISTINCT CASE WHEN cp.estado_acreditacion = true THEN cp.participante_id END) as total_acreditados,
  SUM(CASE WHEN p.estado_pago = 'completado' THEN p.monto ELSE 0 END) as total_ingresos,
  AVG(cp.calificacion) as promedio_calificaciones
FROM clientes c
LEFT JOIN cursos cur ON c.id = cur.cliente_id
LEFT JOIN curso_participante cp ON cur.id = cp.curso_id
LEFT JOIN pagos p ON cp.id = p.curso_participante_id
WHERE c.estado = 'activo'
GROUP BY c.id, c.nombre;

CREATE INDEX idx_mv_resumen_cliente ON mv_resumen_cliente(cliente_id);

-- =============================================
-- INSERCIÓN DE USUARIOS DE PRUEBA
-- =============================================

-- Usuario Admin (con contraseña encriptada)
INSERT INTO clientes (
  nombre, 
  correo, 
  password_hash, 
  ciudad_base, 
  categoria, 
  estado,
  acepta_terminos,
  fecha_acepta_terminos
) VALUES (
  'Administrador AACES',
  'admin@aaces.com',
  crypt('admin123', gen_salt('bf', 12)),
  'Quito',
  'enterprise',
  'activo',
  true,
  CURRENT_TIMESTAMP
);

-- Usuario Cliente (con contraseña encriptada)
INSERT INTO clientes (
  nombre, 
  correo, 
  password_hash, 
  ciudad_base, 
  categoria, 
  estado,
  acepta_terminos,
  fecha_acepta_terminos
) VALUES (
  'Cliente de Prueba',
  'cliente1@example.com',
  crypt('cliente123', gen_salt('bf', 12)),
  'Guayaquil',
  'premium',
  'activo',
  true,
  CURRENT_TIMESTAMP
);

-- =============================================
-- DATOS DE PRUEBA INICIALES
-- =============================================

-- Insertar algunos participantes de ejemplo
INSERT INTO participantes (tipo_documento, numero_documento, nombre, apellido, correo, telefono, ciudad_origen) VALUES
('DNI', '1234567890', 'Juan', 'Pérez', 'juan.perez@empresa.com', '0991234567', 'Quito'),
('DNI', '0987654321', 'María', 'González', 'maria.gonzalez@empresa.com', '0987654321', 'Guayaquil'),
('DNI', '1122334455', 'Carlos', 'Rodríguez', 'carlos.rodriguez@empresa.com', '0977889900', 'Cuenca');

-- Insertar un capacitador de ejemplo
INSERT INTO capacitadores (nombre, correo, telefono, cliente_id, especialidad, acceso_activo) VALUES
('Dr. Roberto Sánchez', 'roberto.sanchez@capacitador.com', '0998877665', 
 (SELECT id FROM clientes WHERE correo = 'admin@aaces.com'), 'Seguridad Industrial', true);

-- Insertar un curso de ejemplo
INSERT INTO cursos (cliente_id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, duracion_horas, modalidad, capacitador_id, descripcion) VALUES
(
  (SELECT id FROM clientes WHERE correo = 'admin@aaces.com'),
  'SEG-2024-001',
  'Curso de Seguridad Industrial Básica',
  'Quito',
  '2024-01-15',
  '2024-01-19',
  40,
  'presencial',
  (SELECT id FROM capacitadores WHERE correo = 'roberto.sanchez@capacitador.com'),
  'Curso intensivo de seguridad industrial para trabajadores de planta'
);

-- Relacionar participantes con el curso
INSERT INTO curso_participante (curso_id, participante_id, estado_pago, valor_pagado, estado_acreditacion, calificacion, asistencia) VALUES
(
  (SELECT id FROM cursos WHERE codigo_curso = 'SEG-2024-001'),
  (SELECT id FROM participantes WHERE numero_documento = '1234567890'),
  'pagado',
  150.00,
  true,
  95.50,
  100
),
(
  (SELECT id FROM cursos WHERE codigo_curso = 'SEG-2024-001'),
  (SELECT id FROM participantes WHERE numero_documento = '0987654321'),
  'pagado',
  150.00,
  true,
  88.00,
  95
);

-- =============================================
-- PERMISOS Y SEGURIDAD
-- =============================================

-- Habilitar Row Level Security (RLS) en tablas críticas
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_participante ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacitadores ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad básicas
CREATE POLICY cursos_cliente_policy ON cursos
  FOR ALL TO public
  USING (cliente_id = current_setting('app.current_client_id')::UUID);

CREATE POLICY curso_participante_cliente_policy ON curso_participante
  FOR ALL TO public
  USING (
    curso_id IN (
      SELECT id FROM cursos 
      WHERE cliente_id = current_setting('app.current_client_id')::UUID
    )
  );

-- =============================================
-- REFRESH MATERIALIZED VIEWS
-- =============================================

REFRESH MATERIALIZED VIEW mv_resumen_cliente;

-- =============================================
-- VERIFICACIÓN DE LA INSTALACIÓN
-- =============================================

-- Verificar que las tablas se crearon correctamente
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Verificar que los usuarios de prueba se crearon
SELECT nombre, correo, categoria, estado 
FROM clientes 
ORDER BY fecha_creacion;
