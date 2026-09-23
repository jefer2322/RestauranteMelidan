<?php
/**
 * config.php - Configuración de Conexión a Base de Datos PostgreSQL
 * Restaurante Melidan / Melisa
 */

define('DB_HOST', 'localhost');
define('DB_PORT', '5432');
define('DB_NAME', 'melidan_db');
define('DB_USER', 'postgres');
define('DB_PASS', 'root');

// Configuración de cabeceras comunes para API REST
function setupApiHeaders() {
    if (php_sapi_name() !== 'cli') {
        header("Content-Type: application/json; charset=UTF-8");
        header("Access-Control-Allow-Origin: *");
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
            http_response_code(200);
            exit();
        }
    }
}

// Función para obtener conexión PDO singleton
function getDBConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf("pgsql:host=%s;port=%s;dbname=%s", DB_HOST, DB_PORT, DB_NAME);
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al conectar con la base de datos PostgreSQL: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
            exit();
        }
    }
    return $pdo;
}

// Función auxiliar para responder JSON
function jsonResponse($data, $statusCode = 200) {
    if (php_sapi_name() !== 'cli') {
        http_response_code($statusCode);
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit();
}
