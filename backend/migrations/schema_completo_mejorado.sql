-- =============================================
-- ESQUEMA COMPLETO AACES - VERSIÓN MEJORADA
-- =============================================

-- 1. EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLA CLIENTES (USUARIOS PRINCIPALES)
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

-- Índices para clientes
CREATE INDEX idx_clientes_correo ON clientes(correo);
CREATE INDEX idx_clientes_categoria ON clientes(categoria);
CREATE INDEX idx_clientes_estado ON clientes(estado);
CREATE INDEX idx_clientes_fecha_creacion ON clientes(fecha_creacion);

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

-- Índices para capacitadores
CREATE INDEX idx_capacitadores_cliente_id ON capacitadores(cliente_id);
CREATE INDEX idx_capacitadores_correo ON capacitadores(correo);
CREATE INDEX idx_capacitadores_estado_pago ON capacitadores(estado_pago);
CREATE INDEX idx_capacitadores_acceso_activo ON capacitadores(acceso_activo);

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

-- Índices para cursos
CREATE INDEX idx_cursos_cliente_id ON cursos(cliente_id);
CREATE INDEX idx_cursos_codigo_curso ON cursos(codigo_curso);
CREATE INDEX idx_cursos_fechas ON cursos(fecha_inicio, fecha_fin);
CREATE INDEX idx_cursos_estado ON cursos(estado);
CREATE INDEX idx_cursos_ciudad ON cursos(ciudad);
CREATE INDEX idx_cursos_capacitador_id ON cursos(capacitador_id);

-- 5. TABLA PARTICIPANTES
CREATE TABLE participantes ( 
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

-- Índices para participantes
CREATE INDEX idx_participantes_documento ON participantes(numero_documento);
CREATE INDEX idx_participantes_correo ON participantes(correo);
CREATE INDEX idx_participantes_nombre ON participantes(nombre, apellido);

-- 6. TABLA CURSO_PARTICIPANTE
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

-- Índices para curso_participante
CREATE INDEX idx_curso_participante_curso_id ON curso_participante(curso_id);
CREATE INDEX idx_curso_participante_participante_id ON curso_participante(participante_id);
CREATE INDEX idx_curso_participante_certificado ON curso_participante(id_certificado);
CREATE INDEX idx_curso_participante_validacion ON curso_participante(codigo_validacion);
CREATE INDEX idx_curso_participante_estado_acreditacion ON curso_participante(estado_acreditacion);
CREATE INDEX idx_curso_participante_fechas ON curso_participante(fecha_inicio_vigencia, fecha_expiracion);

-- 7. TABLA PAGOS
CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id),
  curso_participante_id UUID REFERENCES curso_participante(id),
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

-- Índices para pagos
CREATE INDEX idx_pagos_cliente_id ON pagos(cliente_id);
CREATE INDEX idx_pagos_curso_participante_id ON pagos(curso_participante_id);
CREATE INDEX idx_pagos_fecha_pago ON pagos(fecha_pago);
CREATE INDEX idx_pagos_estado ON pagos(estado_pago);

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

-- Índices para validaciones_publicas
CREATE INDEX idx_validaciones_codigo ON validaciones_publicas(codigo_validacion);
CREATE INDEX idx_validaciones_fecha ON validaciones_publicas(fecha_validacion);

-- 9. FUNCIONES Y TRIGGERS

-- Función para generar código de validación único
CREATE OR REPLACE FUNCTION generar_codigo_validacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo_validacion IS NULL THEN
    NEW.codigo_validacion := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para generar código de validación
CREATE TRIGGER trigger_generar_codigo_validacion
  BEFORE INSERT ON curso_participante
  FOR EACH ROW
  EXECUTE FUNCTION generar_codigo_validacion();

-- 10. TABLA DE AUDITORÍA
CREATE TABLE auditoria_cambios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_nombre VARCHAR(50),
  operacion VARCHAR(10),
  usuario_id UUID,
  fecha_cambio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  datos_anteriores JSONB,
  datos_nuevos JSONB
);

