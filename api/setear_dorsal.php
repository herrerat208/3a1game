<?php
// 3A1 — Dorsal elegido por el usuario (POST JSON: partida_id, slot, dorsal).
// dorsal 1-99, único por partida; dorsal null/vacío lo libera.
// Requiere db/migracion_dorsal.sql en bases ya creadas.
require 'cors.php';
require 'conexion.php';

$datos = json_decode(file_get_contents('php://input'), true);
if (!$pdo->query("SHOW COLUMNS FROM partida_jugadores LIKE 'dorsal'")->fetch()) {
    http_response_code(500);
    echo json_encode(['error' => 'Falta correr db/migracion_dorsal.sql en phpMyAdmin']);
    exit;
}
$partidaId = (int)($datos['partida_id'] ?? 0);
$slot = trim($datos['slot'] ?? '');
$dorsalRaw = $datos['dorsal'] ?? null;
$dorsal = ($dorsalRaw === null || $dorsalRaw === '') ? null : (int)$dorsalRaw;

if ($partidaId <= 0 || $slot === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Faltan datos del dorsal']);
    exit;
}
if ($dorsal !== null && ($dorsal < 1 || $dorsal > 99)) {
    http_response_code(422);
    echo json_encode(['error' => 'El dorsal debe estar entre 1 y 99']);
    exit;
}

$stmt = $pdo->prepare(
    "SELECT id FROM partida_jugadores WHERE partida_id = :p AND slot = :s"
);
$stmt->execute(['p' => $partidaId, 's' => $slot]);
if (!$stmt->fetch()) {
    http_response_code(404);
    echo json_encode(['error' => 'Ese lugar está vacío en esta partida']);
    exit;
}

if ($dorsal !== null) {
    $stmt = $pdo->prepare(
        "SELECT slot FROM partida_jugadores
         WHERE partida_id = :p AND dorsal = :d AND slot <> :s"
    );
    $stmt->execute(['p' => $partidaId, 'd' => $dorsal, 's' => $slot]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Ese dorsal ya está en uso en tu equipo']);
        exit;
    }
}

$stmt = $pdo->prepare(
    "UPDATE partida_jugadores SET dorsal = :d
     WHERE partida_id = :p AND slot = :s"
);
$stmt->execute(['d' => $dorsal, 'p' => $partidaId, 's' => $slot]);

echo json_encode(['ok' => true]);
