<?php
// 3A1 — Tabla de posiciones (GROUP BY, pide la consigna).
// GET: ?torneo_id= [&zona=]
// Orden canónico: puntos → diferencia → GF → fair play → (el resto lo
// desempata el sorteo original del fixture).
require 'cors.php';
require 'conexion.php';

$torneoId = filter_input(INPUT_GET, 'torneo_id', FILTER_VALIDATE_INT);
if (!$torneoId) {
    http_response_code(400);
    echo json_encode(['error' => 'Falta el torneo']);
    exit;
}
$zona = trim($_GET['zona'] ?? '');

$sql = "SELECT te.id AS equipo_id, te.temporada_id, te.zona, te.es_usuario,
               t.etiqueta, t.formacion, t.ovr_equipo, t.escudo_epoca, c.nombre AS club, c.escudo,
               COUNT(cal.id) AS pj,
               SUM(CASE WHEN (cal.local_id = te.id AND cal.gf > cal.gc)
                         OR (cal.visita_id = te.id AND cal.gc > cal.gf)
                        THEN 1 ELSE 0 END) AS pg,
               SUM(CASE WHEN cal.gf = cal.gc THEN 1 ELSE 0 END) AS pe,
               SUM(CASE WHEN (cal.local_id = te.id AND cal.gf < cal.gc)
                         OR (cal.visita_id = te.id AND cal.gc < cal.gf)
                        THEN 1 ELSE 0 END) AS pp,
               SUM(CASE WHEN cal.local_id = te.id THEN cal.gf ELSE cal.gc END) AS gf,
               SUM(CASE WHEN cal.local_id = te.id THEN cal.gc ELSE cal.gf END) AS gc,
               SUM(CASE WHEN (cal.local_id = te.id AND cal.gf > cal.gc)
                         OR (cal.visita_id = te.id AND cal.gc > cal.gf) THEN 3
                        WHEN cal.gf = cal.gc THEN 1 ELSE 0 END) AS pts,
               COALESCE((
                   SELECT SUM(s.amarillas + IF(s.roja, 3, 0))
                   FROM sanciones s
                   JOIN temporada_jugadores tj ON tj.id = s.temporada_jugador_id
                   WHERE s.torneo_id = te.torneo_id
                     AND (
                       (te.temporada_id IS NOT NULL AND tj.temporada_id = te.temporada_id)
                       OR (te.es_usuario = 1 AND EXISTS (
                           SELECT 1
                           FROM partida_jugadores pj
                           JOIN torneos tor ON tor.id = te.torneo_id
                           WHERE pj.partida_id = tor.partida_id
                             AND pj.temporada_jugador_id = s.temporada_jugador_id
                       ))
                     )
               ), 0) AS fp
        FROM torneo_equipos te
        LEFT JOIN temporadas t ON t.id = te.temporada_id
        LEFT JOIN clubes c ON c.id = t.club_id
        LEFT JOIN calendario cal
          ON cal.torneo_id = te.torneo_id AND cal.jugado
             AND (cal.local_id = te.id OR cal.visita_id = te.id)
        WHERE te.torneo_id = :t";
$params = ['t' => $torneoId];
if ($zona !== '') {
    $sql .= " AND te.zona = :zona";
    $params['zona'] = $zona;
}
// OVR del equipo para la previa (promedio de sus titulares históricos).
$sql .= " GROUP BY te.id, te.temporada_id, te.zona, te.es_usuario,
                   t.etiqueta, t.formacion, t.ovr_equipo, t.escudo_epoca, c.nombre, c.escudo
          ORDER BY pts DESC, (gf - gc) DESC, gf DESC, fp ASC, equipo_id";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$filas = $stmt->fetchAll();
$pos = 0;
foreach ($filas as &$f) {
    $f['es_usuario'] = (bool)$f['es_usuario'];
    foreach (['pj', 'pg', 'pe', 'pp', 'gf', 'gc', 'pts', 'fp'] as $k) {
        $f[$k] = (int)$f[$k];
    }
    $f['dif'] = $f['gf'] - $f['gc'];
    $f['pos'] = ++$pos;
}
unset($f);
echo json_encode($filas, JSON_UNESCAPED_UNICODE);
