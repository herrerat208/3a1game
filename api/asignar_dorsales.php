<?php
// 3A1 — Asignación atómica de dorsales del XI (y opcional del banco).
// POST JSON: { partida_id, modo: "xi"|"todo" }
// Un único UPDATE por dorsal dentro de una transacción: si un número está
// ocupado o un slot no existe, no se aplica nada. Antes el frontend hacía un
// POST por jugador y un fallo a mitad de camino dejaba el XI sin dorsales.
require 'cors.php';
require 'conexion.php';

$datos = json_decode(file_get_contents('php://input'), true);
if (!$pdo->query("SHOW COLUMNS FROM partida_jugadores LIKE 'dorsal'")->fetch()) {
    http_response_code(500);
    echo json_encode(['error' => 'Falta correr db/migracion_dorsal.sql en phpMyAdmin']);
    exit;
}

$partidaId = (int)($datos['partida_id'] ?? 0);
$modo = ($datos['modo'] ?? 'xi') === 'todo' ? 'todo' : 'xi';
if ($partidaId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Falta la partida']);
    exit;
}

$stmt = $pdo->prepare(
    "SELECT id, slot, dorsal FROM partida_jugadores
     WHERE partida_id = :p ORDER BY id"
);
$stmt->execute(['p' => $partidaId]);
$filas = $stmt->fetchAll();
if (!$filas) {
    http_response_code(404);
    echo json_encode(['error' => 'Esa partida no tiene jugadores']);
    exit;
}

function esXI($slot) {
    return strpos((string)$slot, 'SUP') !== 0;
}

// Mantiene los dorsales ya puestos: solo completa los que faltan.
$tomados = [];
foreach ($filas as $f) {
    if ($f['dorsal'] !== null) $tomados[(int)$f['dorsal']] = true;
}
$pendientes = [];
foreach ($filas as $f) {
    if ($modo === 'xi' && !esXI($f['slot'])) continue;
    if ($f['dorsal'] !== null) continue;
    $pendientes[] = $f;
}
if (!$pendientes) {
    echo json_encode(['ok' => true, 'asignados' => 0]);
    exit;
}

$pdo->beginTransaction();
try {
    $n = 1;
    $asignados = 0;
    $upd = $pdo->prepare(
        "UPDATE partida_jugadores SET dorsal = :d WHERE partida_id = :p AND slot = :s AND dorsal IS NULL"
    );
    foreach ($pendientes as $f) {
        while (isset($tomados[$n]) && $n <= 99) $n++;
        if ($n > 99) break;
        $upd->execute(['d' => $n, 'p' => $partidaId, 's' => $f['slot']]);
        if ($upd->rowCount() !== 1) {
            throw new RuntimeException('No se pudo asignar el dorsal de ' . $f['slot']);
        }
        $tomados[$n] = true;
        $asignados++;
    }
    $pdo->commit();
    echo json_encode(['ok' => true, 'asignados' => $asignados]);
} catch (Throwable $e) {
    $pdo->rollBack();
    http_response_code(409);
    echo json_encode(['error' => 'No se pudieron asignar los dorsales: ' . $e->getMessage()]);
}