-- Función para auditoría de cambios
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

-- 11. INSERTAR USUARIOS DE PRUEBA CON CONTRASEÑAS ENCRIPTADAS

-- Contraseñas encriptadas con bcrypt
-- admin123 -> $2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
-- cliente123 -> $2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi

INSERT INTO clientes (
  nombre, 
  correo, 
  password_hash, 
  ciudad_base, 
  categoria, 
  estado,
  acepta_terminos,
  fecha_acepta_terminos
) VALUES 
(
  'Administrador AACES',
  'admin@aaces.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Quito',
  'enterprise',
  'activo',
  true,
  CURRENT_TIMESTAMP
),
(
  'Cliente de Prueba',
  'cliente1@example.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Guayaquil',
  'premium',
  'activo',
  true,
  CURRENT_TIMESTAMP
);

-- 12. INSERTAR DATOS DE PRUEBA ADICIONALES

-- Capacitadores de prueba
INSERT INTO capacitadores (nombre, correo, telefono, cliente_id, fecha_inicio_vigencia, acceso_activo, especialidad, creado_por, actualizado_por) VALUES
('Dr. Juan Pérez', 'juan.perez@example.com', '0999999999', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com'), '2024-01-01', true, 'Seguridad Industrial', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com'), (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),
('Dra. María González', 'maria.gonzalez@example.com', '0988888888', (SELECT id FROM clientes WHERE correo = 'cliente1@example.com'), '2024-01-01', true, 'Salud Ocupacional', (SELECT id FROM clientes WHERE correo = 'cliente1@example.com'), (SELECT id FROM clientes WHERE correo = 'cliente1@example.com'));

