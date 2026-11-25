<?php
// Sesión del servidor: la identidad NO viaja en el JSON del navegador.
require_once __DIR__ . '/config.php';

if (!function_exists('iniciarSesion3a1')) {
    function iniciarSesion3a1() {
        if (session_status() === PHP_SESSION_ACTIVE) return;
        $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => $https,
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
        session_name('3a1_sesion');
        session_start();
    }
}

if (!function_exists('usuarioDeSesion')) {
    function usuarioDeSesion(PDO $pdo) {
        iniciarSesion3a1();
        $id = (int)($_SESSION['usuario_id'] ?? 0);
        if (!$id) return null;
        $stmt = $pdo->prepare('SELECT id, alias, rol FROM usuarios WHERE id = ?');
        $stmt->execute([$id]);
        $u = $stmt->fetch();
        return $u ?: null;
    }
}

if (!function_exists('responderError')) {
    function responderError($codigo, $mensaje) {
        http_response_code($codigo);
        echo json_encode(['error' => $mensaje], JSON_UNESCAPED_UNICODE);
        exit;
    }
}
