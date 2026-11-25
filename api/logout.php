<?php
// Cierre de sesión: se invalida en el servidor, no se borra solo una cookie.
require_once 'cors.php';
require_once 'conexion.php';
require_once 'csrf_lib.php';
require_once 'sesion_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') responderError(405, 'Método no permitido');
if (!csrfValido3a1()) responderError(403, 'Token de seguridad inválido. Recargá la página.');

iniciarSesion3a1();
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
