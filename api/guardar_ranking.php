<?php
// Guarda el resultado de una partida terminada en el ranking compartido.
// La identidad sale de $_SESSION; los puntos los calcula el servidor desde
// los resultados reales, no desde un número escrito por el navegador.
require_once 'cors.php';
require_once 'conexion.php';
require_once 'csrf_lib.php';
require_once 'sesion_lib.php';
require_once 'puntos_lib.php';
require_once 'ws_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') responderError(405, 'Método no permitido');

$usuario = usuarioDeSesion($pdo);
if (!$usuario) responderError(401, 'Ingresá para guardar tu resultado');
if (!csrfValido3a1()) responderError(403, 'Token de seguridad inválido. Recargá la página.');

$datos = json_decode(file_get_contents('php://input'), true);
$juegoId = (int)($datos['juegoId'] ?? $datos['juego_id'] ?? 0);
$partidaId = (int)($datos['partidaId'] ?? $datos['partida_id'] ?? 0);
$duracion = isset($datos['duracionSegundos']) ? (int)$datos['duracionSegundos'] : null;
if ($duracion !== null && ($duracion < 0 || $duracion > 86400)) $duracion = null;

if ($juegoId <= 0 || $partidaId <= 0) {
    responderError(400, 'Faltan datos del resultado');
}

// El juego debe existir (tabla nueva) o ser uno de los conocidos en una base
// todavía no migrada, para no romper una instalación anterior.
$tieneJuegos = (bool)$pdo->query("SHOW TABLES LIKE 'juegos'")->fetch();
$existeJuego = false;
if ($tieneJuegos) {
    $st = $pdo->prepare('SELECT 1 FROM juegos WHERE id = ? AND activo = 1');
    $st->execute([$juegoId]);
    $existeJuego = (bool)$st->fetch();
} else {
    $existeJuego = in_array($juegoId, [3, 4], true);
}
if (!$existeJuego) responderError(400, 'Ese juego no existe');

$columnas = [];
foreach (['usuario_id', 'juego_id', 'puntos', 'duracion_segundos', 'fecha_registro', 'activo'] as $col) {
    $columnas[$col] = (bool)$pdo->query("SHOW COLUMNS FROM partidas LIKE '$col'")->fetch();
}
if (in_array(false, $columnas, true)) {
    responderError(503, 'La base todavía no tiene la migración del ranking');
}

$st = $pdo->prepare('SELECT id, usuario_id FROM partidas WHERE id = ?');
$st->execute([$partidaId]);
$partida = $st->fetch();
if (!$partida) responderError(400, 'No existe esa partida');
$dueno = (int)($partida['usuario_id'] ?? 0);
if ($dueno && $dueno !== (int)$usuario['id']) {
    responderError(403, 'Esa partida pertenece a otro usuario');
}

// El servidor calcula el puntaje canónico con la misma precedencia del ranking.
$puntos = puntosDePartida3a1($pdo, $partidaId);
if ($puntos <= 0) {
    responderError(400, 'La partida no terminó o no tiene resultados válidos');
}

$st = $pdo->prepare(
    'UPDATE partidas
        SET usuario_id = ?, juego_id = ?, puntos = ?, duracion_segundos = ?,
            fecha_registro = NOW(), activo = 1
      WHERE id = ?'
);
$st->execute([(int)$usuario['id'], $juegoId, $puntos, $duracion, $partidaId]);

// Aviso best-effort: MySQL ya confirmó; si el tubo está caído no se deshace nada.
notificarRanking3a1($juegoId);

http_response_code(201);
echo json_encode([
    'id' => $partidaId,
    'usuarioId' => (int)$usuario['id'],
    'juegoId' => $juegoId,
    'puntos' => $puntos
], JSON_UNESCAPED_UNICODE);
