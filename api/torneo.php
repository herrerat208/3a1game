<?php
// 3A1 — Torneos de liga/copa.
// POST crear: {partida_id, formato, participantes: [{temporada_id, zona?, es_usuario}],
//   calendario: [{fecha_n, fase?, local_temp, visita_temp}]}
// POST avanzar: {torneo_id, fecha_actual?, estado?}
// GET: ?partida_id= o ?torneo_id= → torneo + equipos + calendario.
require 'cors.php';
require 'conexion.php';

$FORMATOS = ['copa', 'premier', 'liga30'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $datos = json_decode(file_get_contents('php://input'), true);

    // Agregar fixture a un torneo existente (ej. cuadro tras los grupos).
    // {torneo_id, calendario: [{fecha_n, fase, local_temp|local_eq, visita_temp|visita_eq}]}
    // local_eq/visita_eq = torneo_equipos.id (sirve para el equipo usuario, sin temporada).
    if (!empty($datos['torneo_id']) && isset($datos['calendario'])) {
        $torneoId = (int)$datos['torneo_id'];
        $stmt = $pdo->prepare("SELECT id FROM torneos WHERE id = :t");
        $stmt->execute(['t' => $torneoId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'El torneo no existe']);
            exit;
        }
        $stmt = $pdo->prepare(
            "SELECT id, temporada_id FROM torneo_equipos WHERE torneo_id = :t"
        );
        $stmt->execute(['t' => $torneoId]);
        $mapa = [];
        foreach ($stmt->fetchAll() as $eq) {
            if ($eq['temporada_id'] !== null) $mapa[(int)$eq['temporada_id']] = (int)$eq['id'];
        }
        $idsValidos = [];
        $stmt2 = $pdo->prepare("SELECT id FROM torneo_equipos WHERE torneo_id = :t");
        $stmt2->execute(['t' => $torneoId]);
        foreach ($stmt2->fetchAll() as $eq) {
            $idsValidos[(int)$eq['id']] = true;
        }
        $stmtU = $pdo->prepare(
            "SELECT id FROM torneo_equipos WHERE torneo_id = :t AND es_usuario LIMIT 1"
        );
        $stmtU->execute(['t' => $torneoId]);
        $usuarioId = ($row = $stmtU->fetch()) ? (int)$row['id'] : 0;
        $resId = function ($f, $lado) use ($mapa, $idsValidos, $usuarioId) {
            $porEq = $lado . '_eq';
            $porTemp = $lado . '_temp';
            if (isset($f[$porEq]) && isset($idsValidos[(int)$f[$porEq]])) {
                return (int)$f[$porEq];
            }
            if (($f[$lado] ?? '') === 'usuario' || ($f['usuario'] ?? '') === $lado) {
                return $usuarioId;
            }
            return $mapa[(int)($f[$porTemp] ?? 0)] ?? 0;
        };
        try {
            $pdo->beginTransaction();
            $cal = $pdo->prepare(
                "INSERT INTO calendario (torneo_id, fecha_n, fase, local_id, visita_id)
                 VALUES (:t, :fecha, :fase, :loc, :vis)"
            );
            foreach ($datos['calendario'] as $f) {
                $loc = $resId($f, 'local');
                $vis = $resId($f, 'visita');
                if (!$loc || !$vis) {
                    throw new Exception('Fixture con equipo desconocido');
                }
                $cal->execute([
                    't' => $torneoId,
                    'fecha' => (int)($f['fecha_n'] ?? 0),
                    'fase' => trim($f['fase'] ?? 'liga'),
                    'loc' => $loc,
                    'vis' => $vis
                ]);
            }
            $pdo->commit();
            echo json_encode(['ok' => true]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(422);
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit;
    }

    // Avanzar / finalizar un torneo existente.
    if (!empty($datos['torneo_id'])) {
        $torneoId = (int)$datos['torneo_id'];
        // Bases viejas sin migracion_torneo_cierre.sql: se ignora el cierre
        // explícito y el frontend cae al fallback por calendario.
        $tieneCampeon = (bool)$pdo->query("SHOW COLUMNS FROM torneos LIKE 'campeon'")->fetch();
        $tieneValla = (bool)$pdo->query("SHOW COLUMNS FROM torneos LIKE 'valla'")->fetch();
        $sets = [];
        $params = ['t' => $torneoId];
        if (isset($datos['fecha_actual'])) {
            $sets[] = 'fecha_actual = :fecha';
            $params['fecha'] = (int)$datos['fecha_actual'];
        }
        if (!empty($datos['estado'])) {
            if (!in_array($datos['estado'], ['armado', 'curso', 'finalizado'], true)) {
                http_response_code(422);
                echo json_encode(['error' => 'Estado desconocido']);
                exit;
            }
            $sets[] = 'estado = :estado';
            $params['estado'] = $datos['estado'];
        }
        if ($tieneCampeon && array_key_exists('campeon', $datos)) {
            $sets[] = 'campeon = :campeon';
            $params['campeon'] = $datos['campeon'] === null
                ? null
                : (!empty($datos['campeon']) ? 1 : 0);
        }
        if ($tieneValla && array_key_exists('valla', $datos)) {
            $sets[] = 'valla = :valla';
            $params['valla'] = $datos['valla'] === null
                ? null
                : (!empty($datos['valla']) ? 1 : 0);
        }
        if (!$sets) {
            http_response_code(400);
            echo json_encode(['error' => 'Nada para actualizar']);
            exit;
        }
        $stmt = $pdo->prepare("UPDATE torneos SET " . implode(', ', $sets) . " WHERE id = :t");
        $stmt->execute($params);
        echo json_encode(['ok' => true]);
        exit;
    }

    $partidaId = (int)($datos['partida_id'] ?? 0);
    $formato = trim($datos['formato'] ?? '');
    $participantes = $datos['participantes'] ?? [];
    $fixture = $datos['calendario'] ?? [];
    if ($partidaId <= 0 || !in_array($formato, $FORMATOS, true) || !is_array($participantes) || !count($participantes)) {
        http_response_code(400);
        echo json_encode(['error' => 'Faltan datos del torneo']);
        exit;
    }
    $usuarios = array_filter($participantes, fn($p) => !empty($p['es_usuario']));
    if (count($usuarios) !== 1) {
        http_response_code(422);
        echo json_encode(['error' => 'El torneo necesita exactamente un equipo usuario']);
        exit;
    }

    // Idempotencia: si ya existe el torneo de esta partida/formato, devolverlo
    // en vez de chocar con UNIQUE(partida_id). Así se puede reintentar
    // "preparar" y el frontend muestra "Continuar torneo" en vez de un error.
    $existe = $pdo->prepare(
        "SELECT id FROM torneos WHERE partida_id = :p AND formato = :f ORDER BY id DESC LIMIT 1"
    );
    $existe->execute(['p' => $partidaId, 'f' => $formato]);
    $anterior = $existe->fetchColumn();
    if ($anterior) {
        echo json_encode(['id' => (int)$anterior, 'ya_existia' => true]);
        exit;
    }

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare(
            "INSERT INTO torneos (partida_id, formato, fecha_actual, estado)
             VALUES (:p, :f, 0, 'armado')"
        );
        $stmt->execute(['p' => $partidaId, 'f' => $formato]);
        $torneoId = (int)$pdo->lastInsertId();

        $mapa = []; // temporada_id => torneo_equipos.id
        $ins = $pdo->prepare(
            "INSERT INTO torneo_equipos (torneo_id, temporada_id, zona, es_usuario)
             VALUES (:t, :temp, :zona, :u)"
        );
        foreach ($participantes as $p) {
            // temporada_id NULL = equipo del usuario (no es temporada del catálogo).
            $temp = isset($p['temporada_id']) ? (int)$p['temporada_id'] : null;
            if (!$temp && empty($p['es_usuario'])) {
                throw new Exception('Participante sin temporada');
            }
            $ins->execute([
                't' => $torneoId,
                'temp' => $temp ?: null,
                'zona' => isset($p['zona']) ? (string)$p['zona'] : null,
                'u' => !empty($p['es_usuario']) ? 1 : 0
            ]);
            $nuevoId = (int)$pdo->lastInsertId();
            if ($temp) $mapa[$temp] = $nuevoId;
            else $mapa['usuario'] = $nuevoId;
        }

        // local/visita se resuelven por temporada_id, por torneo_equipos.id
        // (local_eq/visita_eq) o por la marca 'usuario' (el equipo del usuario).
        $resolver = function ($f, $lado) use ($mapa) {
            $kEq = $lado . '_eq';
            $kTemp = $lado . '_temp';
            if (!empty($f[$kEq])) return (int)$f[$kEq];
            if (($f[$lado] ?? '') === 'usuario' || ($f['usuario'] ?? '') === $lado) {
                return $mapa['usuario'] ?? 0;
            }
            return $mapa[(int)($f[$kTemp] ?? 0)] ?? 0;
        };
        $cal = $pdo->prepare(
            "INSERT INTO calendario (torneo_id, fecha_n, fase, local_id, visita_id)
             VALUES (:t, :fecha, :fase, :loc, :vis)"
        );
        foreach ($fixture as $f) {
            $loc = $resolver($f, 'local');
            $vis = $resolver($f, 'visita');
            if (!$loc || !$vis) {
                throw new Exception('Fixture con equipo desconocido');
            }
            $cal->execute([
                't' => $torneoId,
                'fecha' => (int)($f['fecha_n'] ?? 0),
                'fase' => trim($f['fase'] ?? 'liga'),
                'loc' => $loc,
                'vis' => $vis
            ]);
        }
        $pdo->commit();
        echo json_encode(['id' => $torneoId]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        $code = $e instanceof PDOException ? 409 : 422;
        http_response_code($code);
        echo json_encode(['error' => $e instanceof PDOException
            ? 'Ese torneo ya existe o hay equipos repetidos'
            : $e->getMessage()]);
    }
    exit;
}

$partidaId = filter_input(INPUT_GET, 'partida_id', FILTER_VALIDATE_INT);
$torneoId = filter_input(INPUT_GET, 'torneo_id', FILTER_VALIDATE_INT);
if (!$partidaId && !$torneoId) {
    http_response_code(400);
    echo json_encode(['error' => 'Falta partida o torneo']);
    exit;
}

$stmt = $pdo->prepare($torneoId
    ? "SELECT * FROM torneos WHERE id = :t"
    : "SELECT * FROM torneos WHERE partida_id = :p");
$stmt->execute($torneoId ? ['t' => $torneoId] : ['p' => $partidaId]);
$torneo = $stmt->fetch();
if (!$torneo) {
    http_response_code(404);
    echo json_encode(['error' => 'No hay torneo para esa partida']);
    exit;
}

$stmt = $pdo->prepare(
    "SELECT te.id, te.temporada_id, te.zona, te.es_usuario,
            t.etiqueta, t.formacion, t.ovr_equipo, t.escudo_epoca, c.nombre AS club, c.escudo
     FROM torneo_equipos te
     LEFT JOIN temporadas t ON t.id = te.temporada_id
     LEFT JOIN clubes c ON c.id = t.club_id
     WHERE te.torneo_id = :t ORDER BY te.id"
);
$stmt->execute(['t' => $torneo['id']]);
$torneo['equipos'] = $stmt->fetchAll();
foreach ($torneo['equipos'] as &$e) {
    $e['es_usuario'] = (bool)$e['es_usuario'];
}
unset($e);

$stmt = $pdo->prepare(
    "SELECT cal.id, cal.fecha_n, cal.fase, cal.gf, cal.gc, cal.jugado, cal.detalle,
            cal.local_id, cal.visita_id,
            tl.etiqueta AS local_etiqueta, tv.etiqueta AS visita_etiqueta
     FROM calendario cal
     JOIN torneo_equipos lel ON lel.id = cal.local_id
     LEFT JOIN temporadas tl ON tl.id = lel.temporada_id
     JOIN torneo_equipos vel ON vel.id = cal.visita_id
     LEFT JOIN temporadas tv ON tv.id = vel.temporada_id
     WHERE cal.torneo_id = :t ORDER BY cal.fecha_n, cal.id"
);
$stmt->execute(['t' => $torneo['id']]);
$torneo['calendario'] = $stmt->fetchAll();
foreach ($torneo['calendario'] as &$c) {
    $c['jugado'] = (bool)$c['jugado'];
    $c['detalle'] = $c['detalle'] ? json_decode($c['detalle'], true) : null;
}
unset($c);

echo json_encode($torneo, JSON_UNESCAPED_UNICODE);
