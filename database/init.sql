-- ============================================================
-- BASE DE DATOS: Restaurante Melidan
-- Motor: PostgreSQL 18
-- Modelo Normalizado (1FN, 2FN, 3FN) y Buenas Prácticas
-- ============================================================

-- 1. Limpieza de tablas existentes (en cascada)
DROP TABLE IF EXISTS recuperacion_claves CASCADE;
DROP TABLE IF EXISTS comprobantes CASCADE;
DROP TABLE IF EXISTS ventas CASCADE;
DROP TABLE IF EXISTS detalle_pedidos CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS mesas CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS restaurante_info CASCADE;

-- Limpieza de tipos ENUM
DROP TYPE IF EXISTS rol_usuario CASCADE;
DROP TYPE IF EXISTS estado_mesa CASCADE;
DROP TYPE IF EXISTS tipo_coccion_enum CASCADE;
DROP TYPE IF EXISTS estado_pedido CASCADE;
DROP TYPE IF EXISTS metodo_pago_enum CASCADE;
DROP TYPE IF EXISTS estado_pago_enum CASCADE;
DROP TYPE IF EXISTS tipo_comprobante_enum CASCADE;

-- Creación de tipos ENUM nativos
CREATE TYPE rol_usuario AS ENUM ('administrador', 'mozo', 'cajero', 'cocina');
CREATE TYPE estado_mesa AS ENUM ('disponible', 'ocupada', 'reservada');
CREATE TYPE tipo_coccion_enum AS ENUM ('fuego_lento', 'horno_artesanal', 'estandar');
CREATE TYPE estado_pedido AS ENUM ('pendiente', 'en_cocina', 'listo', 'entregado', 'cancelado');
CREATE TYPE metodo_pago_enum AS ENUM ('aplicacion', 'efectivo_caja', 'tarjeta_caja');
CREATE TYPE estado_pago_enum AS ENUM ('exitoso', 'fallido', 'pendiente');
CREATE TYPE tipo_comprobante_enum AS ENUM ('boleta', 'factura');

-- ============================================================
-- 2. TABLA: Información Institucional y Marca (Fila Única)
-- ============================================================
CREATE TABLE restaurante_info (
    id_restaurante INT PRIMARY KEY DEFAULT 1,
    nombre VARCHAR(100) NOT NULL DEFAULT 'Melidan Restaurante',
    slogan VARCHAR(150) DEFAULT 'Tradición y sabor a fuego lento',
    anio_fundacion INT DEFAULT 2024,
    logo_url VARCHAR(255),
    ruc VARCHAR(11) UNIQUE NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    CONSTRAINT chk_solo_un_restaurante CHECK (id_restaurante = 1)
);

-- ============================================================
-- 3. TABLA: Usuarios y Autenticación
-- ============================================================
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol rol_usuario NOT NULL DEFAULT 'mozo',
    turno VARCHAR(100) DEFAULT 'Turno Mañana (8:00 AM - 4:00 PM)',
    estado VARCHAR(20) DEFAULT 'Activo',
    avatar VARCHAR(255) DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. TABLA: Recuperación de Claves (Tokens OTP)
-- ============================================================
CREATE TABLE recuperacion_claves (
    id SERIAL PRIMARY KEY,
    id_usuario INT NOT NULL,
    codigo VARCHAR(6) NOT NULL,
    expira_en TIMESTAMPTZ NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recuperacion_usuario 
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

-- ============================================================
-- 5. TABLA: Mesas y Códigos QR
-- ============================================================
CREATE TABLE mesas (
    id_mesa SERIAL PRIMARY KEY,
    numero_mesa INT UNIQUE NOT NULL,
    codigo_qr VARCHAR(255) UNIQUE NOT NULL,
    capacidad INT DEFAULT 4 CHECK (capacidad > 0),
    estado estado_mesa DEFAULT 'disponible'
);

-- ============================================================
-- 6. TABLA: Categorías del Menú
-- ============================================================
CREATE TABLE categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT
);

