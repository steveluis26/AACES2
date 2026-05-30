-- =============================================
-- ESQUEMA MEJORADO AACES - MIGRACIÓN COMPLETA
-- =============================================

-- 1. EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLA CLIENTES - SEGURIDAD Y COMPLIANCE
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
  intentos_fallidos INTEGER DEFAULT 0,
  bloqueado_hasta TIMESTAMP WITH TIME ZONE,
  acepta_terminos BOOLEAN DEFAULT FALSE,
  fecha_acepta_terminos TIMESTAMP WITH TIME ZONE,
  datos_procesados BOOLEAN DEFAULT TRUE,
  fecha_eliminacion_logica TIMESTAMP WITH TIME ZONE
);

-- Índices clientes
CREATE INDEX IF NOT EXISTS idx_clientes_correo ON clientes(correo);
CREATE INDEX IF NOT EXISTS idx_clientes_categoria ON clientes(categoria);
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);
CREATE INDEX IF NOT EXISTS idx_clientes_fecha_creacion ON clientes(fecha_creacion);

-- 3. TABLA CAPACITADORES - GESTIÓN DE ACCESO
CREATE TABLE IF NOT EXISTS capacitadores ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL, 
  correo VARCHAR(255),
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

-- Índices capacitadores
CREATE INDEX IF NOT EXISTS idx_capacitadores_cliente_id ON capacitadores(cliente_id);
CREATE INDEX IF NOT EXISTS idx_capacitadores_correo ON capacitadores(correo);
CREATE INDEX IF NOT EXISTS idx_capacitadores_estado_pago ON capacitadores(estado_pago);
CREATE INDEX IF NOT EXISTS idx_capacitadores_acceso_activo ON capacitadores(acceso_activo);

-- 4. TABLA CURSOS - OPTIMIZACIÓN DE CONSULTAS
CREATE TABLE IF NOT EXISTS cursos ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES cursos(id) ON DELETE CASCADE,
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
  moneda VARCHAR(3) DEFAULT 'USD',
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

