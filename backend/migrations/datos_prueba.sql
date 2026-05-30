-- =============================================
-- DATOS DE PRUEBA - USUARIOS Y CONFIGURACIÓN
-- =============================================

-- Insertar cliente ADMIN con contraseña encriptada (admin123)
INSERT INTO clientes (
  nombre, 
  correo, 
  password_hash, 
  ciudad_base, 
  categoria, 
  estado, 
  fecha_cambio_categoria,
  acepta_terminos,
  fecha_acepta_terminos
) VALUES (
  'Administrador AACES',
  'admin@aaces.com',
  '$2b$10$92IPXYsLxfw2YVjXuZvQOOeGfZvLgZ5mZ3Z3Z3Z3Z3Z3Z3Z3Z3Z3', -- admin123
  'Quito',
  'enterprise',
  'activo',
  CURRENT_TIMESTAMP,
  true,
  CURRENT_TIMESTAMP
);

-- Insertar cliente regular con contraseña encriptada (cliente123)
INSERT INTO clientes (
  nombre, 
  correo, 
  password_hash, 
  ciudad_base, 
  categoria, 
  estado, 
  fecha_cambio_categoria,
  acepta_terminos,
  fecha_acepta_terminos
) VALUES (
  'Cliente de Prueba',
  'cliente1@example.com',
  '$2b$10$7Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3', -- cliente123
  'Guayaquil',
  'premium',
  'activo',
  CURRENT_TIMESTAMP,
  true,
  CURRENT_TIMESTAMP
);

-- Insertar cliente básico adicional
INSERT INTO clientes (
  nombre, 
  correo, 
  password_hash, 
  ciudad_base, 
  categoria, 
  estado, 
  fecha_cambio_categoria,
  acepta_terminos,
  fecha_acepta_terminos
) VALUES (
  'Cliente Básico',
  'basic@example.com',
  '$2b$10$7Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3Z3', -- cliente123
  'Cuenca',
  'basico',
  'activo',
  CURRENT_TIMESTAMP,
  true,
  CURRENT_TIMESTAMP
);

-- Obtener IDs de los clientes creados
WITH cliente_admin AS (
  SELECT id FROM clientes WHERE correo = 'admin@aaces.com'
),
cliente_premium AS (
  SELECT id FROM clientes WHERE correo = 'cliente1@example.com'
),
cliente_basico AS (
  SELECT id FROM clientes WHERE correo = 'basic@example.com'
)

-- Insertar capacitadores de prueba
INSERT INTO capacitadores (
  nombre, 
  correo, 
  telefono, 
  cliente_id, 
  fecha_inicio_vigencia,
  fecha_fin_vigencia,
  estado_pago,
  acceso_activo,
  documento_identidad,
  especialidad,
  nivel_certificacion,
  creado_por
) VALUES 
('Dr. Juan Pérez', 'juan.perez@capacitador.com', '0987654321', (SELECT id FROM cliente_admin), '2024-01-01', '2024-12-31', 'pagado', true, '1712345678', 'Seguridad Industrial', 'Nivel Avanzado', (SELECT id FROM cliente_admin)),
('Dra. María García', 'maria.garcia@capacitador.com', '0998765432', (SELECT id FROM cliente_admin), '2024-01-01', '2024-12-31', 'pagado', true, '1712345679', 'Salud Ocupacional', 'Nivel Experto', (SELECT id FROM cliente_admin)),
('Ing. Carlos Rodríguez', 'carlos.rodriguez@capacitador.com', '0976543210', (SELECT id FROM cliente_premium), '2024-02-01', '2024-12-31', 'pagado', true, '1712345680', 'Gestión Ambiental', 'Nivel Intermedio', (SELECT id FROM cliente_premium)),
('Lic. Ana Martínez', 'ana.martinez@capacitador.com', '0965432109', (SELECT id FROM cliente_basico), '2024-03-01', '2024-12-31', 'pagado', true, '1712345681', 'Calidad', 'Nivel Básico', (SELECT id FROM cliente_basico));

