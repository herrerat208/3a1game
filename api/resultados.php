<?php
// 3A1 — Resultados de una partida, en orden. GET: ?partida_id=
require 'cors.php';
require 'conexion.php';

$partidaId = filter_input(INPUT_GET, 'partida_id', FILTER_VALIDATE_INT);
if (!$partidaId) {
    http_response_code(400);
    echo json_encode(['error' => 'Falta una partida válida']);
    exit;
}

$stmt = $pdo->prepare(
    "SELECT id, ronda, rival, goles_favor, goles_contra, avanzo, detalle, amistoso
     FROM resultados WHERE partida_id = :partida ORDER BY id"
);
$stmt->execute(['partida' => $partidaId]);
$filas = $stmt->fetchAll();
foreach ($filas as &$f) {
    $f['avanzo'] = (bool)$f['avanzo'];
    $f['amistoso'] = (bool)$f['amistoso'];
    $f['detalle'] = $f['detalle'] ? json_decode($f['detalle'], true) : null;
}
unset($f);
echo json_encode($filas, JSON_UNESCAPED_UNICODE);
