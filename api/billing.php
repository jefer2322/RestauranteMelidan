<?php
/**
 * api/billing.php - Gestión de Ventas y Comprobantes Electrónicos en PostgreSQL
 * Restaurante Melidan (Melidan_db)
 */

require_once __DIR__ . '/config.php';
setupApiHeaders();

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($method) {
    case 'GET':
        handleGetReceipt($db);
        break;
    case 'POST':
        handleCreateReceipt($db);
        break;
    default:
        jsonResponse(['success' => false, 'message' => 'Método no soportado'], 405);
}

/**
 * Obtener comprobante electrónico con datos fiscales y detalle de platos
 */
function handleGetReceipt($db) {
    $orderId = intval($_GET['id_pedido'] ?? 0);
    $receiptId = intval($_GET['id_comprobante'] ?? 0);

    // Obtener info institucional
    $stmtRest = $db->query("SELECT nombre, slogan, ruc, direccion, telefono FROM restaurante_info WHERE id_restaurante = 1 LIMIT 1");
    $rest = $stmtRest->fetch() ?: [
        'nombre' => 'Melidan Restaurante',
        'ruc' => '20601234567',
        'direccion' => 'Av. La Marina 2450, San Miguel',
        'telefono' => '+51 987 654 321'
    ];

    $whereClause = "WHERE 1=1";
    $params = [];
    if ($receiptId > 0) {
        $whereClause .= " AND c.id_comprobante = :cid";
        $params['cid'] = $receiptId;
    } elseif ($orderId > 0) {
        $whereClause .= " AND v.id_pedido = :oid";
        $params['oid'] = $orderId;
    } else {
        $whereClause .= " ORDER BY c.id_comprobante DESC LIMIT 1";
    }

    $sql = "
        SELECT 
            c.id_comprobante,
            c.tipo_comprobante,
            c.numero_comprobante,
            c.fecha_emision,
            TO_CHAR(c.fecha_emision, 'DD/MM/YYYY HH12:MI AM') AS fecha_formato,
            v.id_venta,
            v.id_pedido,
            v.metodo_pago,
            v.monto_total,
            v.estado_pago,
            p.numero_comanda,
            p.nombre_cliente,
            m.numero_mesa,
            COALESCE(u.nombre, 'Caja Principal') AS atendido_por
        FROM comprobantes c
        INNER JOIN ventas v ON c.id_venta = v.id_venta
        INNER JOIN pedidos p ON v.id_pedido = p.id_pedido
        LEFT JOIN mesas m ON p.id_mesa = m.id_mesa
        LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
        $whereClause
    ";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $receipt = $stmt->fetch();

    if (!$receipt) {
        // Si no hay comprobante pero hay id_pedido, buscar los datos del pedido para emitirlo
        if ($orderId > 0) {
            $stmtOrder = $db->prepare("
                SELECT p.id_pedido, p.numero_comanda, p.nombre_cliente, m.numero_mesa,
                       COALESCE((SELECT SUM(dp.cantidad * dp.precio_unitario) FROM detalle_pedidos dp WHERE dp.id_pedido = p.id_pedido), 0.00) AS total
                FROM pedidos p
                LEFT JOIN mesas m ON p.id_mesa = m.id_mesa
                WHERE p.id_pedido = :id
            ");
            $stmtOrder->execute(['id' => $orderId]);
            $order = $stmtOrder->fetch();
            if ($order) {
                jsonResponse([
                    'success' => true,
                    'has_receipt' => false,
                    'restaurante' => $rest,
                    'order' => $order
                ]);
            }
        }
        jsonResponse(['success' => false, 'message' => 'Comprobante no encontrado'], 404);
    }

    // Obtener detalle de productos del comprobante
    $stmtItems = $db->prepare("
        SELECT 
            d.id_detalle,
            d.cantidad,
            d.precio_unitario,
            (d.cantidad * d.precio_unitario) AS subtotal,
            pr.nombre AS nombre_plato,
            d.observaciones
        FROM detalle_pedidos d
        INNER JOIN productos pr ON d.id_producto = pr.id_producto
        WHERE d.id_pedido = :pid
        ORDER BY d.id_detalle ASC
    ");
    $stmtItems->execute(['pid' => $receipt['id_pedido']]);
    $receipt['items'] = $stmtItems->fetchAll();
    $receipt['restaurante'] = $rest;
    $receipt['has_receipt'] = true;

    // Calcular desglose de IGV (18%)
    $total = floatval($receipt['monto_total']);
    $subtotal = round($total / 1.18, 2);
    $igv = round($total - $subtotal, 2);
    $receipt['desglose'] = [
        'subtotal' => number_format($subtotal, 2),
        'igv' => number_format($igv, 2),
        'total' => number_format($total, 2)
    ];

    jsonResponse([
        'success' => true,
        'receipt' => $receipt
    ]);
}

/**
 * Emitir venta y comprobante electrónico en PostgreSQL
 */
function handleCreateReceipt($db) {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $orderId = intval($input['id_pedido'] ?? 0);
    $metodoPago = $input['metodo_pago'] ?? 'tarjeta_caja';
    $tipoComprobante = $input['tipo_comprobante'] ?? 'boleta';

    if (!$orderId) {
        jsonResponse(['success' => false, 'message' => 'ID de pedido requerido'], 400);
    }

    // Validar enums de PostgreSQL
    $validPagos = ['aplicacion', 'efectivo_caja', 'tarjeta_caja'];
    if (!in_array($metodoPago, $validPagos)) $metodoPago = 'tarjeta_caja';

    $validComprobantes = ['boleta', 'factura'];
    if (!in_array($tipoComprobante, $validComprobantes)) $tipoComprobante = 'boleta';

    // Obtener total del pedido
    $stmtTotal = $db->prepare("
        SELECT COALESCE(SUM(cantidad * precio_unitario), 0.00) AS total
        FROM detalle_pedidos
        WHERE id_pedido = :id
    ");
    $stmtTotal->execute(['id' => $orderId]);
    $total = floatval($stmtTotal->fetchColumn() ?: 0.00);

    $db->beginTransaction();
    try {
        // 1. Insertar o actualizar venta
        $stmtVenta = $db->prepare("
            INSERT INTO ventas (id_pedido, metodo_pago, monto_total, estado_pago)
            VALUES (:pid, :metodo, :monto, 'exitoso')
            ON CONFLICT (id_pedido) DO UPDATE SET
                metodo_pago = EXCLUDED.metodo_pago,
                monto_total = EXCLUDED.monto_total,
                estado_pago = 'exitoso',
                fecha_pago = CURRENT_TIMESTAMP
            RETURNING id_venta
        ");
        $stmtVenta->execute([
            'pid' => $orderId,
            'metodo' => $metodoPago,
            'monto' => $total
        ]);
        $idVenta = $stmtVenta->fetchColumn();

        // 2. Generar correlativo de comprobante
        $serie = ($tipoComprobante === 'factura') ? 'F001' : 'B001';
        $stmtMaxNum = $db->query("SELECT COALESCE(MAX(id_comprobante), 1000) + 1 FROM comprobantes");
        $nextNum = str_pad(strval($stmtMaxNum->fetchColumn()), 8, '0', STR_PAD_LEFT);
        $numComprobante = "{$serie}-{$nextNum}";

        // 3. Insertar comprobante
        $stmtComp = $db->prepare("
            INSERT INTO comprobantes (id_venta, tipo_comprobante, numero_comprobante)
            VALUES (:vid, :tipo, :num)
            ON CONFLICT (id_venta) DO UPDATE SET
                tipo_comprobante = EXCLUDED.tipo_comprobante,
                numero_comprobante = EXCLUDED.numero_comprobante,
                fecha_emision = CURRENT_TIMESTAMP
            RETURNING id_comprobante, numero_comprobante
        ");
        $stmtComp->execute([
            'vid' => $idVenta,
            'tipo' => $tipoComprobante,
            'num' => $numComprobante
        ]);
        $comp = $stmtComp->fetch();

        $db->commit();

        jsonResponse([
            'success' => true,
            'message' => 'Comprobante emitido con éxito en PostgreSQL',
            'id_venta' => $idVenta,
            'id_comprobante' => $comp['id_comprobante'],
            'numero_comprobante' => $comp['numero_comprobante'],
            'monto_total' => $total
        ], 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonResponse(['success' => false, 'message' => 'Error al emitir comprobante: ' . $e->getMessage()], 500);
    }
}
