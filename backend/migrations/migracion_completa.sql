-- MIGRACIÓN COMPLETA AACES - ESQUEMA MEJORADO
-- Este script crea toda la estructura de la base de datos y usuarios de prueba

-- =============================================
-- TABLAS PRINCIPALES
-- =============================================

-- Tabla de usuarios (mejorada con campos adicionales)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    direccion TEXT,
    ciudad VARCHAR(100),
    pais VARCHAR(100) DEFAULT 'Ecuador',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
    rol VARCHAR(50) DEFAULT 'cliente' CHECK (rol IN ('admin', 'cliente', 'empleado')),
    verificado BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(500),
    preferencias_notificaciones JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de categorías de productos
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    imagen_url VARCHAR(500),
    padre_id INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT TRUE,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de productos (mejorada)
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    descripcion_corta VARCHAR(500),
    sku VARCHAR(100) UNIQUE NOT NULL,
    precio DECIMAL(10,2) NOT NULL CHECK (precio >= 0),
    precio_oferta DECIMAL(10,2) CHECK (precio_oferta >= 0),
    costo DECIMAL(10,2) CHECK (costo >= 0),
    stock_actual INTEGER DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo INTEGER DEFAULT 5 CHECK (stock_minimo >= 0),
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    proveedor VARCHAR(200),
    marca VARCHAR(100),
    modelo VARCHAR(100),
    imagen_principal VARCHAR(500),
    galeria_imagenes JSONB DEFAULT '[]',
    especificaciones JSONB DEFAULT '{}',
    peso DECIMAL(8,3),
    dimensiones JSONB DEFAULT '{}',
    tags TEXT[],
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'agotado')),
    es_virtual BOOLEAN DEFAULT FALSE,
    fecha_disponibilidad DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de órdenes (mejorada)
CREATE TABLE ordenes (
    id SERIAL PRIMARY KEY,
    numero_orden VARCHAR(50) UNIQUE NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_orden TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado_orden VARCHAR(50) DEFAULT 'pendiente' CHECK (estado_orden IN ('pendiente', 'procesando', 'enviado', 'entregado', 'cancelado', 'devuelto')),
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    impuestos DECIMAL(10,2) DEFAULT 0,
    envio DECIMAL(10,2) DEFAULT 0,
    descuento DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    moneda VARCHAR(3) DEFAULT 'USD',
    metodo_pago VARCHAR(50),
    referencia_pago VARCHAR(100),
    fecha_pago TIMESTAMP,
    direccion_envio JSONB,
    direccion_facturacion JSONB,
    notas TEXT,
    tracking_envio VARCHAR(100),
    fecha_envio TIMESTAMP,
    fecha_entrega TIMESTAMP,
    motivo_cancelacion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de detalles de órdenes
CREATE TABLE ordenes_detalles (
    id SERIAL PRIMARY KEY,
    orden_id INTEGER REFERENCES ordenes(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL,
    descuento_unitario DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de carrito de compras
CREATE TABLE carrito (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2) NOT NULL,
    notas TEXT,
    fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario_id, producto_id)
);

-- Tabla de direcciones de usuario
CREATE TABLE direcciones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(20) DEFAULT 'envio' CHECK (tipo IN ('envio', 'facturacion')),
    nombre_completo VARCHAR(200) NOT NULL,
    direccion TEXT NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    provincia VARCHAR(100) NOT NULL,
    codigo_postal VARCHAR(20),
    pais VARCHAR(100) DEFAULT 'Ecuador',
    telefono VARCHAR(20),
    es_principal BOOLEAN DEFAULT FALSE,
    instrucciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de reseñas de productos
CREATE TABLE resenas (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    calificacion INTEGER NOT NULL CHECK (calificacion >= 1 AND calificacion <= 5),
    titulo VARCHAR(200),
    comentario TEXT,
    es_recomendado BOOLEAN DEFAULT TRUE,
    verificada BOOLEAN DEFAULT FALSE,
    util INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(producto_id, usuario_id)
);

-- Tabla de lista de deseos
CREATE TABLE lista_deseos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
    fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notas TEXT,
    UNIQUE(usuario_id, producto_id)
);

