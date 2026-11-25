<?php
// Puntaje canónico de 3A1: reutiliza la precedencia del ranking histórico.
// 7A0 > valla de campeón > campeón > partidos > goles a favor.
function puntosDePartida3a1(PDO $pdo, $partidaId) {
    $pid = (int)$partidaId;
    if ($pid <= 0) return 0;

    // FormatOS nuevos (copa / ligas): gana el torneo finalizado.
    $tieneTorneos = (bool)$pdo->query("SHOW TABLES LIKE 'torneos'")->fetch();
    $tieneCal = (bool)$pdo->query("SHOW TABLES LIKE 'calendario'")->fetch();
    if ($tieneTorneos && $tieneCal) {
        $tieneCampeon = (bool)$pdo->query("SHOW COLUMNS FROM torneos LIKE 'campeon'")->fetch();
        $campeonExpr = $tieneCampeon
            ? 'COALESCE(tor.campeon, 0)'
            : '0';
        $stmt = $pdo->prepare(
            "SELECT COUNT(cal.id) AS jugados,
                    COALESCE(SUM(CASE WHEN cal.local_id = te.id THEN cal.gf ELSE cal.gc END), 0) AS gf,
                    COALESCE(SUM(CASE WHEN cal.local_id = te.id THEN cal.gc ELSE cal.gf END), 0) AS gc,
                    {$campeonExpr} AS campeon
             FROM torneos tor
             JOIN torneo_equipos te ON te.torneo_id = tor.id AND te.es_usuario = 1
             LEFT JOIN calendario cal ON cal.torneo_id = tor.id AND cal.jugado
               AND (cal.local_id = te.id OR cal.visita_id = te.id)
             WHERE tor.partida_id = ? AND tor.estado = 'finalizado'
             GROUP BY tor.id
             LIMIT 1"
        );
        $stmt->execute([$pid]);
        $t = $stmt->fetch();
        if ($t) {
            $jugados = (int)$t['jugados'];
            $gf = (int)$t['gf'];
            $gc = (int)$t['gc'];
            $campeon = (bool)$t['campeon'];
            $valla = $campeon && $gc === 0;
            // Los formatos nuevos no tienen "7A0": su mérito es campeón + valla.
            return max(0, min(2000, 500 * (int)$valla + 250 * (int)$campeon + 10 * $jugados + $gf));
        }
    }

    // Torneo legacy de 7 partidos (tabla resultados).
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) AS jugados,
                COALESCE(SUM(goles_favor), 0) AS gf,
                COALESCE(SUM(goles_contra), 0) AS gc,
                MAX(CASE WHEN ronda = 'Final' AND avanzo THEN 1 ELSE 0 END) AS campeon,
                SUM(CASE WHEN avanzo THEN 0 ELSE 1 END) AS derrotas
         FROM resultados WHERE partida_id = ? AND amistoso = 0"
    );
    $stmt->execute([$pid]);
    $r = $stmt->fetch();
    if (!$r || (int)$r['jugados'] === 0) return 0;

    $jugados = (int)$r['jugados'];
    $gf = (int)$r['gf'];
    $gc = (int)$r['gc'];
    $campeon = (bool)$r['campeon'];
    $sieteCero = $jugados === 7 && (int)$r['derrotas'] === 0 && $campeon && $gc === 0;
    $valla = $campeon && $gc === 0;

    return max(0, min(2000,
        1000 * (int)$sieteCero + 500 * (int)$valla + 250 * (int)$campeon + 10 * $jugados + $gf
    ));
}
