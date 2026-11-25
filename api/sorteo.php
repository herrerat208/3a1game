<?php
// 3A1 — Sortea un plantel de RIVER al azar para el draft, estilo 7a0.
// Los rivales NO se draftean (regla 3A1): el filtro es River por defecto y
// solo se desactiva con ?solo_river=0 explícito (admin/tests).
// GET: ?partida_id= (opcional, excluye temporadas ya usadas)
require 'cors.php';
require 'conexion.php';

$partidaId = filter_input(INPUT_GET, 'partida_id', FILTER_VALIDATE_INT);
$soloRiverParam = filter_input(INPUT_GET, 'solo_river', FILTER_VALIDATE_INT);
// Fail-safe: ausente o inválido => solo River. Solo 0 explícito abre rivales.
$soloRiver = !($soloRiverParam === 0);
// Desafío diario: mismo mazo para todos. ?semilla=YYYY-MM-DD&paso=N devuelve
// el N-ésimo plantel de un orden determinista (MD5). No usa RAND().
$semilla = trim($_GET['semilla'] ?? '');
$paso = filter_input(INPUT_GET, 'paso', FILTER_VALIDATE_INT);
$esDiario = ($semilla !== '' && $paso !== null && $paso >= 0);

$sql = "SELECT t.id AS temporada_id, t.etiqueta, t.anio_orden, t.formacion,
               t.campeon, t.ovr_equipo, c.nombre AS club, c.es_river,
               tec.nombre AS tecnico
        FROM temporadas t
        JOIN clubes c ON c.id = t.club_id
        LEFT JOIN tecnicos tec ON tec.id = t.tecnico_id
        WHERE 1 = 1";

$params = [];

if ($soloRiver) {
    $sql .= " AND c.es_river = TRUE";
}

if ($partidaId) {
    // no repetir un plantel que ya aportó jugadores en esta partida
    $sql .= " AND t.id NOT IN (
                SELECT tj.temporada_id
                FROM partida_jugadores pj
                JOIN temporada_jugadores tj ON tj.id = pj.temporada_jugador_id
                WHERE pj.partida_id = :partida
              )";
    $params['partida'] = $partidaId;
}

$sql .= $esDiario
    ? " ORDER BY MD5(CONCAT(:semilla, t.id)) LIMIT " . ((int)$paso) . ", 1"
    : " ORDER BY RAND() LIMIT 1";

$stmt = $pdo->prepare($sql);
if ($esDiario) {
    $params['semilla'] = $semilla;
}
$stmt->execute($params);
$sorteo = $stmt->fetch();

if (!$sorteo) {
    http_response_code(404);
    echo json_encode(['error' => 'No quedan temporadas disponibles para sortear']);
    exit;
}

$sorteo['es_river'] = (bool)$sorteo['es_river'];
$sorteo['campeon'] = (bool)$sorteo['campeon'];
echo json_encode($sorteo, JSON_UNESCAPED_UNICODE);
