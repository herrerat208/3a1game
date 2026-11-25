<?php
// 3A1 — Tarjetas por torneo (amarilla acumulada / roja = afuera el siguiente).
// GET: ?torneo_id=
// POST: {torneo_id, temporada_jugador_id, amarillas?, roja?, suspendido_hasta_fecha?}
// (upsert: suma amarillas, pisa roja/suspensión).
require 'cors.php';
require 'conexion.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $datos = json_decode(file_get_contents('php://input'), true);
    $torneoId = (int)($datos['torneo_id'] ?? 0);
    $tjId = (int)($datos['temporada_jugador_id'] ?? 0);
    if ($torneoId <= 0 || $tjId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Faltan datos de la sanción']);
        exit;
    }
    $amarillas = max(0, (int)($datos['amarillas'] ?? 0));
    $roja = !empty($datos['roja']) ? 1 : 0;
    $hasta = max(0, (int)($datos['suspendido_hasta_fecha'] ?? 0));
    $stmt = $pdo->prepare(
        "INSERT INTO sanciones (torneo_id, temporada_jugador_id, amarillas, roja, suspendido_hasta_fecha)
         VALUES (:t, :tj, :am, :roja, :hasta)
         ON DUPLICATE KEY UPDATE
           amarillas = amarillas + VALUES(amarillas),
           roja = VALUES(roja),
           suspendido_hasta_fecha = GREATEST(suspendido_hasta_fecha, VALUES(suspendido_hasta_fecha))"
    );
    $stmt->execute(['t' => $torneoId, 'tj' => $tjId, 'am' => $amarillas, 'roja' => $roja, 'hasta' => $hasta]);
    echo json_encode(['ok' => true]);
    exit;
}

$torneoId = filter_input(INPUT_GET, 'torneo_id', FILTER_VALIDATE_INT);
if (!$torneoId) {
    http_response_code(400);
    echo json_encode(['error' => 'Falta el torneo']);
    exit;
}
$stmt = $pdo->prepare(
    "SELECT s.temporada_jugador_id, s.amarillas, s.roja, s.suspendido_hasta_fecha,
            j.nombre
     FROM sanciones s
     JOIN temporada_jugadores tj ON tj.id = s.temporada_jugador_id
     JOIN jugadores j ON j.id = tj.jugador_id
     WHERE s.torneo_id = :t ORDER BY s.amarillas DESC, j.nombre"
);
$stmt->execute(['t' => $torneoId]);
$filas = $stmt->fetchAll();
foreach ($filas as &$f) {
    $f['roja'] = (bool)$f['roja'];
}
unset($f);
echo json_encode($filas, JSON_UNESCAPED_UNICODE);