-- Índices cursos
CREATE INDEX IF NOT EXISTS idx_cursos_cliente_id ON cursos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cursos_codigo_curso ON cursos(codigo_curso);
CREATE INDEX IF NOT EXISTS idx_cursos_fechas ON cursos(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_cursos_estado ON cursos(estado);
CREATE INDEX IF NOT EXISTS idx_cursos_ciudad ON cursos(ciudad);
CREATE INDEX IF NOT EXISTS idx_cursos_capacitador_id ON cursos(capacitador_id);

-- 5. TABLA PARTICIPANTES - NORMALIZACIÓN
CREATE TABLE IF NOT EXISTS participantes ( 
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento VARCHAR(20) CHECK (tipo_documento IN ('DNI', 'PASAPORTE', 'CEDULA', 'OTRO')),
  numero_documento VARCHAR(50) UNIQUE,
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
  pais VARCHAR(50) DEFAULT 'Ecuador',
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices participantes
CREATE INDEX IF NOT EXISTS idx_participantes_documento ON participantes(numero_documento);
CREATE INDEX IF NOT EXISTS idx_participantes_correo ON participantes(correo);
CREATE INDEX IF NOT EXISTS idx_participantes_nombre ON participantes(nombre, apellido);

-- 6. TABLA CURSO_PARTICIPANTE - MEJORAS DE INTEGRIDAD
CREATE TABLE IF NOT EXISTS curso_participante ( 
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

-- Índices curso_participante
CREATE INDEX IF NOT EXISTS idx_curso_participante_curso_id ON curso_participante(curso_id);
CREATE INDEX IF NOT EXISTS idx_curso_participante_participante_id ON curso_participante(participante_id);
CREATE INDEX IF NOT EXISTS idx_curso_participante_certificado ON curso_participante(id_certificado);
CREATE INDEX IF NOT EXISTS idx_curso_participante_validacion ON curso_participante(codigo_validacion);
CREATE INDEX IF NOT EXISTS idx_curso_participante_estado_acreditacion ON curso_participante(estado_acreditacion);
CREATE INDEX IF NOT EXISTS idx_curso_participante_fechas ON curso_participante(fecha_inicio_vigencia, fecha_expiracion);

-- 7. TABLA PAGOS - NUEVA TABLA PARA TRAZABILIDAD FINANCIERA
CREATE TABLE IF NOT EXISTS pagos (
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

-- Índices pagos
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_id ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_curso_participante_id ON pagos(curso_participante_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON pagos(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado_pago);

-- 8. TABLA VALIDACIONES_PUBLICAS - TRAZABILIDAD DE VALIDACIONES
CREATE TABLE IF NOT EXISTS validaciones_publicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_validacion VARCHAR(20) REFERENCES curso_participante(codigo_validacion),
  fecha_validacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_validacion INET,
  user_agent TEXT,
  resultado BOOLEAN DEFAULT TRUE,
  intentos INTEGER DEFAULT 1,
  UNIQUE(codigo_validacion, ip_validacion)
);

-- Índices validaciones_publicas
CREATE INDEX IF NOT EXISTS idx_validaciones_codigo ON validaciones_publicas(codigo_validacion);
CREATE INDEX IF NOT EXISTS idx_validaciones_fecha ON validaciones_publicas(fecha_validacion);

-- 9. TABLA PANEL_MAESTRO_METRICA - MÉTRICAS AGREGADAS
CREATE TABLE IF NOT EXISTS panel_maestro_metrica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  cursos_registrados INTEGER DEFAULT 0,
  participantes_totales INTEGER DEFAULT 0,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_panel_metrica_cliente_id ON panel_maestro_metrica(cliente_id);

-- 10. TABLA AUDITORIA_CAMBIOS - REGISTRO DE CAMBIOS
CREATE TABLE IF NOT EXISTS auditoria_cambios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_nombre VARCHAR(50),
  operacion VARCHAR(10),
  usuario_id UUID,
  fecha_cambio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  datos_anteriores JSONB,
  datos_nuevos JSONB
);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria_cambios(tabla_nombre);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria_cambios(fecha_cambio);

-- =============================================
-- FUNCIONES Y TRIGGERS
-- =============================================

-- 1. FUNCIÓN PARA GENERAR CÓDIGO DE VALIDACIÓN ÚNICO
CREATE OR REPLACE FUNCTION generar_codigo_validacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo_validacion IS NULL THEN
    NEW.codigo_validacion := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para código de validación
CREATE TRIGGER trigger_generar_codigo_validacion
  BEFORE INSERT ON curso_participante
  FOR EACH ROW
  EXECUTE FUNCTION generar_codigo_validacion();

-- 2. FUNCIÓN PARA ACTUALIZAR MÉTRICAS DEL CLIENTE
CREATE OR REPLACE FUNCTION actualizar_metricas_cliente()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE panel_maestro_metrica 
  SET 
    cursos_registrados = (SELECT COUNT(*) FROM cursos WHERE cliente_id = NEW.cliente_id AND estado = 'activo'),
    participantes_totales = (SELECT COUNT(DISTINCT participante_id) FROM curso_participante cp JOIN cursos c ON cp.curso_id = c.id WHERE c.cliente_id = NEW.cliente_id),
    fecha_actualizacion = CURRENT_TIMESTAMP
  WHERE cliente_id = NEW.cliente_id;
  
  IF NOT FOUND THEN
    INSERT INTO panel_maestro_metrica (cliente_id, cursos_registrados, participantes_totales)
    VALUES (NEW.cliente_id, 1, 0);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar métricas
CREATE TRIGGER trigger_actualizar_metricas
  AFTER INSERT OR UPDATE ON cursos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_metricas_cliente();

-- 3. FUNCIÓN PARA AUDITORÍA DE CAMBIOS
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

-- Trigger de auditoría para clientes
CREATE TRIGGER trigger_auditar_clientes
  AFTER UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION auditar_cambios();

-- =============================================
-- USUARIOS DE PRUEBA FUNCIONALES
-- =============================================

-- Insertar usuarios de prueba con contraseñas encriptadas
-- Contraseña: admin123 (encriptada con bcrypt)
INSERT INTO clientes (nombre, correo, password_hash, ciudad_base, categoria, estado, acepta_terminos, fecha_acepta_terminos)
VALUES (
  'Administrador AACES',
  'admin@aaces.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- admin123
  'Quito',
  'enterprise',
  'activo',
  true,
  CURRENT_TIMESTAMP
);

-- Contraseña: cliente123 (encriptada con bcrypt)
INSERT INTO clientes (nombre, correo, password_hash, ciudad_base, categoria, estado, acepta_terminos, fecha_acepta_terminos)
VALUES (
  'Cliente de Prueba',
  'cliente1@example.com',
  '$2b$10$gIVMMWc3N3dIVKjJdOJ5.e.7rK8y3vQ6o9XqXqXqXqXqXqXqXqXq', -- cliente123
  'Guayaquil',
  'premium',
  'activo',
  true,
  CURRENT_TIMESTAMP
);

-- =============================================
-- DATOS DE PRUEBA INICIALES
-- =============================================

-- Insertar algunos participantes de prueba
INSERT INTO participantes (tipo_documento, numero_documento, nombre, apellido, correo, telefono, ciudad_origen, empresa, cargo)
VALUES 
  ('DNI', '1234567890', 'Juan', 'Pérez', 'juan.perez@empresa.com', '0991234567', 'Quito', 'Empresa ABC', 'Gerente de Ventas'),
  ('DNI', '0987654321', 'María', 'González', 'maria.gonzalez@empresa.com', '0987654321', 'Guayaquil', 'Empresa XYZ', 'Supervisora'),
  ('PASAPORTE', 'A12345678', 'Carlos', 'Rodríguez', 'carlos.rodriguez@empresa.com', '0976543210', 'Cuenca', 'Empresa 123', 'Coordinador');

-- Insertar un capacitador de prueba
INSERT INTO capacitadores (nombre, correo, telefono, cliente_id, fecha_inicio_vigencia, estado_pago, acceso_activo, especialidad)
VALUES (
  'Dr. Roberto Sánchez',
  'roberto.sanchez@capacitador.com',
  '0998765432',
  (SELECT id FROM clientes WHERE correo = 'admin@aaces.com'),
  CURRENT_DATE,
  'pagado',
  true,
  'Seguridad Industrial'
);

-- Insertar un curso de prueba
INSERT INTO cursos (cliente_id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, duracion_horas, modalidad, capacitador_id, duracion_validacion, costo_total, estado, descripcion, objetivos)
VALUES (
  (SELECT id FROM clientes WHERE correo = 'admin@aaces.com'),
  'CUR-2024-001',
  'Curso de Seguridad Industrial Básica',
  'Quito',
  CURRENT_DATE + INTERVAL '7 days',
  CURRENT_DATE + INTERVAL '9 days',
  40,
  'presencial',
  (SELECT id FROM capacitadores LIMIT 1),
  12,
  1500.00,
  'activo',
  'Curso intensivo de seguridad industrial para trabajadores',
  'Capacitar a los participantes en normas básicas de seguridad industrial'
);

-- Relacionar participantes con el curso
INSERT INTO curso_participante (curso_id, participante_id, estado_pago, valor_pagado, fecha_pago, fecha_inicio_vigencia, fecha_expiracion, estado_acreditacion, calificacion, asistencia)
SELECT 
  c.id as curso_id,
  p.id as participante_id,
  'pagado',
  500.00,
  CURRENT_TIMESTAMP,
  c.fecha_inicio,
  c.fecha_inicio + INTERVAL '12 months',
  true,
  85.50,
  95.00
FROM cursos c, participantes p
WHERE c.codigo_curso = 'CUR-2024-001';

-- =============================================
-- PERMISOS Y SEGURIDAD
-- =============================================

-- Habilitar Row Level Security (RLS) en tablas críticas
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_participante ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacitadores ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad básicas
CREATE POLICY IF NOT EXISTS clientes_cliente_policy ON clientes
  FOR ALL TO app_user
  USING (id = current_setting('app.current_client_id')::UUID);

CREATE POLICY IF NOT EXISTS cursos_cliente_policy ON cursos
  FOR ALL TO app_user
  USING (cliente_id = current_setting('app.current_client_id')::UUID);

CREATE POLICY IF NOT EXISTS curso_participante_cliente_policy ON curso_participante
  FOR ALL TO app_user
  USING (
    curso_id IN (
      SELECT id FROM cursos 
      WHERE cliente_id = current_setting('app.current_client_id')::UUID
    )
  );

-- =============================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =============================================

COMMENT ON TABLE clientes IS 'Tabla de clientes del sistema AACES con información de autenticación y perfil';
COMMENT ON TABLE capacitadores IS 'Tabla de capacitadores registrados en el sistema';
COMMENT ON TABLE cursos IS 'Tabla de cursos programados por los clientes';
COMMENT ON TABLE participantes IS 'Tabla de participantes de cursos (personas que reciben capacitación)';
COMMENT ON TABLE curso_participante IS 'Tabla de relación entre cursos y participantes con información de certificación';
COMMENT ON TABLE pagos IS 'Tabla de registro de pagos realizados';
COMMENT ON TABLE validaciones_publicas IS 'Registro de validaciones públicas de certificados';
COMMENT ON TABLE panel_maestro_metrica IS 'Métricas agregadas por cliente para dashboard';
COMMENT ON TABLE auditoria_cambios IS 'Registro de cambios en tablas críticas para auditoría';

-- =============================================
-- VERIFICACIÓN DE LA MIGRACIÓN
-- =============================================

-- Verificar que las tablas se crearon correctamente
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('clientes', 'capacitadores', 'cursos', 'participantes', 'curso_participante', 'pagos', 'validaciones_publicas', 'panel_maestro_metrica', 'auditoria_cambios')
ORDER BY table_name;

-- Verificar usuarios de prueba
SELECT nombre, correo, categoria, estado 
FROM clientes 
WHERE correo IN ('admin@aaces.com', 'cliente1@example.com')
ORDER BY correo;