-- ============================================================
-- 7. TABLA: Productos / Carta
-- ============================================================
CREATE TABLE productos (
    id_producto SERIAL PRIMARY KEY,
    id_categoria INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
    tipo_coccion tipo_coccion_enum DEFAULT 'estandar',
    tiempo_preparacion_min INT DEFAULT 15 CHECK (tiempo_preparacion_min >= 0),
    destacado_menu BOOLEAN DEFAULT FALSE,
    disponible BOOLEAN DEFAULT TRUE,
    imagen_url VARCHAR(255),
    CONSTRAINT fk_productos_categoria 
        FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria) ON DELETE CASCADE
);

-- ============================================================
-- 8. TABLA: Pedidos (Monitoreo de Salón y KDS Cocina)
-- ============================================================
CREATE TABLE pedidos (
    id_pedido SERIAL PRIMARY KEY,
    numero_comanda INT UNIQUE NOT NULL,
    id_mesa INT NOT NULL,
    id_usuario INT NULL,
    nombre_cliente VARCHAR(100) DEFAULT 'Comensal',
    estado estado_pedido DEFAULT 'pendiente',
    fecha_hora TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pedidos_mesa 
        FOREIGN KEY (id_mesa) REFERENCES mesas(id_mesa),
    CONSTRAINT fk_pedidos_usuario 
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

-- ============================================================
-- 9. TABLA: Detalle de Pedidos
-- ============================================================
CREATE TABLE detalle_pedidos (
    id_detalle SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    precio_unitario NUMERIC(10, 2) NOT NULL CHECK (precio_unitario >= 0),
    observaciones VARCHAR(255) NULL,
    CONSTRAINT fk_detalle_pedido 
        FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_producto 
        FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
);

-- ============================================================
-- 10. TABLA: Ventas y Pagos
-- ============================================================
CREATE TABLE ventas (
    id_venta SERIAL PRIMARY KEY,
    id_pedido INT UNIQUE NOT NULL,
    metodo_pago metodo_pago_enum NOT NULL,
    monto_total NUMERIC(10, 2) NOT NULL CHECK (monto_total >= 0),
    estado_pago estado_pago_enum DEFAULT 'exitoso',
    fecha_pago TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ventas_pedido 
        FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido)
);

-- ============================================================
-- 11. TABLA: Comprobantes Digitales
-- ============================================================
CREATE TABLE comprobantes (
    id_comprobante SERIAL PRIMARY KEY,
    id_venta INT UNIQUE NOT NULL,
    tipo_comprobante tipo_comprobante_enum NOT NULL,
    numero_comprobante VARCHAR(20) UNIQUE NOT NULL,
    fecha_emision TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comprobantes_venta 
        FOREIGN KEY (id_venta) REFERENCES ventas(id_venta)
);

-- ============================================================
-- INSERCIÓN DE DATOS DE PRUEBA
-- ============================================================

-- 1. Restaurante
INSERT INTO restaurante_info (id_restaurante, nombre, slogan, anio_fundacion, logo_url, ruc, direccion, telefono)
VALUES (1, 'Melidan Restaurante', 'Tradición y sabor a fuego lento', 2024, 'img/logo.png', '20601234567', 'Av. La Marina 2450, San Miguel', '+51 987 654 321');

