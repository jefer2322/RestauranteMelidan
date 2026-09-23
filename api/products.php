<?php
/**
 * api/products.php - Categorías y Platos del Menú en PostgreSQL
 * Restaurante Melidan / Melisa
 */

require_once __DIR__ . '/config.php';
setupApiHeaders();

$db = getDBConnection();

// Obtener categorías
$catStmt = $db->query("SELECT id_categoria, nombre, descripcion FROM categorias ORDER BY id_categoria ASC");
$categorias = $catStmt->fetchAll();

// Obtener productos
$prodStmt = $db->query("
    SELECT 
        p.id_producto AS id,
        p.id_categoria,
        c.nombre AS categoria_nombre,
        p.nombre AS name,
        p.descripcion AS description,
        p.precio AS price,
        p.tipo_coccion,
        p.tiempo_preparacion_min,
        p.destacado_menu,
        p.disponible,
        p.imagen_url AS image
    FROM productos p
    LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
    WHERE p.disponible = TRUE
    ORDER BY p.id_categoria ASC, p.id_producto ASC
");
$productos = $prodStmt->fetchAll();

jsonResponse([
    'success' => true,
    'categorias' => $categorias,
    'productos' => $productos
]);
