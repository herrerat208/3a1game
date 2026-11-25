<?php
// 3A1 — Guarda un resultado simulado.
// POST JSON: partida_id, ronda, rival, goles_favor, goles_contra, avanzo?,
// detalle? (JSON goleadores/tanda), amistoso? (revancha: no suma logros).
require 'cors.php';
require 'conexion.php';

$datos = json_decode(file_get_contents('php://input'), true);
$partidaId = (int)($datos['partida_id'] ?? 0);
$ronda = trim($datos['ronda'] ?? '');
$rival = trim($datos['rival'] ?? '');
$golesFavor = (int)($datos['goles_favor'] ?? 0);
$golesContra = (int)($datos['goles_contra'] ?? 0);
$avanzo = isset($datos['avanzo']) ? (bool)$datos['avanzo'] : true;
$detalle = trim($datos['detalle'] ?? '');
$amistoso = isset($datos['amistoso']) ? (bool)$datos['amistoso'] : false;

if ($partidaId <= 0 || $ronda === '' || $rival === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Faltan datos del resultado']);
    exit;
}

$stmt = $pdo->prepare(
    "INSERT INTO resultados
     (partida_id, ronda, rival, goles_favor, goles_contra, avanzo, detalle, amistoso)
     VALUES (:partida, :ronda, :rival, :favor, :contra, :avanzo, :detalle, :amistoso)"
);
$stmt->execute([
    'partida' => $partidaId,
    'ronda' => $ronda,
    'rival' => $rival,
    'favor' => $golesFavor,
    'contra' => $golesContra,
    'avanzo' => $avanzo ? 1 : 0,
    'detalle' => $detalle !== '' ? $detalle : null,
    'amistoso' => $amistoso ? 1 : 0
]);

echo json_encode(['ok' => true]);
