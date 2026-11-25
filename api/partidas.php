<?php
// 3A1 — Crea una partida (POST JSON: nombre_equipo, formacion, estilo?,
// modo? copa|liga, formato? copa|premier|liga30).
require 'cors.php';
require 'conexion.php';
require '_slots.php';

// DELETE /partidas.php?id=84 — retira un resultado del ranking.
// La interfaz puede ocultar el botón, pero el permiso se revisa acá siempre.
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    require_once 'csrf_lib.php';
    require_once 'sesion_lib.php';
    require_once 'ws_lib.php';

    $usuario = usuarioDeSesion($pdo);
    if (!$usuario) responderError(401, 'Ingresá para realizar esta operación');
    if ($usuario['rol'] !== 'admin') responderError(403, 'Se necesita permiso de administrador');
    if (!csrfValido3a1()) responderError(403, 'Token de seguridad inválido. Recargá la página.');

    $id = (int)($_GET['id'] ?? $_GET['partida_id'] ?? 0);
    if (!$id && !empty($_SERVER['PATH_INFO'])) {
        $partes = array_values(array_filter(explode('/', trim($_SERVER['PATH_INFO'], '/')), 'strlen'));
        $id = (int)end($partes);
    }
    if ($id <= 0) responderError(400, 'Falta el identificador de la partida');

    $st = $pdo->prepare('SELECT juego_id FROM partidas WHERE id = ?');
    $st->execute([$id]);
    $partida = $st->fetch();
    if (!$partida) responderError(404, 'No existe esa partida');

    if (!(bool)$pdo->query("SHOW COLUMNS FROM partidas LIKE 'activo'")->fetch()) {
        responderError(503, 'La base todavía no tiene la migración del ranking');
    }
    $pdo->prepare('UPDATE partidas SET activo = 0 WHERE id = ?')->execute([$id]);
    notificarRanking3a1((int)($partida['juego_id'] ?? 3));

    echo json_encode(['ok' => true, 'id' => $id], JSON_UNESCAPED_UNICODE);
    exit;
}

$datos = json_decode(file_get_contents('php://input'), true);
$nombreEquipo = trim($datos['nombre_equipo'] ?? '');
$formacion = trim($datos['formacion'] ?? '');
$estilo = trim($datos['estilo'] ?? 'equilibrado');
$modo = trim($datos['modo'] ?? 'copa');
$formato = trim($datos['formato'] ?? 'copa');

if ($nombreEquipo === '' || $formacion === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Faltan datos para crear la partida']);
    exit;
}
if (!in_array($formacion, elegibles_3a1(), true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Formación no elegible']);
    exit;
}
if (!in_array($estilo, estilos_3a1(), true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Estilo desconocido']);
    exit;
}
if (!in_array($modo, ['copa', 'liga'], true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Modo desconocido']);
    exit;
}
if (!in_array($formato, ['copa', 'premier', 'liga30'], true)) {
    http_response_code(422);
    echo json_encode(['error' => 'Formato desconocido']);
    exit;
}

// Compatible con bases viejas (sin migración de ligas): solo inserta
// modo/formato si las columnas existen.
$tieneModo = (bool)$pdo->query("SHOW COLUMNS FROM partidas LIKE 'modo'")->fetch();
$tieneFormato = (bool)$pdo->query("SHOW COLUMNS FROM partidas LIKE 'formato'")->fetch();
$cols = ['nombre_equipo', 'formacion', 'estilo'];
$vals = [
    'nombre_equipo' => $nombreEquipo,
    'formacion' => $formacion,
    'estilo' => $estilo
];
if ($tieneModo) {
    $cols[] = 'modo';
    $vals['modo'] = $modo;
}
if ($tieneFormato) {
    $cols[] = 'formato';
    $vals['formato'] = $formato;
}
$ph = implode(', ', array_map(fn($c) => ":$c", $cols));
$stmt = $pdo->prepare("INSERT INTO partidas (" . implode(', ', $cols) . ") VALUES ($ph)");
$stmt->execute($vals);

echo json_encode(['id' => (int)$pdo->lastInsertId()]);
