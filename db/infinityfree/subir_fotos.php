<?php
// TEMPORAL — subir a htdocs/ junto con fotos.zip, abrir UNA VEZ y BORRAR.
// Extrae las carpetas de imágenes porque el File Manager de InfinityFree
// no permite descomprimir ZIP. No toca nada fuera de jugadores/ y escudos/.
@set_time_limit(180);
header('Content-Type: text/plain; charset=utf-8');

// Reemplazá este placeholder por un token largo y aleatorio antes de subir.
// No publicar el token real en el repositorio.
if (($_GET['token'] ?? '') !== 'REEMPLAZAR_CON_TOKEN_LARGO_Y_ALEATORIO') {
    http_response_code(403);
    echo "Token inválido\n";
    exit;
}

$zipPath = __DIR__ . '/fotos.zip';
if (!is_file($zipPath)) {
    echo "Falta fotos.zip en esta carpeta\n";
    exit;
}
if (!class_exists('ZipArchive')) {
    echo "ZipArchive no está disponible en este hosting; usar FileZilla\n";
    exit;
}

$zip = new ZipArchive();
if ($zip->open($zipPath) !== true) {
    echo "No se pudo abrir fotos.zip\n";
    exit;
}

$permitidas = ['jugadores/', 'escudos/', 'index.html', 'favicon.png', 'favicon.svg', 'logo-3a1.webp'];
$extraidas = 0;
$omitidas = 0;

for ($i = 0; $i < $zip->numFiles; $i++) {
    $nombre = str_replace('\\', '/', $zip->getNameIndex($i));
    // Al comprimir desde Windows a veces queda un wrapper "dist/".
    if (strpos($nombre, 'dist/') === 0) $nombre = substr($nombre, 5);
    if ($nombre === '') continue;

    if (substr($nombre, 0, 1) === '/' || preg_match('#(^|/)\.\.(/|$)#', $nombre)) {
        $omitidas++;
        continue;
    }

    $ok = false;
    foreach ($permitidas as $prefijo) {
        if ($nombre === $prefijo || (substr($prefijo, -1) === '/' && strpos($nombre, $prefijo) === 0)) {
            $ok = true;
            break;
        }
    }
    if (!$ok) {
        $omitidas++;
        continue;
    }

    $destino = __DIR__ . '/' . $nombre;
    if (substr($nombre, -1) === '/') {
        if (!is_dir($destino)) @mkdir($destino, 0755, true);
        continue;
    }
    $carpeta = dirname($destino);
    if (!is_dir($carpeta)) @mkdir($carpeta, 0755, true);
    $contenido = $zip->getFromIndex($i);
    if ($contenido === false || file_put_contents($destino, $contenido) === false) {
        $omitidas++;
        continue;
    }
    $extraidas++;
}
$zip->close();

echo "Extraídas: $extraidas\n";
echo "Omitidas: $omitidas\n";
echo "jugadores/: " . (is_dir(__DIR__ . '/jugadores') ? 'OK' : 'FALTA') . "\n";
echo "jugadores/rivales/: " . (is_dir(__DIR__ . '/jugadores/rivales') ? 'OK' : 'FALTA') . "\n";
echo "escudos/: " . (is_dir(__DIR__ . '/escudos') ? 'OK' : 'FALTA') . "\n";
echo "BORRAR este archivo y fotos.zip cuando termine.\n";
