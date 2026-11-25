<?php
// 3A1 — único archivo con credenciales. No importar desde src/ de Vue.
// Local: XAMPP (root sin clave). Hosting: crear api/config.php con los datos
// del panel (ver api/config.example.php); este archivo lo respeta.
$host = 'localhost';
$db   = '3a1';
$user = 'root';
$pass = '';
$config = __DIR__ . '/config.php';
if (is_file($config)) require $config;

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$db;charset=utf8mb4",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'No se pudo conectar a la base de datos']);
    exit;
}
