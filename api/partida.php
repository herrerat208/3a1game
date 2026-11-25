<?php
// 3A1 — Datos de una partida (para restaurar en F5). GET: ?partida_id=
require 'cors.php';
require 'conexion.php';

$partidaId = filter_input(INPUT_GET, 'partida_id', FILTER_VALIDATE_INT);
if (!$partidaId) {
    http_response_code(400);
    echo json_encode(['error' => 'Falta una partida válida']);
    exit;
}

$tieneModo = (bool)$pdo->query("SHOW COLUMNS FROM partidas LIKE 'modo'")->fetch();
$tieneFormato = (bool)$pdo->query("SHOW COLUMNS FROM partidas LIKE 'formato'")->fetch();
$extra = ($tieneModo ? ", modo" : ", 'copa' AS modo")
    . ($tieneFormato ? ", formato" : ", 'copa' AS formato");
$stmt = $pdo->prepare(
    "SELECT id, nombre_equipo, formacion, estilo, fecha_inicio{$extra}
     FROM partidas WHERE id = :partida"
);
$stmt->execute(['partida' => $partidaId]);
$partida = $stmt->fetch();
if (!$partida) {
    http_response_code(404);
    echo json_encode(['error' => 'La partida no existe']);
    exit;
}

echo json_encode($partida, JSON_UNESCAPED_UNICODE);