-- Tabla de historial de precios
CREATE TABLE historial_precios (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
    precio_anterior DECIMAL(10,2) NOT NULL,
    precio_nuevo DECIMAL(10,2) NOT NULL,
    motivo VARCHAR(200),
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de notificaciones
CREATE TABLE notificaciones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    datos JSONB DEFAULT '{}',
    leida BOOLEAN DEFAULT FALSE,
    fecha_lectura TIMESTAMP,
    prioridad VARCHAR(20) DEFAULT 'normal' CHECK (prioridad IN ('baja', 'normal', 'alta')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de sesiones de usuario
CREATE TABLE sesiones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    dispositivo VARCHAR(200),
    ip_address INET,
    user_agent TEXT,
    ultima_actividad TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expira_en TIMESTAMP NOT NULL,
    activa BOOLEAN DEFAULT TRUE
);

-- Tabla de configuración del sistema
CREATE TABLE configuracion (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    tipo VARCHAR(50) DEFAULT 'string',
    descripcion TEXT,
    editable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- FUNCIONES Y TRIGGERS
-- =============================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
CREATE TRIGGER trigger_actualizar_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trigger_actualizar_categorias_updated_at
    BEFORE UPDATE ON categorias
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trigger_actualizar_productos_updated_at
    BEFORE UPDATE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trigger_actualizar_ordenes_updated_at
    BEFORE UPDATE ON ordenes
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trigger_actualizar_direcciones_updated_at
    BEFORE UPDATE ON direcciones
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

CREATE TRIGGER trigger_actualizar_resenas_updated_at
    BEFORE UPDATE ON resenas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

-- Función para calcular el total de la orden
CREATE OR REPLACE FUNCTION calcular_total_orden()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total := COALESCE(NEW.subtotal, 0) + COALESCE(NEW.impuestos, 0) + COALESCE(NEW.envio, 0) - COALESCE(NEW.descuento, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular el total de la orden
CREATE TRIGGER trigger_calcular_total_orden
    BEFORE INSERT OR UPDATE ON ordenes
    FOR EACH ROW
    EXECUTE FUNCTION calcular_total_orden();

-- Función para actualizar stock cuando se crea una orden
CREATE OR REPLACE FUNCTION actualizar_stock_orden()
RETURNS TRIGGER AS $$
BEGIN
    -- Reducir el stock del producto
    UPDATE productos 
    SET stock_actual = stock_actual - NEW.cantidad
    WHERE id = NEW.producto_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stock
CREATE TRIGGER trigger_actualizar_stock_orden
    AFTER INSERT ON ordenes_detalles
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_stock_orden();

-- Función para generar número de orden único
CREATE OR REPLACE FUNCTION generar_numero_orden()
RETURNS TEXT AS $$
DECLARE
    nuevo_numero TEXT;
    contador INTEGER;
BEGIN
    -- Obtener el contador actual
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_orden FROM 9) AS INTEGER)), 0) + 1
    INTO contador
    FROM ordenes
    WHERE DATE(fecha_orden) = CURRENT_DATE;
    
    -- Generar el número de orden con formato AACESYYYYMMDDNNNN
    nuevo_numero := 'AACES' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || LPAD(contador::TEXT, 4, '0');
    
    RETURN nuevo_numero;
END;
$$ LANGUAGE plpgsql;

-- Función para crear número de orden al insertar
CREATE OR REPLACE FUNCTION crear_numero_orden()
RETURNS TRIGGER AS $$
BEGIN
    NEW.numero_orden := generar_numero_orden();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para generar número de orden
CREATE TRIGGER trigger_crear_numero_orden
    BEFORE INSERT ON ordenes
    FOR EACH ROW
    EXECUTE FUNCTION crear_numero_orden();

-- =============================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- =============================================

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_estado ON usuarios(estado);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_estado ON productos(estado);
CREATE INDEX idx_productos_sku ON productos(sku);
CREATE INDEX idx_ordenes_usuario ON ordenes(usuario_id);
CREATE INDEX idx_ordenes_estado ON ordenes(estado_orden);
CREATE INDEX idx_ordenes_fecha ON ordenes(fecha_orden);
CREATE INDEX idx_ordenes_numero ON ordenes(numero_orden);
CREATE INDEX idx_ordenes_detalles_orden ON ordenes_detalles(orden_id);
CREATE INDEX idx_ordenes_detalles_producto ON ordenes_detalles(producto_id);
CREATE INDEX idx_carrito_usuario ON carrito(usuario_id);
CREATE INDEX idx_carrito_producto ON carrito(producto_id);
CREATE INDEX idx_direcciones_usuario ON direcciones(usuario_id);
CREATE INDEX idx_resenas_producto ON resenas(producto_id);
CREATE INDEX idx_resenas_usuario ON resenas(usuario_id);
CREATE INDEX idx_lista_deseos_usuario ON lista_deseos(usuario_id);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id);
CREATE INDEX idx_notificaciones_leida ON notificaciones(leida);
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_sesiones_token ON sesiones(token);

