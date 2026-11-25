<?php
// 3A1 — Ranking: mejor torneo por partida (solo oficiales, no amistosos).
// Orden: 7A0 > valla > campeón > partidos jugados > goles a favor.
// Incluye los torneos legacy (tabla resultados) y los formatos nuevos
// (copa 32 / premier / liga 30) que guardan sus partidos en calendario.
require_once 'cors.php';
require_once 'conexion.php';

$LIMITE = 20;

// ---- Contrato del sistema conectado ----
// GET /ranking.php?juegoId=3 -> [{usuarioId, alias, puntos}]
// Es la única regla de orden para todas las pantallas: mejor puntaje por
// usuario (mayor a menor) y, si empatan, quien lo alcanzó antes.
if (isset($_GET['juegoId']) || isset($_GET['juego_id'])) {
    $juegoId = (int)($_GET['juegoId'] ?? $_GET['juego_id'] ?? 0);
    if ($juegoId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'juegoId inválido'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $tieneJuegos = (bool)$pdo->query("SHOW TABLES LIKE 'juegos'")->fetch();
    $existeJuego = false;
    if ($tieneJuegos) {
        $st = $pdo->prepare('SELECT 1 FROM juegos WHERE id = ? AND activo = 1');
        $st->execute([$juegoId]);
        $existeJuego = (bool)$st->fetch();
    } else {
        // Base anterior a la migración: los juegos conocidos siguen respondiendo.
        $existeJuego = in_array($juegoId, [3, 4], true);
    }
    if (!$existeJuego) {
        http_response_code(404);
        echo json_encode(['error' => 'No existe ese juego'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $listo = true;
    foreach (['juego_id', 'usuario_id', 'puntos', 'activo', 'fecha_registro'] as $col) {
        if (!(bool)$pdo->query("SHOW COLUMNS FROM partidas LIKE '$col'")->fetch()) $listo = false;
    }
    if (!$listo || !(bool)$pdo->query("SHOW TABLES LIKE 'usuarios'")->fetch()) {
        echo '[]';
        exit;
    }

    // El visor recibe siempre solo {usuarioId, alias, puntos}. El panel de
    // administración puede pedir el id de la partida con &admin=1.
    $conDetalle = false;
    if (!empty($_GET['admin'])) {
        require_once 'sesion_lib.php';
        $uAdmin = usuarioDeSesion($pdo);
        $conDetalle = $uAdmin && $uAdmin['rol'] === 'admin';
    }

    $st = $pdo->prepare(
        "SELECT p.usuario_id AS usuarioId, u.alias, p.puntos,
                MIN(p.fecha_registro) AS alcanzado,
                MIN(p.id) AS partidaId
         FROM partidas p
         JOIN usuarios u ON u.id = p.usuario_id
         WHERE p.juego_id = ? AND p.activo = 1 AND p.puntos > 0
           AND p.puntos = (
               SELECT MAX(p2.puntos) FROM partidas p2
               WHERE p2.juego_id = p.juego_id AND p2.activo = 1
                 AND p2.usuario_id = p.usuario_id
           )
         GROUP BY p.usuario_id, u.alias, p.puntos
         ORDER BY p.puntos DESC, alcanzado ASC, p.usuario_id ASC
         LIMIT ?"
    );
    $st->bindValue(1, $juegoId, PDO::PARAM_INT);
    $st->bindValue(2, $LIMITE, PDO::PARAM_INT);
    $st->execute();
    $salida = [];
    foreach ($st->fetchAll() as $f) {
        $fila = [
            'usuarioId' => (int)$f['usuarioId'],
            'alias' => $f['alias'],
            'puntos' => (int)$f['puntos']
        ];
        if ($conDetalle) $fila['partidaId'] = (int)$f['partidaId'];
        $salida[] = $fila;
    }
    echo json_encode($salida, JSON_UNESCAPED_UNICODE);
    exit;
}

// ---- Legacy: torneo de 7 partidos (resultados) ----
$legacy = $pdo->query(
    "SELECT p.id, p.nombre_equipo, p.formacion, p.estilo,
            COUNT(r.id) AS jugados,
            SUM(r.goles_favor) AS gf,
            SUM(r.goles_contra) AS gc,
            MAX(CASE WHEN r.ronda = 'Final' AND r.avanzo THEN 1 ELSE 0 END) AS campeon,
            CASE WHEN COUNT(r.id) = 7
                      AND SUM(!r.avanzo) = 0
                      AND MAX(CASE WHEN r.ronda = 'Final' THEN 1 ELSE 0 END) = 1
                      AND SUM(r.goles_contra) = 0
                 THEN 1 ELSE 0 END AS siete_cero
     FROM partidas p
     JOIN resultados r ON r.partida_id = p.id AND !r.amistoso
     GROUP BY p.id, p.nombre_equipo, p.formacion, p.estilo
     HAVING COUNT(r.id) > 0"
)->fetchAll();

// ---- Formatos nuevos: torneo finalizado, partidos en calendario ----
$nuevos = [];
$tieneTorneos = (bool)$pdo->query("SHOW TABLES LIKE 'torneos'")->fetch();
if ($tieneTorneos) {
    $tieneCampeon = (bool)$pdo->query("SHOW COLUMNS FROM torneos LIKE 'campeon'")->fetch();
    $tieneValla = (bool)$pdo->query("SHOW COLUMNS FROM torneos LIKE 'valla'")->fetch();
    // Fallback para bases sin la migración (o torneos viejos con campeon NULL):
    // en copa/liga30 el campeón es el que ganó la final. Premier queda NULL
    // hasta aplicar la migración / cerrar el torneo.
    $campeonFinal = "CASE WHEN tor.formato IN ('copa', 'liga30') THEN (
               SELECT MAX(CASE WHEN cal2.fase = 'final' AND cal2.jugado
                                 AND ((cal2.local_id = te.id AND cal2.gf > cal2.gc)
                                   OR (cal2.visita_id = te.id AND cal2.gc > cal2.gf))
                                THEN 1 ELSE 0 END)
               FROM calendario cal2
               WHERE cal2.torneo_id = tor.id
           ) ELSE NULL END";
    $campeonExpr = $tieneCampeon
        ? "COALESCE(tor.campeon, {$campeonFinal})"
        : $campeonFinal;
    $vallaExpr = $tieneValla ? 'tor.valla' : 'NULL';

    // Fecha del campeonato: fecha de cierre del torneo si la columna existe;
    // si no, la última fecha guardada en calendario. Sin columnas de fecha,
    // queda NULL y la API devuelve el campo vacío (nunca inventa una fecha).
    $tieneFechaFin = (bool)$pdo->query("SHOW COLUMNS FROM torneos LIKE 'fechafin'")->fetch();
    $tieneCalendario = (bool)$pdo->query("SHOW TABLES LIKE 'calendario'")->fetch();
    $tieneFechaCal = $tieneCalendario
        && (bool)$pdo->query("SHOW COLUMNS FROM calendario LIKE 'fecha'")->fetch();
    $partesFecha = [];
    if ($tieneFechaFin) $partesFecha[] = 'tor.fechafin';
    if ($tieneFechaCal) {
        $partesFecha[] = "(SELECT MAX(cal3.fecha) FROM calendario cal3 WHERE cal3.torneo_id = tor.id)";
    }
    $fechaExpr = $partesFecha ? 'COALESCE(' . implode(', ', $partesFecha) . ')' : 'NULL';

    $nuevos = $pdo->query(
        "SELECT p.id, p.nombre_equipo, p.formacion, p.estilo, tor.formato,
                x.jugados, x.gf, x.gc,
                {$campeonExpr} AS campeon,
                {$vallaExpr} AS valla,
                {$fechaExpr} AS fecha
         FROM torneos tor
         JOIN partidas p ON p.id = tor.partida_id
         JOIN torneo_equipos te ON te.torneo_id = tor.id AND te.es_usuario = 1
         JOIN (
             SELECT cal2.torneo_id,
                    COUNT(*) AS jugados,
                    COALESCE(SUM(CASE WHEN cal2.local_id = te2.id THEN cal2.gf ELSE cal2.gc END), 0) AS gf,
                    COALESCE(SUM(CASE WHEN cal2.local_id = te2.id THEN cal2.gc ELSE cal2.gf END), 0) AS gc
             FROM calendario cal2
             JOIN torneo_equipos te2
               ON te2.torneo_id = cal2.torneo_id AND te2.es_usuario = 1
             WHERE cal2.jugado
               AND (cal2.local_id = te2.id OR cal2.visita_id = te2.id)
             GROUP BY cal2.torneo_id
         ) x ON x.torneo_id = tor.id
         WHERE tor.estado = 'finalizado'"
    )->fetchAll();
}

// Una partida puede tener resultados legacy y torneo nuevo: gana el torneo.
$porPartida = [];
foreach ($legacy as $f) {
    $porPartida[(int)$f['id']] = [
        'id' => (int)$f['id'],
        'nombre_equipo' => $f['nombre_equipo'],
        'formacion' => $f['formacion'],
        'estilo' => $f['estilo'],
        'formato' => 'siete',
        'jugados' => (int)$f['jugados'],
        'gf' => (int)$f['gf'],
        'gc' => (int)$f['gc'],
        'campeon' => (bool)$f['campeon'],
        'siete_cero' => (bool)$f['siete_cero'],
        'valla' => false,
        'fecha' => '' // el ranking legacy no guarda fecha de cierre
    ];
}
foreach ($nuevos as $f) {
    $campeon = $f['campeon'] === null ? false : (bool)$f['campeon'];
    $valla = $f['valla'] === null ? ($campeon && (int)$f['gc'] === 0) : (bool)$f['valla'];
    $porPartida[(int)$f['id']] = [
        'id' => (int)$f['id'],
        'nombre_equipo' => $f['nombre_equipo'],
        'formacion' => $f['formacion'],
        'estilo' => $f['estilo'],
        'formato' => $f['formato'],
        'jugados' => (int)$f['jugados'],
        'gf' => (int)$f['gf'],
        'gc' => (int)$f['gc'],
        'campeon' => $campeon,
        'siete_cero' => false,
        'valla' => $valla && $campeon,
        'fecha' => $f['fecha'] ?? ''
    ];
}

$filas = array_values($porPartida);
usort($filas, function ($a, $b) {
    return [$b['siete_cero'], $b['valla'], $b['campeon'], $b['jugados'], $b['gf']]
        <=> [$a['siete_cero'], $a['valla'], $a['campeon'], $a['jugados'], $a['gf']];
});
$filas = array_slice($filas, 0, $LIMITE);

echo json_encode($filas, JSON_UNESCAPED_UNICODE);
