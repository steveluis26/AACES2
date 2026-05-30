-- =============================================
-- USUARIOS DE PRUEBA Y DATOS INICIALES
-- =============================================

-- 1. USUARIOS ADMIN Y CLIENTE DE PRUEBA
-- Contraseñas encriptadas usando bcrypt
-- admin123 -> $2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW
-- cliente123 -> $2b$10$K7Q2xL5yH9nM8P3rT6vWs4oX1aB7cD9eF2gH5jK8mN0qS4tW7zY0

INSERT INTO clientes (nombre, correo, password_hash, ciudad_base, categoria, estado, acepta_terminos, fecha_acepta_terminos) VALUES
('Administrador AACES', 'admin@aaces.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'Quito', 'enterprise', 'activo', true, CURRENT_TIMESTAMP),
('Cliente de Prueba', 'cliente1@example.com', '$2b$10$K7Q2xL5yH9nM8P3rT6vWs4oX1aB7cD9eF2gH5jK8mN0qS4tW7zY0', 'Guayaquil', 'premium', 'activo', true, CURRENT_TIMESTAMP);

-- 2. CAPACITADORES DE PRUEBA
INSERT INTO capacitadores (nombre, correo, telefono, cliente_id, fecha_inicio_vigencia, estado_pago, acceso_activo, documento_identidad, especialidad, nivel_certificacion, creado_por) VALUES
('Dr. Juan Pérez', 'juan.perez@capacitador.com', '0998765432', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com'), CURRENT_DATE, 'pagado', true, '1712345678', 'Seguridad Industrial', 'Nivel Avanzado', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),
('Ing. María González', 'maria.gonzalez@capacitador.com', '0987654321', (SELECT id FROM clientes WHERE correo = 'cliente1@example.com'), CURRENT_DATE, 'pagado', true, '1723456789', 'Gestión Ambiental', 'Nivel Intermedio', (SELECT id FROM clientes WHERE correo = 'cliente1@example.com'));

-- 3. CURSOS DE PRUEBA
INSERT INTO cursos (cliente_id, codigo_curso, nombre, ciudad, fecha_inicio, fecha_fin, duracion_horas, modalidad, capacitador_id, duracion_validacion, costo_total, empresa_contratante, descripcion, objetivos, requisitos, creado_por) VALUES
((SELECT id FROM clientes WHERE correo = 'admin@aaces.com'), 'AACES-001', 'Curso de Seguridad Industrial Básica', 'Quito', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '25 days', 40, 'presencial', (SELECT id FROM capacitadores WHERE correo = 'juan.perez@capacitador.com'), 365, 150.00, 'Constructora ABC', 'Curso orientado a la seguridad en el trabajo industrial', 'Capacitar a los participantes en normas de seguridad industrial', 'Ningún requisito previo', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),
((SELECT id FROM clientes WHERE correo = 'admin@aaces.com'), 'AACES-002', 'Gestión Ambiental para Empresas', 'Quito', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '10 days', 30, 'virtual', (SELECT id FROM capacitadores WHERE correo = 'maria.gonzalez@capacitador.com'), 730, 120.00, 'Empresa XYZ', 'Curso sobre gestión ambiental y normativas', 'Implementar sistemas de gestión ambiental', 'Conocimientos básicos de medio ambiente', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),
((SELECT id FROM clientes WHERE correo = 'cliente1@example.com'), 'AACES-003', 'Prevención de Riesgos Laborales', 'Guayaquil', CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '10 days', 35, 'mixta', (SELECT id FROM capacitadores WHERE correo = 'juan.perez@capacitador.com'), 365, 180.00, 'Corporación DEF', 'Curso de prevención de riesgos en el trabajo', 'Identificar y prevenir riesgos laborales', 'Experiencia laboral mínima de 1 año', (SELECT id FROM clientes WHERE correo = 'cliente1@example.com'));

-- 4. PARTICIPANTES DE PRUEBA
INSERT INTO participantes (tipo_documento, numero_documento, nombre, apellido, correo, telefono, ciudad_origen, fecha_nacimiento, genero, empresa, cargo, nivel_educacion, direccion, pais) VALUES
('DNI', '1712345678', 'Carlos', 'Rodríguez', 'carlos.rodriguez@empresa.com', '0991234567', 'Quito', '1985-03-15', 'M', 'Constructora ABC', 'Supervisor de Obra', 'Universitario', 'Av. Amazonas 123', 'Ecuador'),
('DNI', '1723456789', 'Ana', 'Martínez', 'ana.martinez@empresa.com', '0982345678', 'Guayaquil', '1990-07-22', 'F', 'Empresa XYZ', 'Asistente Ambiental', 'Universitario', 'Calle 10 y Av. Principal', 'Ecuador'),
('DNI', '1734567890', 'Luis', 'Gómez', 'luis.gomez@empresa.com', '0973456789', 'Cuenca', '1988-11-30', 'M', 'Corporación DEF', 'Técnico de Seguridad', 'Técnico Superior', 'Calle Larga 456', 'Ecuador'),
('DNI', '1745678901', 'María', 'López', 'maria.lopez@empresa.com', '0964567890', 'Quito', '1992-05-18', 'F', 'Constructora ABC', 'Ingeniera Civil', 'Universitario', 'Av. Shyris 789', 'Ecuador');

-- 5. INSCRIPCIONES EN CURSOS
INSERT INTO curso_participante (curso_id, participante_id, estado_pago, valor_pagado, fecha_pago, fecha_participacion, fecha_inicio_vigencia, fecha_expiracion, estado_acreditacion, calificacion, asistencia, observaciones, creado_por) VALUES
-- Curso 1: Seguridad Industrial
((SELECT id FROM cursos WHERE codigo_curso = 'AACES-001'), (SELECT id FROM participantes WHERE numero_documento = '1712345678'), 'pagado', 150.00, CURRENT_TIMESTAMP - INTERVAL '35 days', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '335 days', true, 95.5, 100, 'Excelente participación', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),
((SELECT id FROM cursos WHERE codigo_curso = 'AACES-001'), (SELECT id FROM participantes WHERE numero_documento = '1745678901'), 'pagado', 150.00, CURRENT_TIMESTAMP - INTERVAL '35 days', CURRENT_DATE - INTERVAL '