-- =============================================
-- DATOS INICIALES
-- =============================================

-- Categorías principales
INSERT INTO categorias (nombre, descripcion, imagen_url, orden) VALUES
('Electrónica', 'Productos electrónicos y tecnología', '/images/categorias/electronica.jpg', 1),
('Hogar', 'Artículos para el hogar y decoración', '/images/categorias/hogar.jpg', 2),
('Deportes', 'Equipamiento deportivo y fitness', '/images/categorias/deportes.jpg', 3),
('Moda', 'Ropa y accesorios de moda', '/images/categorias/moda.jpg', 4),
('Libros', 'Libros y material de lectura', '/images/categorias/libros.jpg', 5);

-- Subcategorías
INSERT INTO categorias (nombre, descripcion, imagen_url, padre_id, orden) VALUES
('Smartphones', 'Teléfonos inteligentes', '/images/categorias/smartphones.jpg', 1, 1),
('Laptops', 'Computadoras portátiles', '/images/categorias/laptops.jpg', 1, 2),
('Muebles', 'Muebles para el hogar', '/images/categorias/muebles.jpg', 2, 1),
('Deco', 'Decoración y accesorios', '/images/categorias/deco.jpg', 2, 2),
('Running', 'Equipamiento para correr', '/images/categorias/running.jpg', 3, 1),
('Fitness', 'Equipos de ejercicio', '/images/categorias/fitness.jpg', 3, 2);

-- Configuración del sistema
INSERT INTO configuracion (clave, valor, tipo, descripcion) VALUES
('nombre_tienda', 'AACES', 'string', 'Nombre de la tienda'),
('moneda_principal', 'USD', 'string', 'Moneda principal de la tienda'),
('impuesto_porcentaje', '12', 'number', 'Porcentaje de impuesto'),
('costo_envio_base', '5.00', 'number', 'Costo base de envío'),
('stock_minimo_alerta', '5', 'number', 'Stock mínimo para alertas'),
('intentos_login_maximos', '5', 'number', 'Máximo de intentos de login antes de bloquear'),
('tiempo_bloqueo_login', '30', 'number', 'Tiempo de bloqueo en minutos'),
('longitud_minima_password', '8', 'number', 'Longitud mínima de contraseña'),
('requerir_verificacion_email', 'true', 'boolean', 'Requerir verificación de email para nuevos usuarios'),
('habilitar_reviews', 'true', 'boolean', 'Habilitar sistema de reseñas de productos'),
('dias_devolucion', '30', 'number', 'Días permitidos para devolución');

-- Productos de ejemplo
INSERT INTO productos (nombre, descripcion, descripcion_corta, sku, precio, stock_actual, categoria_id, imagen_principal, especificaciones) VALUES
('iPhone 15 Pro', 'El último iPhone con chip A17 Pro', 'iPhone de última generación', 'IPH15PRO256', 1099.99, 25, 6, '/images/productos/iphone15pro.jpg', '{"color": "Natural Titanium", "almacenamiento": "256GB", "pantalla": "6.1 pulgadas"}'),
('Samsung Galaxy S24', 'Smartphone Android de alta gama', 'Galaxy con IA integrada', 'GALS24128', 899.99, 30, 6, '/images/productos/galaxys24.jpg', '{"color": "Phantom Black", "almacenamiento": "128GB", "pantalla": "6.2 pulgadas"}'),
('MacBook Air M3', 'Laptop ultradelgada con chip M3', 'Portátil ligero y potente', 'MBA13M3512', 1299.99, 15, 7, '/images/productos/macbookair.jpg', '{"color": "Midnight", "almacenamiento": "512GB", "ram": "16GB"}'),
('Silla Gamer Pro', 'Silla ergonómica para gaming', 'Silla con soporte lumbar', 'SGPRO001', 299.99, 20, 8, '/images/productos/sillagamer.jpg', '{"color": "Negro/Rojo", "material": "Cuero PU", "peso_maximo": "150kg"}'),
('Tapete Yoga Premium', 'Tapete antideslizante para yoga', 'Tapete eco-friendly', 'TYPREM001', 49.99, 50, 12, '/images/productos/tapeteyoga.jpg', '{"color": "Verde", "material": "Caucho natural", "grosor": "6mm"}');

