<?php
// 3A1 — Quita el jugador de un slot (POST JSON: partida_id, slot).
require 'cors.php';
require 'conexion.php';

$datos = json_decode(file_get_contents('php://input'), true);
$partidaId = (int)($datos['partida_id'] ?? 0);
$slot = trim($datos['slot'] ?? '');

if ($partidaId <= 0 || $slot === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Faltan datos para quitar el jugador']);
    exit;
}

$stmt = $pdo->prepare(
    "DELETE FROM partida_jugadores
     WHERE partida_id = :partida AND slot = :slot"
);
$stmt->execute([
    'partida' => $partidaId,
    'slot' => $slot
]);

echo json_encode(['ok' => true]);
