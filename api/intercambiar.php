<?php
// 3A1 — Intercambio atómico de dos slots (XI <-> banco o XI <-> XI).
// POST: {partida_id, slot_a, slot_b}
// Evita el estado intermedio de quitar+guardar en llamadas separadas.
require 'cors.php';
require 'conexion.php';
require '_slots.php';

function slot_banco_3a1(string $slot): bool {
    return (bool)preg_match('/^SUP([1-8])$/', $slot);
}

// Mismo tope que usa el frontend: 2 jugadores de campo por puesto natural.
// Los arqueros no pueden ir al banco (se valida explícitamente abajo).
function tope_banco_3a1(string $posicion): int {
    return 2;
}

function cubre_xi_3a1(array $jugador, array $mapa): bool {
    $sec = array_filter(array_map('trim', explode(',', $jugador['posiciones_secundarias'] ?? '')));
    foreach (array_values($mapa) as $pos) {
        if ($jugador['posicion_natural'] === $pos || in_array($pos, $sec, true)) {
            return true;
        }
    }
    return false;
}

function puede_jugar_3a1(array $jugador, string $slot, array $mapa): bool {
    $pos = $mapa[$slot] ?? null;
    if (!$pos) return false;
    $sec = array_filter(array_map('trim', explode(',', $jugador['posiciones_secundarias'] ?? '')));
    return $jugador['posicion_natural'] === $pos || in_array($pos, $sec, true);
}

function error_3a1(int $codigo, string $mensaje): void {
    http_response_code($codigo);
    echo json_encode(['error' => $mensaje]);
    exit;
}

$datos = json_decode(file_get_contents('php://input'), true);
$partidaId = (int)($datos['partida_id'] ?? 0);
$slotA = trim($datos['slot_a'] ?? '');
$slotB = trim($datos['slot_b'] ?? '');

if ($partidaId <= 0 || $slotA === '' || $slotB === '' || $slotA === $slotB) {
    error_3a1(400, 'Faltan datos del intercambio');
}

$stmt = $pdo->prepare("SELECT formacion FROM partidas WHERE id = :p");
$stmt->execute(['p' => $partidaId]);
$partida = $stmt->fetch();
if (!$partida) error_3a1(404, 'La partida no existe');

$mapa = formaciones_3a1()[$partida['formacion']] ?? null;
if (!$mapa) error_3a1(422, 'Formación desconocida');

$stmt = $pdo->prepare(
    "SELECT slot, temporada_jugador_id
     FROM partida_jugadores
     WHERE partida_id = :p AND slot IN (:a, :b)"
);
$stmt->execute(['p' => $partidaId, 'a' => $slotA, 'b' => $slotB]);
$filas = $stmt->fetchAll();
if (count($filas) !== 2) error_3a1(404, 'Los dos slots tienen que estar ocupados');

$porSlot = [];
foreach ($filas as $f) {
    $porSlot[$f['slot']] = (int)$f['temporada_jugador_id'];
}
$tjA = $porSlot[$slotA] ?? 0;
$tjB = $porSlot[$slotB] ?? 0;
if (!$tjA || !$tjB) error_3a1(404, 'Los dos slots tienen que estar ocupados');

$stmt = $pdo->prepare(
    "SELECT id, posicion_natural, posiciones_secundarias
     FROM temporada_jugadores WHERE id IN (:a, :b)"
);
$stmt->execute(['a' => $tjA, 'b' => $tjB]);
$jugadores = [];
foreach ($stmt->fetchAll() as $j) {
    $jugadores[(int)$j['id']] = $j;
}
if (!isset($jugadores[$tjA], $jugadores[$tjB])) error_3a1(404, 'Jugador inexistente');

$aBanco = slot_banco_3a1($slotA);
$bBanco = slot_banco_3a1($slotB);

if ($aBanco !== $bBanco) {
    // Un titular y un suplente: el suplente debe cubrir el puesto del XI y el
    // titular debe seguir siendo un suplente válido (cobertura + tope 2).
    $xiSlot = $aBanco ? $slotB : $slotA;
    $xiTj = $aBanco ? $tjB : $tjA;
    $bancoSlot = $aBanco ? $slotA : $slotB;
    $bancoTj = $aBanco ? $tjA : $tjB;

    if (!puede_jugar_3a1($jugadores[$bancoTj], $xiSlot, $mapa)) {
        error_3a1(422, 'Ese jugador no puede jugar en ' . $xiSlot);
    }
    if (!cubre_xi_3a1($jugadores[$xiTj], $mapa)) {
        error_3a1(422, 'El titular no cubre ningún puesto del XI para ir al banco');
    }
    if ($jugadores[$xiTj]['posicion_natural'] === 'ARQ') {
        error_3a1(422, 'El arquero no va al banco: elegí un jugador de campo');
    }

    $stmt = $pdo->prepare(
        "SELECT COUNT(*) AS n
         FROM partida_jugadores pj
         JOIN temporada_jugadores tj ON tj.id = pj.temporada_jugador_id
         WHERE pj.partida_id = :p AND pj.slot LIKE 'SUP%'
           AND pj.slot <> :sale AND tj.posicion_natural = :pos"
    );
    $stmt->execute([
        'p' => $partidaId,
        'sale' => $bancoSlot,
        'pos' => $jugadores[$xiTj]['posicion_natural']
    ]);
    $topePuesto = tope_banco_3a1($jugadores[$xiTj]['posicion_natural']);
    if ((int)$stmt->fetch()['n'] >= $topePuesto) {
        error_3a1(422, 'Ya hay 2 suplentes de puesto ' . $jugadores[$xiTj]['posicion_natural']);
    }
} elseif (!$aBanco && !$bBanco) {
    // Dos titulares: cada uno debe poder jugar en el slot del otro.
    if (!puede_jugar_3a1($jugadores[$tjB], $slotA, $mapa)) {
        error_3a1(422, 'Ese jugador no puede jugar en ' . $slotA);
    }
    if (!puede_jugar_3a1($jugadores[$tjA], $slotB, $mapa)) {
        error_3a1(422, 'Ese jugador no puede jugar en ' . $slotB);
    }
}
// Dos suplentes: cambian de lugar sin alterar la composición del banco.

try {
    $pdo->beginTransaction();
    $tmp = '__SWAP__';
    $stmt = $pdo->prepare("SELECT 1 FROM partida_jugadores WHERE partida_id = :p AND slot = :s");
    $stmt->execute(['p' => $partidaId, 's' => $tmp]);
    if ($stmt->fetch()) {
        throw new Exception('Slot temporal ocupado');
    }

    $upd = $pdo->prepare(
        "UPDATE partida_jugadores SET slot = :nuevo
         WHERE partida_id = :p AND slot = :viejo"
    );
    $upd->execute(['nuevo' => $tmp, 'p' => $partidaId, 'viejo' => $slotA]);
    if ($upd->rowCount() !== 1) throw new Exception('No se pudo mover el primer slot');

    $upd->execute(['nuevo' => $slotA, 'p' => $partidaId, 'viejo' => $slotB]);
    if ($upd->rowCount() !== 1) throw new Exception('No se pudo mover el segundo slot');

    $upd->execute(['nuevo' => $slotB, 'p' => $partidaId, 'viejo' => $tmp]);
    if ($upd->rowCount() !== 1) throw new Exception('No se pudo cerrar el intercambio');

    $pdo->commit();
    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code($e instanceof PDOException ? 409 : 422);
    echo json_encode(['error' => $e->getMessage()]);
}
