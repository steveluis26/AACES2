-- MIGRACIÓN COMPLETA: ESQUEMA AACES
-- Base de datos: sistema_gestion_aaces

-- =====================================================
-- 1. TABLAS PRINCIPALES
-- =====================================================

-- Tabla: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    direccion TEXT,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'cliente', 'empleado')),
    activo BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: categorias_productos
CREATE TABLE IF NOT EXISTS categorias_productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: productos
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL CHECK (precio >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    categoria_id INTEGER REFERENCES categorias_productos(id),
    imagen_url VARCHAR(500),
    activo BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: servicios
CREATE TABLE IF NOT EXISTS servicios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL CHECK (precio >= 0),
    duracion_minutos INTEGER NOT NULL CHECK (duracion_minutos > 0),
    activo BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: estados_cita
CREATE TABLE IF NOT EXISTS estados_cita (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    color_hex VARCHAR(7) -- Para representación visual
);

-- Tabla: citas
CREATE TABLE IF NOT EXISTS citas (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES usuarios(id),
    servicio_id INTEGER NOT NULL REFERENCES servicios(id),
    fecha_hora TIMESTAMP NOT NULL,
    duracion_minutos INTEGER NOT NULL,
    precio_total DECIMAL(10,2) NOT NULL,
    estado_id INTEGER REFERENCES estados_cita(id),
    notas TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: estados_pedido
CREATE TABLE IF NOT EXISTS estados_pedido (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
);

-- Tabla: pedidos
CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES usuarios(id),
    estado_id INTEGER REFERENCES estados_pedido(id),
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    notas TEXT,
    fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: detalles_pedido
CREATE TABLE IF NOT EXISTS detalles_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL
);

-- Tabla: pagos
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER REFERENCES pedidos(id),
    cita_id INTEGER REFERENCES citas(id),
    monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    metodo_pago VARCHAR(50) NOT NULL,
    referencia_pago VARCHAR(100),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: configuracion_sistema
CREATE TABLE IF NOT EXISTS configuracion_sistema (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT,
    tipo_dato VARCHAR(20) DEFAULT 'string',
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: auditoria
CREATE TABLE IF NOT EXISTS auditoria (
    id SERIAL PRIMARY KEY,
    tabla_afectada VARCHAR(100) NOT NULL,
    operacion VARCHAR(10) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    usuario_id INTEGER REFERENCES usuarios(id),
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. FUNCIONES
-- =====================================================

-- Función para actualizar fecha_actualizacion
CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular duración total de una cita
CREATE OR REPLACE FUNCTION calcular_duracion_cita(p_servicio_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_duracion INTEGER;
BEGIN
    SELECT duracion_minutos INTO v_duracion
    FROM servicios
    WHERE id = p_servicio_id;
    
    RETURN COALESCE(v_duracion, 0);
END;
$$ LANGUAGE plpgsql;

-- Función para calcular precio total de un pedido
CREATE OR REPLACE FUNCTION calcular_total_pedido(p_pedido_id INTEGER)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_total DECIMAL(10,2);
BEGIN
    SELECT COALESCE(SUM(subtotal), 0)
    INTO v_total
    FROM detalles_pedido
    WHERE pedido_id = p_pedido_id;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- Función para registrar en auditoría
CREATE OR REPLACE FUNCTION registrar_auditoria()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO auditoria (tabla_afectada, operacion, datos_anteriores)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO auditoria (tabla_afectada, operacion, datos_anteriores, datos_nuevos)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria (tabla_afectada, operacion, datos_nuevos)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. TRIGGERS
-- =====================================================

-- Triggers para actualizar fecha_actualizacion
CREATE TRIGGER trigger_actualizar_usuarios
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

CREATE TRIGGER trigger_actualizar_productos
    BEFORE UPDATE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

CREATE TRIGGER trigger_actualizar_servicios
    BEFORE UPDATE ON servicios
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

CREATE TRIGGER trigger_actualizar_citas
    BEFORE UPDATE ON citas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

CREATE TRIGGER trigger_actualizar_pedidos
    BEFORE UPDATE ON pedidos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

-- Triggers para auditoría
CREATE TRIGGER trigger_auditoria_usuarios
    AFTER INSERT OR UPDATE OR DELETE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER trigger_auditoria_productos
    AFTER INSERT OR UPDATE OR DELETE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER trigger_auditoria_citas
    AFTER INSERT OR UPDATE OR DELETE ON citas
    FOR EACH ROW
    EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER trigger_auditoria_pedidos
    AFTER INSERT OR UPDATE OR DELETE ON pedidos
    FOR EACH ROW
    EXECUTE FUNCTION registrar_auditoria();

-- Trigger para actualizar total del pedido
CREATE OR REPLACE FUNCTION actualizar_total_pedido()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE pedidos 
        SET total = calcular_total_pedido(NEW.pedido_id),
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id = NEW.pedido_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE pedidos 
        SET total = calcular_total_pedido(OLD.pedido_id),
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id = OLD.pedido_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_total_pedido
    AFTER INSERT OR UPDATE OR DELETE ON detalles_pedido
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_total_pedido();

-- Trigger para establecer duración de cita
CREATE OR REPLACE FUNCTION establecer_duracion_cita()
RETURNS TRIGGER AS $$
BEGIN
    NEW.duracion_minutos = calcular_duracion_cita(NEW.servicio_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_establecer_duracion_cita
    BEFORE INSERT ON citas
    FOR EACH ROW
    EXECUTE FUNCTION establecer_duracion_cita();

-- =====================================================
-- 4. DATOS INICIALES
-- =====================================================

-- Estados de cita
INSERT INTO estados_cita (nombre, descripcion, color_hex) VALUES
('pendiente', 'Cita programada pendiente de confirmación', '#FFA500'),
('confirmada', 'Cita confirmada por el establecimiento', '#28A745'),
('en_proceso', 'Cita en proceso', '#007BFF'),
('completada', 'Cita completada exitosamente', '#6C757D'),
('cancelada', 'Cita cancelada', '#DC3545'),
('no_asistio', 'Cliente no se presentó', '#8B4513');

-- Estados de pedido
INSERT INTO estados_pedido (nombre, descripcion) VALUES
('pendiente', 'Pedido realizado, pendiente de procesamiento'),
('procesando', 'Pedido siendo preparado'),
('enviado', 'Pedido enviado al cliente'),
('entregado', 'Pedido entregado exitosamente'),
('cancelado', 'Pedido cancelado'),
('devuelto', 'Pedido devuelto por el cliente');

-- Categorías de productos
INSERT INTO categorias_productos (nombre, descripcion) VALUES
('Cuidado del Cabello', 'Productos para el cuidado y mantenimiento del cabello'),
('Tratamientos Faciales', 'Productos para tratamientos faciales y cuidado de la piel'),
('Maquillaje', 'Productos de maquillaje profesional'),
('Cuidado Corporal', 'Productos para el cuidado del cuerpo'),
('Herramientas', 'Herramientas y equipos de belleza'),
('Accesorios', 'Accesorios de belleza y cuidado personal');

-- Servicios
INSERT INTO servicios (nombre, descripcion, precio, duracion_minutos) VALUES
('Corte de Cabello', 'Corte de cabello personalizado con lavado y peinado', 25.00, 60),
('Tinte Capilar', 'Aplicación de tinte con técnica profesional', 45.00, 90),
('Tratamiento Facial', 'Limpieza profunda e hidratación facial', 35.00, 75),
('Manicura', 'Manicura básica con esmaltado', 15.00, 45),
('Pedicura', 'Pedicura completa con esmaltado', 20.00, 60),
('Maquillaje Profesional', 'Maquillaje para eventos especiales', 40.00, 60),
('Depilación de Cejas', 'Diseño y depilación de cejas', 10.00, 30),
('Alisado Brasileño', 'Tratamiento de alisado capilar duradero', 80.00, 120);

-- Productos
INSERT INTO productos (nombre, descripcion, precio, stock, categoria_id) VALUES
('Shampoo Hidratante', 'Shampoo profesional para cabello seco', 12.50, 50, 1),
('Acondicionador Reparador', 'Acondicionador intensivo para puntas dañadas', 14.00, 40, 1),
('Mascarilla Capilar', 'Mascarilla nutritiva de uso semanal', 18.00, 30, 1),
('Crema Facial Hidratante', 'Crema hidratante para piel normal a seca', 22.00, 25, 2),
('Serum Antiedad', 'Serum concentrado con vitaminas', 35.00, 20, 2),
('Base de Maquillaje', 'Base liquida de larga duración', 28.00, 35, 3),
('Máscara de Pestañas', 'Máscara voluminizadora negra', 18.00, 45, 3),
('Loción Corporal', 'Loción hidratante para todo el cuerpo', 16.00, 60, 4),
('Secador Profesional', 'Secador de alta potencia 2000W', 85.00, 15, 5),
('Plancha de Cabello', 'Plancha cerámica con control de temperatura', 65.00, 12, 5);

-- Configuración del sistema
INSERT INTO configuracion_sistema (clave, valor, descripcion, tipo_dato) VALUES
('nombre_empresa', 'AACES Centro de Belleza', 'Nombre del establecimiento', 'string'),
('telefono_contacto', '+34 600 123 456', 'Teléfono de contacto principal', 'string'),
('email_contacto', 'info@aaces.com', 'Email de contacto', 'string'),
('direccion_empresa', 'Calle Principal 123, Ciudad', 'Dirección del establecimiento', 'string'),
('horario_apertura', '09:00', 'Hora de apertura (formato 24h)', 'string'),
('horario_cierre', '20:00', 'Hora de cierre (formato 24h)', 'string'),
('dias_semana', 'Lunes a Sábado', 'Días de atención', 'string'),
('moneda_predeterminada', 'EUR', 'Moneda para precios', 'string'),
('impuesto_predeterminado', '21', 'Porcentaje de IVA', 'numeric'),
('tiempo_cita_minimo', '30', 'Tiempo mínimo entre citas (minutos)', 'numeric');

-- =====================================================
-- 5. USUARIOS DE PRUEBA
-- =====================================================

-- NOTA: Las contraseñas están encriptadas con bcrypt
-- Admin: admin@aaces.com / admin123
-- Cliente: cliente1@example.com / cliente123

-- Usuario Admin
INSERT INTO usuarios (nombre, email, password_hash, telefono, direccion, rol, activo) VALUES
('Administrador AACES', 'admin@aaces.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+34 600 123 456', 'Calle Principal 123, Ciudad', 'admin', true);

-- Usuario Cliente
INSERT INTO usuarios (nombre, email, password_hash, telefono, direccion, rol, activo) VALUES
('Cliente de Prueba', 'cliente1@example.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+34 600 987 654', 'Avenida Secundaria 456, Ciudad', 'cliente', true);

-- =====================================================
-- 6. ÍNDICES PARA MEJORAR RENDIMIENTO
-- =====================================================

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_activo ON productos(activo);
CREATE INDEX idx_servicios_activo ON servicios(activo);
CREATE INDEX idx_citas_cliente ON citas(cliente_id);
CREATE INDEX idx_citas_fecha ON citas(fecha_hora);
CREATE INDEX idx_citas_estado ON citas(estado_id);
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_estado ON pedidos(estado_id);
CREATE INDEX idx_detalles_pedido_pedido ON detalles_pedido(pedido_id);
CREATE INDEX idx_pagos_pedido ON pagos(pedido_id);
CREATE INDEX idx_pagos_cita ON pagos(cita_id);
CREATE INDEX idx_auditoria_tabla ON auditoria(tabla_afectada);
CREATE INDEX idx_auditoria_fecha ON auditoria(fecha);

-- =====================================================
-- 7. VISTAS ÚTILES
-- =====================================================

-- Vista de productos con información de categoría
CREATE OR REPLACE VIEW vista_productos_completa AS
SELECT 
    p.id,
    p.nombre,
    p.descripcion,
    p.precio,
    p.stock,
    p.activo,
    p.fecha_registro,
    c.nombre as categoria_nombre
FROM productos p
LEFT JOIN categorias_productos c ON p.categoria_id = c.id;

-- Vista de citas con información completa
CREATE OR REPLACE VIEW vista_citas_completa AS
SELECT 
    c.id,
    c.fecha_hora,
    c.duracion_minutos,
    c.precio_total,
    c.notas,
    c.fecha_registro,
    u.nombre as cliente_nombre,
    u.email as cliente_email,
    s.nombre as servicio_nombre,
    s.precio as servicio_precio,
    e.nombre as estado_nombre,
    e.color_hex as estado_color
FROM citas c
JOIN usuarios u ON c.cliente_id = u.id
JOIN servicios s ON c.servicio_id = s.id
LEFT JOIN estados_cita e ON c.estado_id = e.id;

-- Vista de pedidos con información completa
CREATE OR REPLACE VIEW vista_pedidos_completa AS
SELECT 
    p.id,
    p.total,
    p.notas,
    p.fecha_pedido,
    u.nombre as cliente_nombre,
    u.email as cliente_email,
    e.nombre as estado_nombre
FROM pedidos p
JOIN usuarios u ON p.cliente_id = u.id
LEFT JOIN estados_pedido e ON p.estado_id = e.id;

-- =====================================================
-- 8. PERMISOS Y SEGURIDAD
-- =====================================================

-- Asegurar que las contraseñas no se puedan leer directamente
REVOKE SELECT (password_hash) ON usuarios FROM PUBLIC;

-- Comentarios de documentación
COMMENT ON TABLE usuarios IS 'Tabla principal de usuarios del sistema';
COMMENT ON TABLE productos IS 'Catálogo de productos disponibles';
COMMENT ON TABLE servicios IS 'Servicios ofrecidos por el establecimiento';
COMMENT ON TABLE citas IS 'Registro de citas y reservas';
COMMENT ON TABLE pedidos IS 'Registro de pedidos de productos';
COMMENT ON TABLE pagos IS 'Registro de pagos realizados';
COMMENT ON TABLE auditoria IS 'Registro de cambios en tablas críticas';

-- Fin del script de migración
-- Ejecutar con: psql -U postgres -d sistema_gestion_aaces -f 001_esquema_completo_aaces.sql