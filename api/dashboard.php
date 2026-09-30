<?php
/**
 * api/dashboard.php - Métricas y Monitoreo del Panel de Administrador
 * Conectado a PostgreSQL 18 (Melidan_db)
 */

require_once __DIR__ . '/config.php';
setupApiHeaders();

$db = getDBConnection();

// 1. Total Ventas (pagos exitosos)
$stmtSales = $db->query("
    SELECT COALESCE(SUM(monto_total), 0.00) AS total_ventas 
    FROM ventas 
    WHERE estado_pago = 'exitoso'
");
$ventasHoy = floatval($stmtSales->fetchColumn() ?: 0.00);

// 2. Pedidos Activos (pendiente, en_cocina, listo)
$stmtActiveOrders = $db->query("
    SELECT COUNT(*) AS total 
    FROM pedidos 
    WHERE estado IN ('pendiente', 'en_cocina', 'listo')
");
$pedidosActivos = intval($stmtActiveOrders->fetchColumn() ?: 0);

// 3. Mesas Ocupadas
$stmtTables = $db->query("
    SELECT 
        COUNT(CASE WHEN estado = 'ocupada' THEN 1 END) AS ocupadas,
        COUNT(*) AS total_mesas
    FROM mesas
");
$tablesData = $stmtTables->fetch();
$mesasOcupadas = intval($tablesData['ocupadas'] ?? 0);
$totalMesas = intval($tablesData['total_mesas'] ?? 0);

// 4. Tiempo Promedio
$tiempoPromedio = "14 min";

// 5. Monitoreo de Salón (Comandas activas con cálculos normalizados)
$stmtMonitor = $db->query("
    SELECT 
        p.id_pedido,
        p.numero_comanda,
        m.numero_mesa,
        COALESCE(u.nombre, 'Mozo de Turno') AS mozo_nombre,
        p.nombre_cliente,
        COALESCE(
            (SELECT SUM(dp.cantidad * dp.precio_unitario) FROM detalle_pedidos dp WHERE dp.id_pedido = p.id_pedido),
            v.monto_total,
            0.00
        ) AS total,
        p.estado,
        CASE 
            WHEN p.estado = 'listo' THEN 'Listo para entregar'
            WHEN p.estado = 'en_cocina' THEN 'En cocina'
            WHEN p.estado = 'pendiente' THEN 'Pendiente'
            WHEN p.estado = 'entregado' THEN 'Entregado'
            ELSE p.estado::text
        END AS badge_text,
        TO_CHAR(p.fecha_hora, 'HH12:MI AM') AS hora
    FROM pedidos p
    LEFT JOIN mesas m ON p.id_mesa = m.id_mesa
    LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
    LEFT JOIN ventas v ON p.id_pedido = v.id_pedido
    WHERE p.estado IN ('en_cocina', 'listo', 'pendiente')
    ORDER BY p.id_pedido ASC
    LIMIT 10
");
$salonOrders = $stmtMonitor->fetchAll();

// 6. Información del restaurante
$infoStmt = $db->query("SELECT nombre, slogan, ruc, direccion, telefono FROM restaurante_info WHERE id_restaurante = 1 LIMIT 1");
$restInfo = $infoStmt->fetch() ?: [];

jsonResponse([
    'success' => true,
    'database' => 'PostgreSQL 18 (Melidan_db)',
    'restaurante' => $restInfo,
    'metrics' => [
        'ventas_hoy' => $ventasHoy,
        'ventas_hoy_formato' => 'S/ ' . number_format($ventasHoy, 2),
        'pedidos_activos' => $pedidosActivos,
        'mesas_ocupadas' => $mesasOcupadas,
        'total_mesas' => $totalMesas,
        'mesas_texto' => "{$mesasOcupadas} / {$totalMesas}",
        'tiempo_promedio' => $tiempoPromedio
    ],
    'salon_monitor' => $salonOrders
]);
