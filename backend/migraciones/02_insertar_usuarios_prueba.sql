-- Script de inserción de usuarios de prueba
-- Este script inserta usuarios administrador y cliente para pruebas

-- Insertar usuario administrador
INSERT INTO clientes (nombre, correo, password_hash, ciudad_base, categoria, estado, acepta_terminos, fecha_acepta_terminos) 
VALUES (
    'Administrador AACES',
    'admin@aaces.com',
    crypt('admin123', gen_salt('bf')),
    'Quito',
    'premium',
    'activo',
    true,
    CURRENT_TIMESTAMP
);

-- Insertar usuario cliente
INSERT INTO clientes (nombre, correo, password_hash, ciudad_base, categoria, estado, acepta_terminos, fecha_acepta_terminos) 
VALUES (
    'Cliente de Prueba',
    'cliente1@example.com',
    crypt('cliente123', gen_salt('bf')),
    'Quito',
    'regular',
    'activo',
    true,
    CURRENT_TIMESTAMP
);

-- Verificar usuarios insertados
SELECT 
    id, nombre, correo, categoria, estado,
    CASE 
        WHEN correo = 'admin@aaces.com' THEN 'admin'
        ELSE 'cliente'
    END as tipo_usuario
FROM clientes 
WHERE correo IN ('admin@aaces.com', 'cliente1@example.com');