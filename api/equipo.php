<?php
// 3A1 — Equipo guardado de una partida (JOIN x5 + OVR final).
// GET: ?partida_id=
require 'cors.php';
require 'conexion.php';
require_once 'ovr.php';

$partidaId = filter_input(INPUT_GET, 'partida_id', FILTER_VALIDATE_INT);

if (!$partidaId) {
    http_response_code(400);
    echo json_encode(['error' => 'Falta una partida válida']);
    exit;
}

// dorsal_elegido solo si la base ya tiene la migración (db/migracion_dorsal.sql);
// en bases viejas devuelve NULL y el resto del equipo sigue andando.
$tieneDorsal = (bool)$pdo->query(
    "SHOW COLUMNS FROM partida_jugadores LIKE 'dorsal'"
)->fetch();
$dorsalSelect = $tieneDorsal
    ? "pj.dorsal AS dorsal_elegido,"
    : "NULL AS dorsal_elegido,";

// foto_epoca solo si la base ya tiene la migración (db/migracion_foto_epoca.sql).
$tieneEpoca = (bool)$pdo->query(
    "SHOW COLUMNS FROM temporada_jugadores LIKE 'foto_epoca'"
)->fetch();
$epocaSelect = $tieneEpoca
    ? "tj.foto_epoca, tj.foto_fuente, tj.foto_anio,"
    : "NULL AS foto_epoca, NULL AS foto_fuente, NULL AS foto_anio,";

$sql = "SELECT pj.slot, {$dorsalSelect}
               tj.id AS temporada_jugador_id,
               j.id AS jugador_id, j.nombre, j.foto_url,
               {$epocaSelect}
               tj.posicion_natural, tj.posiciones_secundarias,
               tj.ovr_base, tj.es_mvp, tj.es_estrella,
               c.nombre AS club, t.anio_orden, t.etiqueta, t.escudo_epoca AS escudo_epoca,
               " . ovr_final_expr() . " AS ovr_final
        FROM partida_jugadores pj
        JOIN temporada_jugadores tj ON tj.id = pj.temporada_jugador_id
        JOIN jugadores j ON j.id = tj.jugador_id
        JOIN temporadas t ON t.id = tj.temporada_id
        JOIN clubes c ON c.id = t.club_id
        WHERE pj.partida_id = :partida
        ORDER BY pj.id";

$stmt = $pdo->prepare($sql);
$stmt->execute(['partida' => $partidaId]);
$filas = $stmt->fetchAll();

foreach ($filas as &$f) {
    $f['ovr_final'] = (int)$f['ovr_final'];
    $f['es_mvp'] = (bool)$f['es_mvp'];
    $f['es_estrella'] = (bool)$f['es_estrella'];
    $f['dorsal_elegido'] = $f['dorsal_elegido'] === null ? null : (int)$f['dorsal_elegido'];
}
unset($f);

echo json_encode($filas, JSON_UNESCAPED_UNICODE);
