<?php
require_once __DIR__ . '/conexion.php';
require_once __DIR__ . '/cors.php';

// Endpoint de solo lectura: nombres reales de árbitros, periodistas e
// hinchas usados únicamente como narrativa del juego.
// No modifica ningún resultado, tarjeta ni estadística.

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $arbitros = $pdo->query(
        "SELECT id, nombre, activo FROM arbitros ORDER BY nombre"
    )->fetchAll(PDO::FETCH_ASSOC);

    $periodistas = $pdo->query(
        "SELECT id, nombre, medio, equipo_preferido AS equipoPreferido,
                solo_river AS soloRiver, es_streamer AS esStreamer, activo
         FROM periodistas ORDER BY nombre"
    )->fetchAll(PDO::FETCH_ASSOC);

    $hinchas = $pdo->query(
        "SELECT id, nombre, equipo, activo FROM hinchas ORDER BY nombre"
    )->fetchAll(PDO::FETCH_ASSOC);

    foreach ([$arbitros, $periodistas, $hinchas] as &$filas) {
        foreach ($filas as &$f) {
            $f['activo'] = (bool)$f['activo'];
            if (isset($f['soloRiver'])) $f['soloRiver'] = (bool)$f['soloRiver'];
            if (isset($f['esStreamer'])) $f['esStreamer'] = (bool)$f['esStreamer'];
        }
        unset($f);
    }
    unset($filas);

    echo json_encode([
        'ok' => true,
        'arbitros' => $arbitros,
        'periodistas' => $periodistas,
        'hinchas' => $hinchas,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'No se pudieron cargar los nombres de prensa y arbitraje',
        'detalle' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
