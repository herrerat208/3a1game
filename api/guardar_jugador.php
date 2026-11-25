<?php
// 3A1 — Guarda un jugador en un slot (POST JSON: partida_id, temporada_jugador_id, slot).
// Valida en el servidor: slot válido para la formación de la partida y
// posición compatible (natural o secundaria). La UI sola no alcanza.
// Banco: slots SUP1..SUP5 en copa / SUP1..SUP8 en ligas. El suplente debe
// poder jugar en AL MENOS UN slot del XI (natural o secundaria) y no puede
// haber más de 2 suplentes con el mismo puesto natural (banco con cobertura,
// no 8 del mismo puesto). El arco NO admite suplentes: el arquero va solo al XI.
require 'cors.php';
require 'conexion.php';
require '_slots.php';

function es_slot_banco(string $slot): bool {
    return (bool)preg_match('/^SUP([1-8])$/', $slot, $m);
}

// Mismo tope que usa el frontend: 2 jugadores de campo por puesto natural.
// Los arqueros no pueden ir al banco (se valida explícitamente abajo).
function tope_banco_3a1(string $posicion): int {
    return 2;
}

$datos = json_decode(file_get_contents('php://input'), true);
$partidaId = (int)($datos['partida_id'] ?? 0);
$temporadaJugadorId = (int)($datos['temporada_jugador_id'] ?? 0);
$slot = trim($datos['slot'] ?? '');

if ($partidaId <= 0 || $temporadaJugadorId <= 0 || $slot === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Faltan datos para guardar el jugador']);
    exit;
}

$tieneModo = (bool)$pdo->query("SHOW COLUMNS FROM partidas LIKE 'modo'")->fetch();
$stmt = $pdo->prepare(
    "SELECT formacion" . ($tieneModo ? ", modo" : ", 'copa' AS modo") . " FROM partidas WHERE id = :partida"
);
$stmt->execute(['partida' => $partidaId]);
$partida = $stmt->fetch();
if (!$partida) {
    http_response_code(404);
    echo json_encode(['error' => 'La partida no existe']);
    exit;
}

if (es_slot_banco($slot)) {
    // Banco: tope por modo (5 copa / 8 liga) + cobertura posicional.
    $num = (int)substr($slot, 3);
    $tope = ($partida['modo'] === 'liga') ? 8 : 5;
    if ($num < 1 || $num > $tope) {
        http_response_code(422);
        echo json_encode(['error' => 'En este modo el banco llega hasta SUP' . $tope]);
        exit;
    }
    $stmt = $pdo->prepare(
        "SELECT jugador_id, posicion_natural, posiciones_secundarias
         FROM temporada_jugadores WHERE id = :tj"
    );
    $stmt->execute(['tj' => $temporadaJugadorId]);
    $tj = $stmt->fetch();
    if (!$tj) {
        http_response_code(404);
        echo json_encode(['error' => 'El jugador no existe']);
        exit;
    }
    if ($tj['posicion_natural'] === 'ARQ') {
        http_response_code(422);
        echo json_encode(['error' => 'El arquero no va al banco: elegí un jugador de campo']);
        exit;
    }
    // El suplente debe poder jugar en al menos un slot del XI.
    $mapa = formaciones_3a1()[$partida['formacion']] ?? null;
    if (!$mapa) {
        http_response_code(422);
        echo json_encode(['error' => 'Formación desconocida']);
        exit;
    }
    $sec = array_filter(array_map('trim', explode(',', $tj['posiciones_secundarias'] ?? '')));
    $cubre = false;
    foreach (array_values($mapa) as $pos) {
        if ($tj['posicion_natural'] === $pos || in_array($pos, $sec, true)) {
            $cubre = true;
            break;
        }
    }
    if (!$cubre) {
        http_response_code(422);
        echo json_encode(['error' => 'Ese jugador no cubre ningún puesto de tu ' . $partida['formacion']]);
        exit;
    }
    // Tope de suplentes con el mismo puesto natural (2 por puesto).
    $topePuesto = tope_banco_3a1($tj['posicion_natural']);
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) AS n FROM partida_jugadores pj
         JOIN temporada_jugadores tj ON tj.id = pj.temporada_jugador_id
         WHERE pj.partida_id = :partida AND pj.slot LIKE 'SUP%'
           AND tj.posicion_natural = :pos"
    );
    $stmt->execute(['partida' => $partidaId, 'pos' => $tj['posicion_natural']]);
    if ((int)$stmt->fetch()['n'] >= $topePuesto) {
        http_response_code(422);
        $mensaje = 'Ya tenés 2 suplentes de puesto ' . $tj['posicion_natural'] . ': elegí otro puesto';
        echo json_encode(['error' => $mensaje]);
        exit;
    }
} else {
    $mapa = formaciones_3a1()[$partida['formacion']] ?? null;
    if (!$mapa || !isset($mapa[$slot])) {
        http_response_code(422);
        echo json_encode(['error' => 'Ese lugar no existe en la formación ' . $partida['formacion']]);
        exit;
    }
    $posRequerida = $mapa[$slot];

    $stmt = $pdo->prepare(
        "SELECT jugador_id, posicion_natural, posiciones_secundarias
         FROM temporada_jugadores WHERE id = :tj"
    );
    $stmt->execute(['tj' => $temporadaJugadorId]);
    $tj = $stmt->fetch();
    if (!$tj) {
        http_response_code(404);
        echo json_encode(['error' => 'El jugador no existe']);
        exit;
    }

    $sec = array_filter(array_map('trim', explode(',', $tj['posiciones_secundarias'] ?? '')));
    if ($tj['posicion_natural'] !== $posRequerida && !in_array($posRequerida, $sec, true)) {
        http_response_code(422);
        echo json_encode(['error' => 'Ese jugador no puede jugar en ' . $slot]);
        exit;
    }
}

