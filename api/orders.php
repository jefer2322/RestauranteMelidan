<?php
/**
 * api/orders.php - Gestión de Comandas y KDS en PostgreSQL
 * Restaurante Melidan / Melisa
 */

require_once __DIR__ . '/config.php';
setupApiHeaders();

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        handleGetOrders($db);
        break;
    case 'POST':
        handleCreateOrder($db);
        break;
    case 'PUT':
    case 'PATCH':
        handleUpdateOrderStatus($db);
        break;
    default:
        jsonResponse(['success' => false, 'message' => 'Método HTTP no soportado'], 405);
}

/**
 * Listar pedidos activos con sus detalles para KDS y Salón
 */
function handleGetOrders($db) {
    // 1. Obtener pedidos
    $stmt = $db->query("
        SELECT 
            p.id_pedido,
            p.numero_comanda,
            p.id_mesa,
            m.numero_mesa,
            p.id_usuario,
            p.nombre_cliente,
            p.mozo_nombre,
            p.total,
            p.estado,
            p.fecha_hora,
            TO_CHAR(p.fecha_hora, 'HH12:MI AM') AS hora_formato,
            ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.fecha_hora)) / 60) AS minutos_transcurridos
        FROM pedidos p
        LEFT JOIN mesas m ON p.id_mesa = m.id_mesa
        ORDER BY p.id_pedido DESC
    ");
    $orders = $stmt->fetchAll();

    // 2. Obtener items de cada pedido
    $orderMap = [];
    $orderIds = [];
    foreach ($orders as &$ord) {
        $ord['items'] = [];
        $orderIds[] = $ord['id_pedido'];
        $orderMap[$ord['id_pedido']] = &$ord;
    }

    if (!empty($orderIds)) {
        $inClause = implode(',', array_map('intval', $orderIds));
        $itemStmt = $db->query("
            SELECT 
                d.id_detalle,
                d.id_pedido,
                d.id_producto,
                pr.nombre AS nombre_plato,
                d.cantidad,
                d.precio_unitario,
                d.observaciones
            FROM detalle_pedidos d
            LEFT JOIN productos pr ON d.id_producto = pr.id_producto
            WHERE d.id_pedido IN ($inClause)
            ORDER BY d.id_detalle ASC
        ");
        $items = $itemStmt->fetchAll();

        foreach ($items as $item) {
            if (isset($orderMap[$item['id_pedido']])) {
                $orderMap[$item['id_pedido']]['items'][] = $item;
            }
        }
    }

    jsonResponse([
        'success' => true,
        'count' => count($orders),
        'orders' => array_values($orders)
    ]);
}

/**
 * Actualizar el estado de una comanda (KDS o Mozo)
 */
function handleUpdateOrderStatus($db) {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $id = intval($_GET['id'] ?? ($input['id_pedido'] ?? ($input['id'] ?? 0)));
    $newStatus = trim($_GET['status'] ?? ($input['estado'] ?? ($input['status'] ?? '')));

    if (!$id) {
        jsonResponse(['success' => false, 'message' => 'ID de pedido requerido'], 400);
    }

    // Mapeo amigable de estados
    $statusMap = [
        'nuevos' => 'pendiente',
        'pendiente' => 'pendiente',
        'cocinando' => 'en_cocina',
        'en_cocina' => 'en_cocina',
        'listos' => 'listo',
        'listo' => 'listo',
        'entregado' => 'entregado',
        'cancelado' => 'cancelado'
    ];

    $cleanStatus = strtolower($newStatus);
    if (!isset($statusMap[$cleanStatus])) {
        jsonResponse(['success' => false, 'message' => "Estado '$newStatus' no válido"], 400);
    }

    $pgStatus = $statusMap[$cleanStatus];

    $stmt = $db->prepare("UPDATE pedidos SET estado = :estado WHERE id_pedido = :id RETURNING id_pedido, numero_comanda, estado");
    $stmt->execute(['estado' => $pgStatus, 'id' => $id]);
    $updated = $stmt->fetch();

    if (!$updated) {
        // Intentar buscar por numero_comanda
        $stmt2 = $db->prepare("UPDATE pedidos SET estado = :estado WHERE numero_comanda = :num RETURNING id_pedido, numero_comanda, estado");
        $stmt2->execute(['estado' => $pgStatus, 'num' => $id]);
        $updated = $stmt2->fetch();
    }

    if (!$updated) {
        jsonResponse(['success' => false, 'message' => 'Comanda no encontrada en la base de datos'], 404);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Estado de comanda actualizado en PostgreSQL',
        'order' => $updated
    ]);
}

