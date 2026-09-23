<?php
/**
 * api/staff.php - Gestión de Personal en PostgreSQL
 * Restaurante Melidan / Melisa
 */

require_once __DIR__ . '/config.php';
setupApiHeaders();

$db = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        handleGetStaff($db);
        break;
    case 'POST':
        handleCreateStaff($db);
        break;
    case 'PUT':
    case 'PATCH':
        handleUpdateStaff($db);
        break;
    case 'DELETE':
        handleDeleteStaff($db);
        break;
    default:
        jsonResponse(['success' => false, 'message' => 'Método HTTP no soportado'], 405);
}

/**
 * Listar plantilla de personal desde PostgreSQL
 */
function handleGetStaff($db) {
    $stmt = $db->query("
        SELECT 
            id_usuario AS id,
            nombre AS name,
            email,
            rol,
            CASE 
                WHEN rol = 'mozo' THEN 'Mozo / Salón'
                WHEN rol = 'cocina' THEN 'Cocinero / Chef'
                WHEN rol = 'cajero' THEN 'Cajero'
                WHEN rol = 'administrador' THEN 'Administrador'
                ELSE INITCAP(rol::text)
            END AS role,
            turno AS shift,
            estado AS status,
            avatar,
            fecha_creacion
        FROM usuarios 
        ORDER BY id_usuario ASC
    ");
    $staff = $stmt->fetchAll();

    jsonResponse([
        'success' => true,
        'count' => count($staff),
        'staff' => $staff
    ]);
}

/**
 * Registrar un nuevo empleado en PostgreSQL (Formulario Gestión de Personal)
 */
function handleCreateStaff($db) {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

    $name = trim($input['name'] ?? '');
    $email = trim($input['email'] ?? '');
    $roleInput = trim($input['role'] ?? 'mozo');
    $shift = trim($input['shift'] ?? 'Turno Mañana (8:00 AM - 4:00 PM)');
    $status = trim($input['status'] ?? 'Activo');
    $password = !empty($input['password']) ? $input['password'] : 'password123';

    if (empty($name)) {
        jsonResponse(['success' => false, 'message' => 'El nombre completo es requerido'], 400);
    }

    // Si no se provee correo, generar uno automáticamente basado en el nombre
    if (empty($email)) {
        $cleanName = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', explode(' ', $name)[0]));
        $lastName = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', explode(' ', $name)[1] ?? 'personal'));
        $email = $cleanName . '.' . substr($lastName, 0, 1) . mt_rand(10, 99) . '@melidan.com';
    }

    // Normalizar rol para PostgreSQL ENUM ('administrador', 'mozo', 'cajero', 'cocina')
    $normalizedRole = 'mozo';
    $lower = strtolower($roleInput);
    if (strpos($lower, 'admin') !== false) {
        $normalizedRole = 'administrador';
    } elseif (strpos($lower, 'coci') !== false || strpos($lower, 'chef') !== false) {
        $normalizedRole = 'cocina';
    } elseif (strpos($lower, 'caj') !== false) {
        $normalizedRole = 'cajero';
    } else {
        $normalizedRole = 'mozo';
    }

    // Generar avatar si no existe
    $avatar = $input['avatar'] ?? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
    $hash = password_hash($password, PASSWORD_BCRYPT);

    try {
        $stmt = $db->prepare("
            INSERT INTO usuarios (nombre, email, password_hash, rol, turno, estado, avatar) 
            VALUES (:nombre, :email, :password_hash, :rol, :turno, :estado, :avatar)
            RETURNING id_usuario, nombre, email, rol, turno, estado, avatar
        ");
        $stmt->execute([
            'nombre' => $name,
            'email' => $email,
            'password_hash' => $hash,
            'rol' => $normalizedRole,
            'turno' => $shift,
            'estado' => $status,
            'avatar' => $avatar
        ]);
        $newMember = $stmt->fetch();

        // Formatear respuesta
        $newMember['id'] = $newMember['id_usuario'];
        $newMember['role'] = ($normalizedRole === 'mozo') ? 'Mozo / Salón' : (($normalizedRole === 'cocina') ? 'Cocinero / Chef' : ucfirst($normalizedRole));
        $newMember['status'] = $newMember['estado'];
        $newMember['shift'] = $newMember['turno'];

        jsonResponse([
            'success' => true,
            'message' => 'Empleado registrado con éxito en PostgreSQL',
            'member' => $newMember
        ], 201);
    } catch (PDOException $e) {
        if ($e->getCode() == 23505) { // Unique violation
            jsonResponse(['success' => false, 'message' => 'Ya existe un usuario registrado con este correo'], 409);
        }
        jsonResponse(['success' => false, 'message' => 'Error al guardar en base de datos: ' . $e->getMessage()], 500);
    }
}

/**
 * Actualizar empleado (estado, turno, etc.)
 */
function handleUpdateStaff($db) {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $id = intval($_GET['id'] ?? ($input['id'] ?? 0));

    if (!$id) {
        jsonResponse(['success' => false, 'message' => 'ID de empleado no especificado'], 400);
    }

    $updates = [];
    $params = ['id' => $id];

    if (isset($input['status'])) {
        $updates[] = "estado = :status";
        $params['status'] = $input['status'];
    }
    if (isset($input['shift'])) {
        $updates[] = "turno = :shift";
        $params['shift'] = $input['shift'];
    }
    if (isset($input['name'])) {
        $updates[] = "nombre = :name";
        $params['name'] = $input['name'];
    }
    if (isset($input['role'])) {
        $roleMap = ['administrador' => 'administrador', 'cocina' => 'cocina', 'cajero' => 'cajero', 'mozo' => 'mozo'];
        $cleanRole = strtolower($input['role']);
        if (isset($roleMap[$cleanRole])) {
            $updates[] = "rol = :role";
            $params['role'] = $roleMap[$cleanRole];
        }
    }

    if (empty($updates)) {
        jsonResponse(['success' => false, 'message' => 'No se enviaron campos para actualizar'], 400);
    }

    $sql = "UPDATE usuarios SET " . implode(', ', $updates) . " WHERE id_usuario = :id RETURNING id_usuario, nombre, email, rol, turno, estado, avatar";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $updated = $stmt->fetch();

    if (!$updated) {
        jsonResponse(['success' => false, 'message' => 'Empleado no encontrado'], 404);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Empleado actualizado exitosamente',
        'member' => $updated
    ]);
}

/**
 * Eliminar o desactivar empleado
 */
function handleDeleteStaff($db) {
    $id = intval($_GET['id'] ?? 0);
    if (!$id) {
        jsonResponse(['success' => false, 'message' => 'ID de empleado requerido'], 400);
    }

    $stmt = $db->prepare("DELETE FROM usuarios WHERE id_usuario = :id RETURNING id_usuario, nombre");
    $stmt->execute(['id' => $id]);
    $deleted = $stmt->fetch();

    if (!$deleted) {
        jsonResponse(['success' => false, 'message' => 'Empleado no encontrado'], 404);
    }

    jsonResponse([
        'success' => true,
        'message' => 'Empleado eliminado correctamente de PostgreSQL'
    ]);
}
