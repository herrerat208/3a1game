<?php
// Ingreso: la biblioteca de PHP compara la contraseña con el hash guardado.
require_once 'cors.php';
require_once 'conexion.php';
require_once 'csrf_lib.php';
require_once 'sesion_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') responderError(405, 'Método no permitido');
if (!csrfValido3a1()) responderError(403, 'Token de seguridad inválido. Recargá la página.');

$datos = json_decode(file_get_contents('php://input'), true);
$alias = trim((string)($datos['alias'] ?? ''));
$clave = (string)($datos['password'] ?? '');

$stmt = $pdo->prepare('SELECT id, alias, rol, password_hash FROM usuarios WHERE alias = ?');
$stmt->execute([$alias]);
$usuario = $stmt->fetch();

if (!$usuario || !password_verify($clave, $usuario['password_hash'])) {
    responderError(401, 'Alias o contraseña incorrectos');
}

iniciarSesion3a1();
session_regenerate_id(true);
$_SESSION['usuario_id'] = (int)$usuario['id'];

echo json_encode([
    'id' => (int)$usuario['id'],
    'alias' => $usuario['alias'],
    'rol' => $usuario['rol'],
    'csrfToken' => csrfToken3a1()
], JSON_UNESCAPED_UNICODE);
