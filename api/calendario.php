<?php
// 3A1 — Fecha del calendario: ver y jugar.
// GET: ?torneo_id= [&fecha_n=] [&fase=]
// POST jugar: {calendario_id, gf, gc, detalle?} → marca jugado.
require 'cors.php';
require 'conexion.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $datos = json_decode(file_get_contents('php://input'), true);
    $id = (int)($datos['calendario_id'] ?? 0);
    $gf = $datos['gf'] ?? null;
    $gc = $datos['gc'] ?? null;
    $detalle = trim($datos['detalle'] ?? '');
    if ($id <= 0 || !is_numeric($gf) || !is_numeric($gc) || $gf < 0 || $gc < 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Faltan los goles del partido']);
        exit;
    }
    $stmt = $pdo->prepare(
        "UPDATE calendario SET gf = :gf, gc = :gc, jugado = TRUE,
          detalle = :detalle WHERE id = :id"
    );
    $stmt->execute([
        'gf' => (int)$gf,
        'gc' => (int)$gc,
        'detalle' => $detalle !== '' ? $detalle : null,
        'id' => $id
    ]);
    if (!$stmt->rowCount()) {
        http_response_code(404);
        echo json_encode(['error' => 'Ese partido no existe']);
        exit;
    }
    echo json_encode(['ok' => true]);
    exit;
}

$torneoId = filter_input(INPUT_GET, 'torneo_id', FILTER_VALIDATE_INT);
if (!$torneoId) {
    http_response_code(400);
    echo json_encode(['error' => 'Falta el torneo']);
    exit;
}
$fechaN = filter_input(INPUT_GET, 'fecha_n', FILTER_VALIDATE_INT);
$fase = trim($_GET['fase'] ?? '');

$sql = "SELECT cal.id, cal.fecha_n, cal.fase, cal.gf, cal.gc, cal.jugado, cal.detalle,
               cal.local_id, cal.visita_id,
               tl.etiqueta AS local_etiqueta, tv.etiqueta AS visita_etiqueta,
               lel.es_usuario AS local_usuario, vel.es_usuario AS visita_usuario
        FROM calendario cal
        JOIN torneo_equipos lel ON lel.id = cal.local_id
        LEFT JOIN temporadas tl ON tl.id = lel.temporada_id
        JOIN torneo_equipos vel ON vel.id = cal.visita_id
        LEFT JOIN temporadas tv ON tv.id = vel.temporada_id
        WHERE cal.torneo_id = :t";
$params = ['t' => $torneoId];
if ($fechaN !== null && $fechaN !== false) {
    $sql .= " AND cal.fecha_n = :fecha";
    $params['fecha'] = $fechaN;
}
if ($fase !== '') {
    $sql .= " AND cal.fase = :fase";
    $params['fase'] = $fase;
}
$sql .= " ORDER BY cal.fecha_n, cal.id";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$filas = $stmt->fetchAll();
foreach ($filas as &$f) {
    $f['jugado'] = (bool)$f['jugado'];
    $f['local_usuario'] = (bool)$f['local_usuario'];
    $f['visita_usuario'] = (bool)$f['visita_usuario'];
    $f['detalle'] = $f['detalle'] ? json_decode($f['detalle'], true) : null;
}
unset($f);
echo json_encode($filas, JSON_UNESCAPED_UNICODE);