-- Insertar cursos de prueba
INSERT INTO cursos (
  cliente_id, 
  codigo_curso, 
  nombre, 
  ciudad, 
  fecha_inicio, 
  fecha_fin, 
  duracion_horas, 
  modalidad, 
  capacitador_id,
  duracion_validacion,
  costo_total,
  moneda,
  estado,
  empresa_contratante,
  descripcion,
  objetivos,
  requisitos,
  creado_por
) VALUES 
-- Cursos del admin
((SELECT id FROM cliente_admin), 'CUR-2024-001', 'Curso de Seguridad Industrial Básica', 'Quito', '2024-01-15', '2024-01-19', 40, 'presencial', (SELECT id FROM capacitadores WHERE correo = 'juan.perez@capacitador.com'), 2, 1500.00, 'USD', 'finalizado', 'Constructora ABC', 'Curso básico de seguridad industrial para trabajadores', 'Capacitar en normas básicas de seguridad', 'Ninguno', (SELECT id FROM cliente_admin)),
((SELECT id FROM cliente_admin), 'CUR-2024-002', 'Curso de Primeros Auxilios', 'Quito', '2024-02-01', '2024-02-03', 24, 'presencial', (SELECT id FROM capacitadores WHERE correo = 'maria.garcia@capacitador.com'), 1, 800.00, 'USD', 'activo', 'Empresa XYZ', 'Curso de primeros auxilios y RCP', 'Capacitar en primeros auxilios básicos', 'Ninguno', (SELECT id FROM cliente_admin)),
((SELECT id FROM cliente_admin), 'CUR-2024-003', 'Curso de Gestión Ambiental', 'Quito', '2024-03-01', '2024-03-15', 60, 'virtual', (SELECT id FROM capacitadores WHERE correo = 'juan.perez@capacitador.com'), 3, 2000.00, 'USD', 'activo', 'Ministerio del Ambiente', 'Curso avanzado de gestión ambiental', 'Formar especialistas en gestión ambiental', 'Conocimientos básicos de medio ambiente', (SELECT id FROM cliente_admin)),

-- Cursos del cliente premium
((SELECT id FROM cliente_premium), 'CUR-2024-004', 'Curso de Calidad ISO 9001', 'Guayaquil', '2024-02-10', '2024-02-14', 32, 'presencial', (SELECT id FROM capacitadores WHERE correo = 'carlos.rodriguez@capacitador.com'), 2, 1200.00, 'USD', 'finalizado', 'Industria Textil S.A.', 'Implementación de ISO 9001', 'Implementar sistema de calidad', 'Conocimientos básicos de calidad', (SELECT id FROM cliente_premium)),
((SELECT id FROM cliente_premium), 'CUR-2024-005', 'Curso de Seguridad en Alturas', 'Guayaquil', '2024-03-05', '2024-03-07', 16, 'presencial', (SELECT id FROM capacitadores WHERE correo = 'carlos.rodriguez@capacitador.com'), 1, 600.00, 'USD', 'activo', 'Empresa de Construcción', 'Seguridad para trabajo en alturas', 'Capacitar en seguridad en alturas', 'Ninguno', (SELECT id FROM cliente_premium)),

-- Cursos del cliente básico
((SELECT id FROM cliente_basico), 'CUR-2024-006', 'Curso de Higiene Industrial', 'Cuenca', '2024-02-20', '2024-02-22', 20, 'virtual', (SELECT id FROM capacitadores WHERE correo = 'ana.martinez@capacitador.com'), 1, 400.00, 'USD', 'finalizado', 'Fábrica de Alimentos', 'Higiene industrial básica', 'Capacitar en higiene industrial', 'Ninguno', (SELECT id FROM cliente_basico));

-- Insertar participantes de prueba
INSERT INTO participantes (
  tipo_documento, 
  numero_documento, 
  nombre, 
  apellido, 
  correo, 
  telefono, 
  ciudad_origen, 
  fecha_nacimiento, 
  genero, 
  empresa, 
  cargo,
  nivel_educacion,
  direccion,
  codigo_postal,
  pais
) VALUES 
('DNI', '1712345678', 'Juan', 'Pérez', 'juan.perez@empresa.com', '0987654321', 'Quito', '1990-05-15', 'M', 'Empresa ABC', 'Operario', 'Secundaria', 'Av. Principal 123', '170101', 'Ecuador'),
('DNI', '1712345679', 'María', 'García', 'maria.garcia@empresa.com', '0998765432', 'Quito', '1985-08-20', 'F', 'Empresa ABC', 'Supervisora', 'Universitaria', 'Calle Secundaria 456', '170102', 'Ecuador'),
('DNI', '1712345680', 'Carlos', 'Rodríguez', 'carlos.rodriguez@empresa.com', '0976543210', 'Guayaquil', '1992-03-10', 'M', 'Industria Textil S.A.', 'Gerente de Producción', 'Universitaria', 'Av. Industrial 789', '090101', 'Ecuador'),
('DNI', '1712345681', 'Ana', 'Martínez', 'ana.martinez@empresa.com', '0965432109', 'Cuenca', '1988-11-25', 'F', 'Fábrica de Alimentos', 'Técnica de Calidad', 'Técnica', 'Calle Comercial 321', '010101', 'Ecuador'),
('DNI', '1712345682', 'Luis', 'González', 'luis.gonzalez@empresa.com', '0954321098', 'Quito', '1995-01-30', 'M', 'Constructora ABC', 'Ingeniero de Seguridad', 'Universitaria', 'Av. Construcción 654', '170103', 'Ecuador'),
('DNI', '1712345683', 'Sofía', 'López', 'sofia.lopez@empresa.com', '0943210987', 'Guayaquil', '1993-07-12', 'F', 'Empresa de Construcción', 'Ayudante', 'Secundaria', 'Calle del Trabajo 987', '090102', 'Ecuador');

