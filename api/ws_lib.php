<?php
// Aviso al servidor de tiempo real. Si el tubo está caído, el guardado ya
// quedó en MySQL: el aviso es best-effort, no parte de la transacción.
require_once __DIR__ . '/config.php';

function notificarRanking3a1($juegoId) {
    // config.php se incluye fuera de la función: sin `global` el secreto
    // llegaría vacío y el broadcast sería rechazado con 403.
    global $A1_WS_URL, $A1_WS_SECRET;
    $url = ($A1_WS_URL ?? 'http://127.0.0.1:8787') . '/broadcast';
    $cuerpo = json_encode(['juegoId' => (int)$juegoId], JSON_UNESCAPED_UNICODE);
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\nX-Ws-Secret: " . ($A1_WS_SECRET ?? '') . "\r\n",
            'content' => $cuerpo,
            'timeout' => 1,
            'ignore_errors' => true
        ]
    ]);
    @file_get_contents($url, false, $ctx);
}