/**
 * Crear un nuevo pedido desde Carta QR o Mozo
 */
function handleCreateOrder($db) {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    $tableNum = intval($input['table_num'] ?? 4);
    $clientName = trim($input['client_name'] ?? 'Cliente Mesa ' . $tableNum);
    $waiterName = trim($input['waiter_name'] ?? 'Carlos P.');
    $items = $input['items'] ?? [];

    if (empty($items)) {
        jsonResponse(['success' => false, 'message' => 'El pedido debe contener al menos un producto'], 400);
    }

    // Buscar ID de mesa
    $stmtTable = $db->prepare("SELECT id_mesa FROM mesas WHERE numero_mesa = :num LIMIT 1");
    $stmtTable->execute(['num' => $tableNum]);
    $table = $stmtTable->fetch();
    $idMesa = $table ? $table['id_mesa'] : 4;

    // Generar nuevo número de comanda
    $stmtMax = $db->query("SELECT COALESCE(MAX(numero_comanda), 1050) + 1 AS next_comanda FROM pedidos");
    $nextComanda = $stmtMax->fetchColumn();

    $db->beginTransaction();
    try {
        $total = 0;
        foreach ($items as $item) {
            $total += ($item['precio'] ?? $item['price'] ?? 0) * ($item['cantidad'] ?? $item['qty'] ?? 1);
        }

        // Insertar en pedidos
        $stmtOrder = $db->prepare("
            INSERT INTO pedidos (numero_comanda, id_mesa, nombre_cliente, mozo_nombre, total, estado)
            VALUES (:comanda, :mesa, :cliente, :mozo, :total, 'pendiente')
            RETURNING id_pedido
        ");
        $stmtOrder->execute([
            'comanda' => $nextComanda,
            'mesa' => $idMesa,
            'cliente' => $clientName,
            'mozo' => $waiterName,
            'total' => $total
        ]);
        $orderId = $stmtOrder->fetchColumn();

        // Insertar detalles
        $stmtDetail = $db->prepare("
            INSERT INTO detalle_pedidos (id_pedido, id_producto, cantidad, precio_unitario, observaciones)
            VALUES (:pedido, :producto, :cant, :precio, :obs)
        ");

        foreach ($items as $item) {
            $prodId = intval($item['id_producto'] ?? ($item['id'] ?? 1));
            $cant = intval($item['cantidad'] ?? ($item['qty'] ?? 1));
            $price = floatval($item['precio'] ?? ($item['price'] ?? 0));
            $obs = $item['observaciones'] ?? ($item['notes'] ?? '');

            $stmtDetail->execute([
                'pedido' => $orderId,
                'producto' => $prodId,
                'cant' => $cant,
                'precio' => $price,
                'obs' => $obs
            ]);
        }

        // Marcar mesa como ocupada
        $db->prepare("UPDATE mesas SET estado = 'ocupada' WHERE id_mesa = :mesa")->execute(['mesa' => $idMesa]);

        $db->commit();

        jsonResponse([
            'success' => true,
            'message' => 'Comanda creada con éxito en PostgreSQL',
            'order' => [
                'id_pedido' => $orderId,
                'numero_comanda' => $nextComanda,
                'total' => $total,
                'estado' => 'pendiente'
            ]
        ], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonResponse(['success' => false, 'message' => 'Error al crear pedido: ' . $e->getMessage()], 500);
    }
}
