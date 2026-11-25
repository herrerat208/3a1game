<?php
// Alta de cuenta. El rol SIEMPRE es jugador: el admin se asigna por script
// en el servidor (scripts/crear_usuario.php), nunca desde este formulario.
require_once 'cors.php';
require_once 'conexion.php';
require_once 'csrf_lib.php';
require_once 'sesion_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') responderError(405, 'Método no permitido');
if (!csrfValido3a1()) responderError(403, 'Token de seguridad inválido. Recargá la página.');

$datos = json_decode(file_get_contents('php://input'), true);
$alias = trim((string)($datos['alias'] ?? ''));
$clave = (string)($datos['password'] ?? '');

if (!preg_match('/^[\p{L}\p{N}_ -]{3,40}$/u', $alias)) {
    responderError(400, 'El alias debe tener entre 3 y 40 letras, números, guiones o espacios');
}
if (strlen($clave) < 8 || strlen($clave) > 200) {
    responderError(400, 'La contraseña debe tener al menos 8 caracteres');
}

$stmt = $pdo->prepare('SELECT id FROM usuarios WHERE alias = ?');
$stmt->execute([$alias]);
if ($stmt->fetch()) responderError(409, 'Ese alias ya está en uso');

$hash = password_hash($clave, PASSWORD_DEFAULT);
if ($hash === false) responderError(500, 'No se pudo crear la cuenta');

$stmt = $pdo->prepare("INSERT INTO usuarios (alias, password_hash, rol) VALUES (?, ?, 'jugador')");
$stmt->execute([$alias, $hash]);
$id = (int)$pdo->lastInsertId();

iniciarSesion3a1();
session_regenerate_id(true);
$_SESSION['usuario_id'] = $id;

http_response_code(201);
echo json_encode([
    'id' => $id,
    'alias' => $alias,
    'rol' => 'jugador',
    'csrfToken' => csrfToken3a1()
], JSON_UNESCAPED_UNICODE);