-- Insertar relaciones curso-participante con certificados
INSERT INTO curso_participante (
  curso_id, 
  participante_id, 
  estado_pago, 
  valor_pagado, 
  fecha_pago, 
  fecha_participacion, 
  fecha_inicio_vigencia, 
  fecha_expiracion, 
  estado_acreditacion, 
  calificacion, 
  asistencia, 
  observaciones,
  certificado_url,
  fecha_emision_certificado,
  creado_por
) VALUES 
-- Curso 1: Seguridad Industrial (finalizado)
((SELECT id FROM cursos WHERE codigo_curso = 'CUR-2024-001'), (SELECT id FROM participantes WHERE numero_documento = '1712345678'), 'pagado', 1500.00, '2024-01-10', '2024-01-15', '2024-01-15', '2026-01-15', true, 95.50, 100.00, 'Excelente desempeño', 'https://certificados.aaces.com/cert/CUR-2024-001-1712345678', '2024-01-20', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),
((SELECT id FROM cursos WHERE codigo_curso = 'CUR-2024-001'), (SELECT id FROM participantes WHERE numero_documento = '1712345679'), 'pagado', 1500.00, '2024-01-10', '2024-01-15', '2024-01-15', '2026-01-15', true, 88.75, 95.00, 'Buen desempeño', 'https://certificados.aaces.com/cert/CUR-2024-001-1712345679', '2024-01-20', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),
((SELECT id FROM cursos WHERE codigo_curso = 'CUR-2024-001'), (SELECT id FROM participantes WHERE numero_documento = '1712345682'), 'pagado', 1500.00, '2024-01-10', '2024-01-15', '2024-01-15', '2026-01-15', true, 92.00, 98.00, 'Muy buen desempeño', 'https://certificados.aaces.com/cert/CUR-2024-001-1712345682', '2024-01-20', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),