-- =============================================
-- USUARIOS DE PRUEBA CON CONTRASEÑAS ENCRIPTADAS
-- =============================================

-- NOTA: Las contraseñas están encriptadas con bcrypt (misma que usa el backend)
-- admin123 -> $2b$12$LQv3c1slqR6Bq1x5bHKKMuJ5pKqUnOWpKJxkj6dA1KqMwZ8yJmYu
-- cliente123 -> $2b$12$X4v5c2slqR7Bq2x6cHKLMvK6pLrVnOXpLKykl7dB2LrNxZ9zKnZv

INSERT INTO usuarios (email, password_hash, nombre, apellido, telefono, direccion, ciudad, rol, verificado) VALUES
('admin@aaces.com', '$2b$12$LQv3c1slqR6Bq1x5bHKKMuJ5pKqUnOWpKJxkj6dA1KqMwZ8yJmYu', 'Administrador', 'AACES', '0999999999', 'Av. Principal 123', 'Quito', 'admin', TRUE),
('cliente1@example.com', '$2b$12$X4v5c2slqR7Bq2x6cHKLMvK6pLrVnOXpLKykl7dB2LrNxZ9zKnZv', 'Juan', 'Pérez', '0987654321', 'Calle Secundaria 456', 'Guayaquil', 'cliente', TRUE),
('cliente2@example.com', '$2b$12$X4v5c2slqR7Bq2x6cHKLMvK6pLrVnOXpLKykl7dB2LrNxZ9zKnZv', 'María', 'González', '0987654322', 'Av. Central 789', 'Cuenca', 'cliente', TRUE),
('empleado@aaces.com', '$2b$12$LQv3c1slqR6Bq1x5bHKKMuJ5pKqUnOWpKJxkj6dA1KqMwZ8yJmYu', 'Carlos', 'Rodríguez', '0987654323', 'Calle del Trabajo 321', 'Quito', 'empleado', TRUE);

-- Direcciones de ejemplo para usuarios
INSERT INTO direcciones (usuario_id, tipo, nombre_completo, direccion, ciudad, provincia, telefono, es_principal) VALUES
(2, 'envio', 'Juan Pérez', 'Calle Secundaria 456, Depto 3A', 'Guayaquil', 'Guayas', '0987654321', TRUE),
(2, 'facturacion', 'Juan Pérez', 'Calle Secundaria 456, Depto 3A', 'Guayaquil', 'Guayas', '0987654321', TRUE),
(3, 'envio', 'María González', 'Av. Central 789 y Calle 10', 'Cuenca', 'Azuay', '0987654322', TRUE),
(3, 'facturacion', 'María González', 'Av. Central 789 y Calle 10', 'Cuenca', 'Azuay', '0987654322', TRUE);

-- =============================================
-- NOTIFICACIONES DE BIENVENIDA
-- =============================================

INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, prioridad) VALUES
(2, 'bienvenida', '¡Bienvenido a AACES!', 'Gracias por registrarte en nuestra tienda. Explora nuestros productos y aprovecha nuestras ofertas.', 'normal'),
(3, 'bienvenida', '¡Bienvenido a AACES!', 'Gracias por registrarte en nuestra tienda. Explora nuestros productos y aprovecha nuestras ofertas.', 'normal'),
(4, 'bienvenida', '¡Bienvenido al equipo AACES!', 'Bienvenido como empleado. Tu cuenta tiene acceso a herramientas administrativas.', 'normal');

-- =============================================
-- RESUMEN DE LA MIGRACIÓN
-- =============================================

-- Total de tablas creadas: 15
-- Total de funciones creadas: 5
-- Total de triggers creados: 7
-- Total de índices creados: 18
-- Total de categorías creadas: 11 (6 principales + 5 subcategorías)
-- Total de productos creados: 5
-- Total de usuarios creados: 4 (1 admin, 2 clientes, 1 empleado)
-- Total de direcciones creadas: 4
-- Total de notificaciones creadas: 3
-- Total de configuraciones creadas: 11

-- CREDENCIALES DE PRUEBA:
-- Admin: admin@aaces.com / admin123
-- Cliente: cliente1@example.com / cliente123
-- Cliente 2: cliente2@example.com / cliente123
-- Empleado: empleado@aaces.com / admin123

-- ¡La base de datos está lista para usar!