-- 2. Usuarios
INSERT INTO usuarios (nombre, email, password_hash, rol, turno, estado, avatar) VALUES
('Don Roberto', 'admin@melidan.com', '$2y$12$cS6vyppok5E9eXWF0xXu6.0sUnnINo1JBho9M2BddNUIH6J8d6zGy', 'administrador', 'Turno Completo / Gerencia', 'Activo', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'),
('Marco Antonio (Chef)', 'chef@melidan.com', '$2y$12$cS6vyppok5E9eXWF0xXu6.0sUnnINo1JBho9M2BddNUIH6J8d6zGy', 'cocina', 'Turno Mañana (7:00 AM - 3:00 PM)', 'Activo', 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=150&q=80'),
('Carlos Paredes', 'carlos.p@melidan.com', '$2y$12$cS6vyppok5E9eXWF0xXu6.0sUnnINo1JBho9M2BddNUIH6J8d6zGy', 'mozo', 'Turno Mañana (8:00 AM - 4:00 PM)', 'Activo', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'),
('María Salazar', 'maria.s@melidan.com', '$2y$12$cS6vyppok5E9eXWF0xXu6.0sUnnINo1JBho9M2BddNUIH6J8d6zGy', 'mozo', 'Turno Tarde (4:00 PM - 12:00 AM)', 'Activo', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80'),
('Jorge Ruiz', 'jorge.r@melidan.com', '$2y$12$cS6vyppok5E9eXWF0xXu6.0sUnnINo1JBho9M2BddNUIH6J8d6zGy', 'mozo', 'Turno Rotativo', 'Inactivo', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80');

-- 3. Mesas
INSERT INTO mesas (numero_mesa, codigo_qr, capacidad, estado) VALUES
(1, 'QR_MESA_01_MELIDAN', 4, 'disponible'),
(2, 'QR_MESA_02_MELIDAN', 2, 'ocupada'),
(3, 'QR_MESA_03_MELIDAN', 4, 'disponible'),
(4, 'QR_MESA_04_MELIDAN', 4, 'ocupada'),
(5, 'QR_MESA_05_MELIDAN', 6, 'disponible');

-- 4. Categorías
INSERT INTO categorias (id_categoria, nombre, descripcion) VALUES
(1, 'Especialidades al Horno', 'Platos preparados en horno de barro a fuego lento y leña tradicional.'),
(2, 'Platos de Fondo', 'Nuestras mejores recetas criollas preparadas al wok y a fuego lento.'),
(3, 'Bebidas', 'Refrescos artesanales naturales y bebidas frías.'),
(4, 'Postres', 'Postres caseros y dulces tradicionales.');

-- 5. Productos
INSERT INTO productos (id_producto, id_categoria, nombre, descripcion, precio, tipo_coccion, tiempo_preparacion_min, destacado_menu, disponible, imagen_url) VALUES
(1, 1, 'Lechón a Fuego Lento', 'Corte jugoso marinado en especias tradicionales horneado a leña por 6 horas.', 48.00, 'fuego_lento', 35, TRUE, TRUE, 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80'),
(2, 1, 'Costillar Glaseado a la Leña', 'Costillar tierno caramelizado con salsa BBQ artesanal y especias andinas.', 42.00, 'horno_artesanal', 25, TRUE, TRUE, 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=400&q=80'),
(3, 2, 'Lomo Saltado Tradicional', 'Trozos de lomo fino salteados al wok con cebolla, tomate crujiente y papas fritas.', 38.00, 'estandar', 15, TRUE, TRUE, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80'),
(4, 2, 'Ají de Gallina Cremoso', 'Pechuga deshilachada en crema suave de ají amarillo con papas y aceituna botija.', 28.00, 'estandar', 12, FALSE, TRUE, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&q=80'),
(5, 3, 'Chicha Morada Artesanal (1L)', 'Bebida natural de maíz morado hervida con piña, manzana y canela de la casa.', 14.00, 'estandar', 5, TRUE, TRUE, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80');

-- 6. Pedidos Activos
INSERT INTO pedidos (numero_comanda, id_mesa, id_usuario, nombre_cliente, estado, fecha_hora)
VALUES 
(1024, 2, 3, 'Sr. Méndez', 'en_cocina', CURRENT_TIMESTAMP - INTERVAL '12 minutes'),
(1025, 4, 4, 'Cliente Mesa 04', 'listo', CURRENT_TIMESTAMP - INTERVAL '20 minutes');

-- 7. Detalle de Pedidos
INSERT INTO detalle_pedidos (id_pedido, id_producto, cantidad, precio_unitario, observaciones) VALUES
(1, 1, 1, 48.00, 'Término medio, salsa aparte'),
(2, 3, 1, 38.00, 'Papas bien doradas'),
(2, 5, 1, 14.00, 'Bien fría');

-- 8. Venta de prueba
INSERT INTO ventas (id_pedido, metodo_pago, monto_total, estado_pago, fecha_pago) VALUES
(2, 'tarjeta_caja', 52.00, 'exitoso', CURRENT_TIMESTAMP - INTERVAL '5 minutes');

-- 9. Comprobante de prueba
INSERT INTO comprobantes (id_venta, tipo_comprobante, numero_comprobante) VALUES
(1, 'boleta', 'B001-00001025');
