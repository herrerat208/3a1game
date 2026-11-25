<?php
// 3A1 — Jugadores de un plantel, con OVR final calculado en SQL.
// GET: ?temporada_id= (requerido) &posicion= (opcional: filtra natural o secundaria)
require 'cors.php';
require 'conexion.php';
require_once 'ovr.php';

$temporadaId = filter_input(INPUT_GET, 'temporada_id', FILTER_VALIDATE_INT);
$posicion = trim($_GET['posicion'] ?? '');

// foto_epoca solo si la base ya tiene la migración (db/migracion_foto_epoca.sql).
$tieneEpoca = (bool)$pdo->query(
    "SHOW COLUMNS FROM temporada_jugadores LIKE 'foto_epoca'"
)->fetch();
$epocaSelect = $tieneEpoca
    ? "tj.foto_epoca, tj.foto_fuente, tj.foto_anio,"
    : "NULL AS foto_epoca, NULL AS foto_fuente, NULL AS foto_anio,";

if (!$temporadaId) {
    http_response_code(400);
    echo json_encode(['error' => 'Falta una temporada válida']);
    exit;
}

$sql = "SELECT tj.id AS temporada_jugador_id,
               j.id AS jugador_id, j.nombre, j.foto_url,
               {$epocaSelect} t.anio_orden,
               tj.posicion_natural, tj.posiciones_secundarias,
               tj.ovr_base, tj.es_mvp, tj.es_estrella, tj.dorsal,
               t.campeon, t.etiqueta, c.nombre AS club,
               " . ovr_final_expr() . " AS ovr_final
        FROM temporada_jugadores tj
        JOIN jugadores j ON j.id = tj.jugador_id
        JOIN temporadas t ON t.id = tj.temporada_id
        JOIN clubes c ON c.id = t.club_id
        WHERE tj.temporada_id = :temporada";

$params = ['temporada' => $temporadaId];

if ($posicion !== '') {
    $sql .= " AND (tj.posicion_natural = :posicion
                    OR FIND_IN_SET(:posicion2, tj.posiciones_secundarias))";
    $params['posicion'] = $posicion;
    $params['posicion2'] = $posicion;
}

$sql .= " ORDER BY ovr_final DESC";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$filas = $stmt->fetchAll();

foreach ($filas as &$f) {
    $f['es_mvp'] = (bool)$f['es_mvp'];
    $f['es_estrella'] = (bool)$f['es_estrella'];
    $f['campeon'] = (bool)$f['campeon'];
    $f['ovr_final'] = (int)$f['ovr_final'];
}
unset($f);

echo json_encode($filas, JSON_UNESCAPED_UNICODE);