-- Cursos de prueba
INSERT INTO cursos (cliente_id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, duracion_horas, modalidad, capacitador_id, creado_por, actualizado_por) VALUES
((SELECT id FROM clientes WHERE correo = 'admin@aaces.com'), 'CUR-001-2024', 'Curso de Seguridad en Alturas', 'Quito', '2024-02-01', '2024-02-05', 40, 'presencial', (SELECT id FROM capacitadores WHERE correo = 'juan.perez@example.com'), (SELECT id FROM clientes WHERE correo = 'admin@aaces.com'), (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),
((SELECT id FROM clientes WHERE correo = 'cliente1@example.com'), 'CUR-002-2024', 'Curso de Primeros Auxilios', 'Guayaquil', '2024-03-01', '2024-03-03', 24, 'virtual', (SELECT id FROM capacitadores WHERE correo = 'maria.gonzalez@example.com'), (SELECT id FROM clientes WHERE correo = 'cliente1@example.com'), (SELECT id FROM clientes WHERE correo = 'cliente1@example.com'));

-- Participantes de prueba
INSERT INTO participantes (tipo_documento, numero_documento, nombre, apellido, correo, telefono, ciudad_origen, empresa, cargo) VALUES
('DNI', '1717171717', 'Carlos', 'Rodríguez', 'carlos.rodriguez@example.com', '0977777777', 'Quito', 'Constructora ABC', 'Operario'),
('DNI', '1818181818', 'Ana', 'López', 'ana.lopez@example.com', '0966666666', 'Guayaquil', 'Empresa XYZ', 'Supervisora');

-- Relación curso-participante
INSERT INTO curso_participante (curso_id, participante_id, estado_pago, valor_pagado, fecha_pago, fecha_inicio_vigencia, fecha_expiracion, estado_acreditacion, calificacion, asistencia, creado_por, actualizado_por) VALUES
((SELECT id FROM cursos WHERE codigo_curso = 'CUR-001-2024'), (SELECT id FROM participantes WHERE numero_documento = '1717171717'), 'pagado', 150.00, '2024-01-15', '2024-02-05', '2025-02-05', true, 95.50, 100.00, (SELECT id FROM clientes WHERE correo = 'admin@aaces.com'), (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),
((SELECT id FROM cursos WHERE codigo_curso = 'CUR-002-2024'), (SELECT id FROM participantes WHERE numero_documento = '1818181818'), 'pagado', 120.00, '2024-02-20', '2024-03-03', '2025-03-03', true, 88.00, 95.00, (SELECT id FROM clientes WHERE correo = 'cliente1@example.com'), (SELECT id FROM clientes WHERE correo = 'cliente1@example.com'));

-- 13. CREAR VISTA PARA VALIDACIÓN PÚBLICA
CREATE VIEW vista_validacion_publica AS
SELECT 
  cp.codigo_validacion,
  p.nombre || ' ' || p.apellido as participante_nombre,
  p.numero_documento as participante_documento,
  c.nombre as curso_nombre,
  c.codigo_curso,
  cp.fecha_inicio_vigencia,
  cp.fecha_expiracion,
  cp.estado_acreditacion,
  cp.calificacion,
  cp.asistencia,
  cp.fecha_emision_certificado,
  cl.nombre as cliente_nombre
FROM curso_participante cp
JOIN participantes p ON cp.participante_id = p.id
JOIN cursos c ON cp.curso_id = c.id
JOIN clientes cl ON c.cliente_id = cl.id
WHERE cp.estado_acreditacion = true;

-- 14. CREAR VISTA DE REPORTES PARA CLIENTES
CREATE VIEW vista_reporte_cliente AS
SELECT 
  c.id as curso_id,
  c.codigo_curso,
  c.nombre as curso_nombre,
  c.ciudad,
  c.fecha_inicio,
  c.fecha_fin,
  c.duracion_horas,
  c.modalidad,
  c.estado as curso_estado,
  cap.nombre as capacitador_nombre,
  COUNT(cp.id) as total_participantes,
  COUNT(CASE WHEN cp.estado_acreditacion = true THEN cp.id END) as total_acreditados,
  AVG(cp.calificacion) as promedio_calificacion,
  SUM(CASE WHEN cp.estado_pago = 'pagado' THEN cp.valor_pagado ELSE 0 END) as total_ingresos,
  cl.nombre as cliente_nombre
FROM cursos c
LEFT JOIN capacitadores cap ON c.capacitador_id = cap.id
LEFT JOIN curso_participante cp ON c.id = cp.curso_id
JOIN clientes cl ON c.cliente_id = cl.id
GROUP BY c.id, c.codigo_curso, c.nombre, c.ciudad, c.fecha_inicio, c.fecha_fin, c.duracion_horas, c.modalidad, c.estado, cap.nombre, cl.nombre;

-- 15. PERMISOS Y SEGURIDAD
-- Crear rol para la aplicación
CREATE ROLE app_user WITH LOGIN PASSWORD 'app_secure_password_2024';

-- Conceder permisos básicos
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Conceder permisos específicos para funciones
GRANT EXECUTE ON FUNCTION generar_codigo_validacion() TO app_user;
GRANT EXECUTE ON FUNCTION auditar_cambios() TO app_user;

-- 16. COMPROBAR INTEGRIDAD
-- Verificar que las claves foráneas estén correctamente configuradas
DO $$
BEGIN
  -- Verificar clientes
  IF NOT EXISTS (SELECT 1 FROM clientes WHERE correo = 'admin@aaces.com') THEN
    RAISE EXCEPTION 'Error: Usuario admin@aaces.com no fue creado';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM clientes WHERE correo = 'cliente1@example.com') THEN
    RAISE EXCEPTION 'Error: Usuario cliente1@example.com no fue creado';
  END IF;
  
  RAISE NOTICE '✅ Migración completada exitosamente';
  RAISE NOTICE '✅ Usuarios de prueba creados:';
  RAISE NOTICE '   - Admin: admin@aaces.com / admin123';
  RAISE NOTICE '   - Cliente: cliente1@example.com / cliente123';
  RAISE NOTICE '✅ Datos de prueba insertados';
  RAISE NOTICE '✅ Vistas creadas para validación pública y reportes';
END $$;