<?php
// 3A1 — Historial de partidas: equipo, elegidos, último resultado y detalle.
// El último resultado sale de resultados (legacy 7 partidos) o de calendario
// (copa 32 / premier / liga 30), el que sea más reciente.
// `partidos[]` trae cada encuentro con rival, escudo y signo (+1 / 0 / -1)
// desde la perspectiva del usuario, para el historial por equipo de la UI.
require 'cors.php';
require 'conexion.php';

$tieneTorneos = (bool)$pdo->query("SHOW TABLES LIKE 'torneos'")->fetch();

$ultimoCalendario = $tieneTorneos
    ? ", (SELECT CONCAT(COALESCE(tv.etiqueta, 'Rival'), ' ',
                         CASE WHEN cal.local_id = te.id THEN cal.gf ELSE cal.gc END, '-',
                         CASE WHEN cal.local_id = te.id THEN cal.gc ELSE cal.gf END)
          FROM torneos tor
          JOIN torneo_equipos te ON te.torneo_id = tor.id AND te.es_usuario = 1
          JOIN calendario cal ON cal.torneo_id = tor.id AND cal.jugado
               AND (cal.local_id = te.id OR cal.visita_id = te.id)
          JOIN torneo_equipos rival_eq
            ON rival_eq.id = IF(cal.local_id = te.id, cal.visita_id, cal.local_id)
          LEFT JOIN temporadas tv ON tv.id = rival_eq.temporada_id
          WHERE tor.partida_id = p.id
          ORDER BY cal.fecha_n DESC, cal.id DESC
          LIMIT 1) AS ultimo_calendario"
    : '';

$limite = filter_input(INPUT_GET, 'limite', FILTER_VALIDATE_INT);
$limite = ($limite !== null && $limite !== false && $limite > 0) ? min($limite, 200) : 20;

$sql = "SELECT p.id, p.nombre_equipo, p.formacion, p.estilo, p.fecha_inicio,
               p.modo, p.formato,
               COUNT(pj.id) AS elegidos,
               (SELECT CONCAT(r.rival, ' ', r.goles_favor, '-', r.goles_contra)
                FROM resultados r WHERE r.partida_id = p.id
                ORDER BY r.id DESC LIMIT 1) AS ultimo_legacy
               {$ultimoCalendario}
        FROM partidas p
        LEFT JOIN partida_jugadores pj ON pj.partida_id = p.id
        GROUP BY p.id, p.nombre_equipo, p.formacion, p.estilo, p.fecha_inicio, p.modo, p.formato
        ORDER BY p.id DESC
        LIMIT {$limite}";
$filas = $pdo->query($sql)->fetchAll();

