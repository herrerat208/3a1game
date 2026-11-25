<?php
// Recupera al usuario al recargar. Nunca devuelve password_hash.
require_once 'cors.php';
require_once 'conexion.php';
require_once 'csrf_lib.php';
require_once 'sesion_lib.php';

$usuario = usuarioDeSesion($pdo);
if (!$usuario) responderError(401, 'Sin sesión activa');

echo json_encode([
    'id' => (int)$usuario['id'],
    'alias' => $usuario['alias'],
    'rol' => $usuario['rol'],
    'csrfToken' => csrfToken3a1()
], JSON_UNESCAPED_UNICODE);