// Se repite la fila exacta (jugador + año), no la persona: la misma persona
// en otro plantel histórico SÍ se puede elegir en la misma partida.
$stmt = $pdo->prepare(
    "SELECT 1 FROM partida_jugadores
     WHERE partida_id = :partida AND temporada_jugador_id = :tj
     LIMIT 1"
);
$stmt->execute(['partida' => $partidaId, 'tj' => $temporadaJugadorId]);
if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode(['error' => 'Ese jugador de ese año ya fue elegido en esta partida']);
    exit;
}

try {
    $stmt = $pdo->prepare(
        "INSERT INTO partida_jugadores
         (partida_id, temporada_jugador_id, slot)
         VALUES (:partida, :jugador, :slot)"
    );
    $stmt->execute([
        'partida' => $partidaId,
        'jugador' => $temporadaJugadorId,
        'slot' => $slot
    ]);
    echo json_encode(['ok' => true]);
} catch (PDOException $e) {
    // 409 específico: ¿slot ocupado o jugador repetido?
    $stmt = $pdo->prepare(
        "SELECT slot, temporada_jugador_id FROM partida_jugadores
         WHERE partida_id = :partida AND (slot = :slot OR temporada_jugador_id = :jugador)"
    );
    $stmt->execute(['partida' => $partidaId, 'slot' => $slot, 'jugador' => $temporadaJugadorId]);
    $choque = $stmt->fetchAll();
    $slotOcupado = false;
    $jugadorRepetido = false;
    foreach ($choque as $c) {
        if ($c['slot'] === $slot) $slotOcupado = true;
        if ((int)$c['temporada_jugador_id'] === $temporadaJugadorId) $jugadorRepetido = true;
    }
    http_response_code(409);
    if ($jugadorRepetido) {
        echo json_encode(['error' => 'Ese jugador ya fue elegido en esta partida']);
    } elseif ($slotOcupado) {
        echo json_encode(['error' => 'Ese lugar ya está ocupado']);
    } else {
        echo json_encode(['error' => 'Ese lugar ya está ocupado o el jugador ya fue elegido']);
    }
}