// Un sola consulta para todos los partidos de las partidas devueltas.
$detallePorPartida = [];
$ids = array_map('intval', array_column($filas, 'id'));
if ($ids) {
    $place = implode(',', array_fill(0, count($ids), '?'));

    $legacy = "SELECT 'legacy' AS origen, r.partida_id, r.id, r.id AS orden,
                      NULL AS fecha_n, r.ronda AS fase, r.rival, r.detalle,
                      r.goles_favor AS gf, r.goles_contra AS gc, r.amistoso,
                      t.id AS rival_temporada_id, t.etiqueta, t.formacion,
                      t.ovr_equipo, c.nombre AS club, t.escudo_epoca, c.escudo
               FROM resultados r
               LEFT JOIN temporadas t ON t.etiqueta = r.rival
               LEFT JOIN clubes c ON c.id = t.club_id
               WHERE r.partida_id IN ({$place})";

    $partes = [$legacy];
    if ($tieneTorneos) {
        $partes[] = "SELECT 'calendario' AS origen, tor.partida_id, cal.id, cal.id AS orden,
                            cal.fecha_n, cal.fase, cal.detalle,
                            COALESCE(tr.etiqueta, 'Rival') AS rival,
                            CASE WHEN teu.id = cal.local_id THEN cal.gf ELSE cal.gc END AS gf,
                            CASE WHEN teu.id = cal.local_id THEN cal.gc ELSE cal.gf END AS gc,
                            FALSE AS amistoso,
                            tr.id AS rival_temporada_id, tr.etiqueta, tr.formacion,
                            tr.ovr_equipo, cr.nombre AS club, tr.escudo_epoca, cr.escudo
                     FROM calendario cal
                     JOIN torneos tor ON tor.id = cal.torneo_id
                     JOIN torneo_equipos teu ON teu.torneo_id = tor.id AND teu.es_usuario = 1
                     LEFT JOIN torneo_equipos ter
                       ON ter.id = IF(cal.local_id = teu.id, cal.visita_id, cal.local_id)
                     LEFT JOIN temporadas tr ON tr.id = ter.temporada_id
                     LEFT JOIN clubes cr ON cr.id = tr.club_id
                     WHERE cal.jugado
                       AND (cal.local_id = teu.id OR cal.visita_id = teu.id)
                       AND tor.partida_id IN ({$place})";
    }
    $sqlDetalle = implode(' UNION ALL ', $partes) . ' ORDER BY partida_id DESC, orden ASC';
    $stmt = $pdo->prepare($sqlDetalle);
    $stmt->execute($tieneTorneos ? array_merge($ids, $ids) : $ids);
    foreach ($stmt->fetchAll() as $m) {
        $gf = (int)$m['gf'];
        $gc = (int)$m['gc'];
        // Detalle del partido (goleadores, asistencias, penales) para el
        // resumen de "Últimas partidas" sin tener que abrir la partida.
        $detalle = !empty($m['detalle']) ? json_decode($m['detalle'], true) : null;
        // Si el partido se definió por penales, el resultado de los 90'
        // sigue siendo empate pero el signo es victoria/derrota según la tanda.
        $signo = $gf > $gc ? 1 : ($gf < $gc ? -1 : 0);
        if ($signo === 0 && is_array($detalle)) {
            $tanda = is_array($detalle['tanda'] ?? null) ? $detalle['tanda'] : null;
            if (is_array($tanda)) {
                if (array_key_exists('ganador', $tanda) && is_bool($tanda['ganador'])) {
                    $signo = $tanda['ganador'] ? 1 : -1;
                } elseif (isset($tanda['mios'], $tanda['suyos']) && (int)$tanda['mios'] !== (int)$tanda['suyos']) {
                    $signo = (int)$tanda['mios'] > (int)$tanda['suyos'] ? 1 : -1;
                }
            }
        }
        $detallePorPartida[(int)$m['partida_id']][] = [
            'origen' => $m['origen'],
            'id' => (int)$m['id'],
            'fecha_n' => $m['fecha_n'] === null ? null : (int)$m['fecha_n'],
            'fase' => $m['fase'],
            'rival' => $m['rival'],
            'rival_temporada_id' => $m['rival_temporada_id'] === null ? null : (int)$m['rival_temporada_id'],
            'etiqueta' => $m['etiqueta'],
            'club' => $m['club'],
            'formacion' => $m['formacion'],
            'ovr_equipo' => $m['ovr_equipo'] === null ? null : (int)$m['ovr_equipo'],
            'escudo' => $m['escudo'],
            'escudo_epoca' => $m['escudo_epoca'],
            'detalle' => $detalle,
            'gf' => $gf,
            'gc' => $gc,
            'signo' => $signo,
            'amistoso' => (bool)$m['amistoso']
        ];
    }
}

foreach ($filas as &$f) {
    $f['id'] = (int)$f['id'];
    $f['elegidos'] = (int)$f['elegidos'];
    $f['ultimo_resultado'] = ($f['ultimo_calendario'] ?? null) ?: ($f['ultimo_legacy'] ?? null);
    $f['partidos'] = $detallePorPartida[(int)$f['id']] ?? [];
    unset($f['ultimo_legacy'], $f['ultimo_calendario']);
}
unset($f);
echo json_encode($filas, JSON_UNESCAPED_UNICODE);
