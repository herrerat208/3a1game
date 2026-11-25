<?php
// 3A1 — Logros. POST {partida_id, codigo} desbloquea (idempotente).
// GET ?partida_id= lista los de una partida; ?todos=1 cuenta por código.
require 'cors.php';
require 'conexion.php';

$CODIGOS = ['primer_partido', 'primer_campeon', 'siete_cero', 'campeon_debil',
  'campeon_almanaque', 'goleada', 'valla_grupo', 'revancha_ok',
  'campeon_premier', 'campeon_liga30', 'clasico_ganado',
  'asistencia', 'hat_trick', 'diez_goles', 'campeon_invicto', 'veterano',
  'cinco_goles_un_jugador', 'cinco_asistencias', 'torneo_perfecto',
  'valla_total', 'clasico_doble'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $datos = json_decode(file_get_contents('php://input'), true);
    $partidaId = (int)($datos['partida_id'] ?? 0);
    $codigo = trim($datos['codigo'] ?? '');
    if ($partidaId <= 0 || !in_array($codigo, $CODIGOS, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Logro inválido']);
        exit;
    }
    $stmt = $pdo->prepare(
        "INSERT IGNORE INTO logros (partida_id, codigo) VALUES (:partida, :codigo)"
    );
    $stmt->execute(['partida' => $partidaId, 'codigo' => $codigo]);
    echo json_encode(['ok' => true, 'nuevo' => (bool)$stmt->rowCount()]);
    exit;
}

$partidaId = filter_input(INPUT_GET, 'partida_id', FILTER_VALIDATE_INT);
if ($partidaId) {
    $stmt = $pdo->prepare("SELECT codigo, fecha FROM logros WHERE partida_id = :p ORDER BY id");
    $stmt->execute(['p' => $partidaId]);
    echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE);
    exit;
}

$filas = $pdo->query(
    "SELECT codigo, COUNT(*) AS veces FROM logros GROUP BY codigo ORDER BY veces DESC"
)->fetchAll();
echo json_encode($filas, JSON_UNESCAPED_UNICODE);