-- Curso 2: Primeros Auxilios (activo)
((SELECT id FROM cursos WHERE codigo_curso = 'CUR-2024-002'), (SELECT id FROM participantes WHERE numero_documento = '1712345678'), 'pagado', 800.00, '2024-01-25', '2024-02-01', '2024-02-01', '2025-02-01', false, 0.00, 0.00, 'En curso', NULL, NULL, (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),
((SELECT id FROM cursos WHERE codigo_curso = 'CUR-2024-002'), (SELECT id FROM participantes WHERE numero_documento = '1712345679'), 'pagado', 800.00, '2024-01-25', '2024-02-01', '2024-02-01', '2025-02-01', false, 0.00, 0.00, 'En curso', NULL, NULL, (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),

-- Curso 4: Calidad ISO 9001 (finalizado)
((SELECT id FROM cursos WHERE codigo_curso = 'CUR-2024-004'), (SELECT id FROM participantes WHERE numero_documento = '1712345680'), 'pagado', 1200.00, '2024-02-05', '2024-02-10', '2024-02-10', '2026-02-10', true, 96.00, 100.00, 'Excelente participación', 'https://certificados.aaces.com/cert/CUR-2024-004-1712345680', '2024-02-15', (SELECT id FROM clientes WHERE correo = 'cliente1@example.com')),

-- Curso 6: Higiene Industrial (finalizado)
((SELECT id FROM cursos WHERE codigo_curso = 'CUR-2024-006'), (SELECT id FROM participantes WHERE numero_documento = '1712345681'), 'pagado', 400.00, '2024-02-15', '2024-02-20', '2024-02-20', '2025-02-20', true, 89.50, 95.00, 'Buen desempeño', 'https://certificados.aaces.com/cert/CUR-2024-006-1712345681', '2024-02-25', (SELECT id FROM clientes WHERE correo = 'basic@example.com'));

-- Insertar pagos de prueba
INSERT INTO pagos (
  cliente_id,
  curso_participante_id,
  tipo_pago,
  monto,
  moneda,
  metodo_pago,
  referencia_pago,
  estado_pago,
  notas,
  creado_por
) VALUES 
-- Pagos del admin
((SELECT id FROM clientes WHERE correo = 'admin@aaces.com'), (SELECT id FROM curso_participante WHERE curso_id = (SELECT id FROM cursos WHERE codigo_curso = 'CUR-2024-001') AND participante_id = (SELECT id FROM participantes WHERE numero_documento = '1712345678')), 'participante', 1500.00, 'USD', 'transferencia', 'REF-001', 'completado', 'Pago completo del curso', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),
((SELECT id FROM clientes WHERE correo = 'admin@aaces.com'), (SELECT id FROM curso_participante WHERE curso_id = (SELECT id FROM cursos WHERE codigo_curso = 'CUR-2024-001') AND participante_id = (SELECT id FROM participantes WHERE numero_documento = '1712345679')), 'participante', 1500.00, 'USD', 'transferencia', 'REF-002', 'completado', 'Pago completo del curso', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),
((SELECT id FROM clientes WHERE correo = 'admin@aaces.com'), (SELECT id FROM curso_participante WHERE curso_id = (SELECT id FROM cursos WHERE codigo_curso = 'CUR-2024-002') AND participante_id = (SELECT id FROM participantes WHERE numero_documento = '1712345678')), 'participante', 800.00, 'USD', 'efectivo', 'REF-003', 'completado', 'Pago en efectivo', (SELECT id FROM clientes WHERE correo = 'admin@aaces.com')),

-- Pagos del cliente premium
((SELECT id FROM clientes WHERE correo = 'cliente1@example.com'), (SELECT id FROM curso_participante WHERE curso_id = (SELECT id FROM cursos WHERE codigo_curso = 'CUR-2024-004') AND participante_id = (SELECT id FROM participantes WHERE numero_documento = '1712345680')), 'participante', 1200.00, 'USD', 'tarjeta', 'REF-004', 'completado', 'Pago con tarjeta de crédito', (SELECT id FROM clientes WHERE correo = 'cliente1@example.com')),

-- Pagos del cliente básico
((SELECT id FROM clientes WHERE correo = 'basic@example.com'), (SELECT id FROM curso_participante WHERE curso_id = (SELECT id FROM cursos WHERE codigo_curso = 'CUR-2024-006') AND participante_id = (SELECT id FROM participantes WHERE numero_documento = '1712345681')), 'participante', 400.00, 'USD', 'transferencia', 'REF-005', 'completado', 'Pago completo del curso', (SELECT id FROM clientes WHERE correo = 'basic@example.com'));

-- Actualizar métricas del panel maestro
REFRESH MATERIALIZED VIEW mv_resumen_cliente;

-- Insertar métricas iniciales para clientes
INSERT INTO panel_maestro_metrica (
  cliente_id,
  cursos_registrados,
  participantes_totales,
  participantes_acreditados,
  total_ingresos,
  promedio_calificaciones
) 
SELECT 
  c.id,
  COALESCE(COUNT(DISTINCT cur.id), 0),
  COALESCE(COUNT(DISTINCT cp.participante_id), 0),
  COALESCE(COUNT(DISTINCT CASE WHEN cp.estado_acreditacion = true THEN cp.participante_id END), 0),
  COALESCE(SUM(CASE WHEN p.estado_pago = 'completado' THEN p.monto ELSE 0 END), 0),
  COALESCE(AVG(cp.calificacion), 0)
FROM clientes c
LEFT JOIN cursos cur ON c.id = cur.cliente_id
LEFT JOIN curso_participante cp ON cur.id = cp.curso_id
LEFT JOIN pagos p ON cp.id = p.curso_participante_id
GROUP BY c.id;

-- Verificar datos insertados
SELECT 
  'Total clientes: ' || COUNT(*) as info
FROM clientes;

SELECT 
  'Cliente: ' || nombre || ' - ' || correo || ' - Categoría: ' || categoria as info
FROM clientes 
ORDER BY fecha_creacion;

SELECT 
  'Total cursos: ' || COUNT(*) as info
FROM cursos;

SELECT 
  'Total participantes: ' || COUNT(*) as info
FROM participantes;

SELECT 
  'Total certificados emitidos: ' || COUNT(*) as info
FROM curso_participante 
WHERE estado_acreditacion = true AND certificado_url IS NOT NULL;