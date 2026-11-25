<?php
// 3A1 — Enriquece jugadores.foto_url desde la web general (Wikipedia, sin key).
// Uso: php scripts/enriquecer_fotos.php [--apply] [--limit=N]
//   Sin --apply es dry-run (solo muestra qué encontraría, no toca la DB).
// Fuente: API PageImages de es.wikipedia.org con fallback a en.wikipedia.org.
//   Solo se guardan thumbnails de Wikimedia Commons. Sin foto libre => NULL.
// Dorsal: NO se completa (no hay fuente general fiable para dorsales
//   históricos por temporada; la columna queda NULL hasta carga manual).
$_SERVER['REQUEST_METHOD'] = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
require __DIR__ . '/../api/conexion.php';

$apply = in_array('--apply', $argv, true);
$limit = 0;
foreach ($argv as $a) {
    if (str_starts_with($a, '--limit=')) $limit = max(0, (int)substr($a, 8));
}

$UA = '3A1-draft/1.0 (proyecto escolar; contacto local)';
function norm_foto(string $s): string {
    static $map = null;
    if ($map === null) {
        $de = 'áéíóúñüÁÉÍÓÚÑÜçÇàèêâôëöÀÈÊÂÔËÖ’';
        $a = 'aeiounuAEIOUNUcCaeeaoeoAEEAOEO ';
        $map = [];
        foreach (preg_split('//u', $de, -1, PREG_SPLIT_NO_EMPTY) as $k => $ch) {
            $map[$ch] = $a[$k];
        }
    }
    $s = mb_strtolower($s, 'UTF-8');
    return trim(preg_replace('/[^a-z0-9 ]+/', ' ', strtr($s, $map)));
}
function wiki_buscar_y_pic(string $nombre, string $host, string $ua): ?string {
    // Búsqueda abierta: el título exacto puede fallar ("Darío Felman" vs
    // "Dario Felman"). Toma el primer artículo y valida que el título
    // contenga el apellido del jugador.
    $url = "https://{$host}/w/api.php?action=query&generator=search&gsrsearch="
        . urlencode($nombre . ' futbolista') . "&gsrlimit=1&prop=pageimages&pithumbsize=200&format=json";
    $url2 = "https://{$host}/w/api.php?action=query&generator=search&gsrsearch="
        . urlencode($nombre) . "&gsrlimit=1&prop=pageimages&pithumbsize=200&format=json";
    $toks = preg_split('/\s+/', norm_foto($nombre));
    $ape = end($toks);
    foreach ([$url, $url2] as $u) {
        $ctx = stream_context_create(['http' => [
            'header' => "User-Agent: {$ua}\r\n",
            'timeout' => 15,
        ]]);
        $raw = @file_get_contents($u, false, $ctx);
        if (!$raw) continue;
        $data = json_decode($raw, true);
        foreach ($data['query']['pages'] ?? [] as $p) {
            if (isset($p['missing'])) continue;
            $tnorm = norm_foto($p['title'] ?? '');
            if (!str_contains($tnorm, $ape)) continue;
            if (!empty($p['thumbnail']['source'])) {
                $src = strtok($p['thumbnail']['source'], '?');
                if (str_starts_with($src, 'https://upload.wikimedia.org/')
                    || str_starts_with($src, 'https://thumb.wikimedia.org/')) return $src;
            }
        }
    }
    return null;
}
function wiki_thumb(string $nombre, string $host, string $ua): ?string {
    $url = "https://{$host}/w/api.php?action=query&titles=" . urlencode($nombre)
        . "&prop=pageimages&format=json&pithumbsize=200";
    $ctx = stream_context_create(['http' => [
        'header' => "User-Agent: {$ua}\r\n",
        'timeout' => 15,
    ]]);
    $raw = @file_get_contents($url, false, $ctx);
    if (!$raw) return null;
    $data = json_decode($raw, true);
    $pages = $data['query']['pages'] ?? [];
    foreach ($pages as $p) {
        if (isset($p['missing'])) return null; // no existe la página: no insistir
        if (!empty($p['thumbnail']['source'])) {
            $src = strtok($p['thumbnail']['source'], '?'); // fuera utm_* de la API
            if (str_starts_with($src, 'https://upload.wikimedia.org/')
                || str_starts_with($src, 'https://thumb.wikimedia.org/')) return $src;
        }
    }
    return null;
}

$sql = "SELECT id, nombre FROM jugadores WHERE foto_url IS NULL ORDER BY id";
if ($limit > 0) $sql .= " LIMIT " . $limit;
$nombres = $pdo->query($sql)->fetchAll();

$ok = 0;
$sin = 0;
foreach ($nombres as $fila) {
    $nombre = $fila['nombre'];
    $thumb = wiki_thumb($nombre, 'es.wikipedia.org', $UA)
        ?? wiki_thumb($nombre, 'en.wikipedia.org', $UA)
        ?? wiki_buscar_y_pic($nombre, 'es.wikipedia.org', $UA)
        ?? wiki_buscar_y_pic($nombre, 'en.wikipedia.org', $UA);
    if ($thumb) {
        $ok++;
        echo "[FOTO] {$nombre} => {$thumb}\n";
        if ($apply) {
            $up = $pdo->prepare(
                "UPDATE jugadores SET foto_url = :url WHERE id = :id AND foto_url IS NULL"
            );
            $up->execute(['url' => $thumb, 'id' => $fila['id']]);
        }
    } else {
        $sin++;
        echo "[----] {$nombre} (sin foto libre)\n";
    }
    sleep(1); // cortesía con la API pública
}

echo "---\nRevisados: " . count($nombres)
    . " · con foto: {$ok} · sin foto: {$sin}"
    . ($apply ? " (GUARDADAS)\n" : " (dry-run, sin --apply no se guarda nada)\n");
