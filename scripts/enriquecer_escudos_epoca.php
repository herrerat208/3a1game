<?php
// 3A1 — Escudos DE ÉPOCA por temporada (scripts/enriquecer_escudos_epoca.php).
// Uso: php scripts/enriquecer_escudos_epoca.php [--apply] [--limit=N] [--anio=AAAA]
//   Sin --apply es dry-run. Respeta escudo_epoca IS NULL.
// Commons (sin key): busca "{club} escudo" y acepta svg/png/jpg con fecha:
//   año exacto en título, o rango (AAAA-BBBB) que contenga el año pedido.
// Sin evidencia de fecha se salta (fallback = clubes.escudo actual).
// Guarda temporadas.escudo_epoca (thumb 200px PNG).
$_SERVER['REQUEST_METHOD'] = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
require __DIR__ . '/../api/conexion.php';

$apply = in_array('--apply', $argv, true);
$limit = 0;
$anio = 0;
foreach ($argv as $a) {
    if (str_starts_with($a, '--limit=')) $limit = max(0, (int)substr($a, 8));
    if (str_starts_with($a, '--anio=')) $anio = max(0, (int)substr($a, 7));
}

$UA = '3A1-draft/1.0 (proyecto escolar; contacto local)';

function commons_get(array $params, string $ua): ?array {
    $url = 'https://commons.wikimedia.org/w/api.php?' . http_build_query(
        ['format' => 'json'] + $params);
    $ctx = stream_context_create(['http' => [
        'header' => "User-Agent: {$ua}\r\n",
        'timeout' => 20,
    ]]);
    $raw = @file_get_contents($url, false, $ctx);
    if (!$raw) return null;
    return json_decode($raw, true);
}

function norm(string $s): string {
    static $map = null;
    if ($map === null) {
        $de = 'áéíóúñüÁÉÍÓÚÑÜçÇàèêâôëöÀÈÊÂÔËÖ';
        $a = 'aeiounuAEIOUNUcCaeeaoeoAEEAOEO';
        $map = [];
        foreach (preg_split('//u', $de, -1, PREG_SPLIT_NO_EMPTY) as $k => $ch) {
            $map[$ch] = $a[$k];
        }
    }
    $s = mb_strtolower($s, 'UTF-8');
    $s = strtr($s, $map);
    return trim(preg_replace('/[^a-z0-9 ]+/', ' ', $s));
}

function buscar_escudo(string $club, int $anio, string $ua): ?array {
    $nc = norm($club);
    // Tokens distintivos del club ("river plate" => ambos; "boca" => uno).
    $toks = array_values(array_filter(preg_split('/\s+/', $nc),
        fn($t) => mb_strlen($t) > 2));
    $queries = ["{$nc} escudo {$anio}", "{$nc} escudo", "{$nc} escudo insignia",
        "{$nc} crest", "{$nc} logo {$anio}"];
    $vistos = [];
    foreach ($queries as $sr) {
        $res = commons_get([
            'action' => 'query', 'list' => 'search',
            'srsearch' => $sr, 'srnamespace' => 6, 'srlimit' => 20,
        ], $ua);
        if (!$res) continue;
        foreach (($res['query']['search'] ?? []) as $hit) {
            $title = $hit['title'] ?? '';
            if (isset($vistos[$title])) continue;
            $vistos[$title] = true;
            if (!preg_match('/\.(svg|png|jpe?g)$/i', $title)) continue;
            $nt = norm($title);
            // El club tiene que estar: todos los tokens distintivos.
            $esClub = true;
            foreach ($toks as $t) {
                if (!str_contains($nt, $t)) { $esClub = false; break; }
            }
            if (!$esClub) continue;
            // River Plate BA vs Montevideo/Asunción: exigir 'atletico'.
            if ($nc === 'river plate' && !str_contains($nt, 'atletico')) continue;
            // Año: exacto o rango (AAAA-BBBB) que lo contenga.
            $valeAnio = false;
            if (preg_match('/\b((?:19|20)\d{2})\b/', $nt, $m) && (int)$m[1] === $anio) {
                $valeAnio = true;
            } elseif (preg_match('/\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2}|actualidad|present|hoy)\b/', $nt, $m)) {
                $desde = (int)$m[1];
                $hasta = is_numeric($m[2]) ? (int)$m[2] : 2100;
                if ($anio >= $desde && $anio <= $hasta) $valeAnio = true;
            }
            if (!$valeAnio) continue;
            return ['title' => $title];
        }
        usleep(300000);
    }
    return null;
}

function thumb_de(string $fileTitle, string $ua): ?string {
    $res = commons_get([
        'action' => 'query', 'prop' => 'imageinfo',
        'iiprop' => 'url', 'iiurlwidth' => 200,
        'titles' => $fileTitle,
    ], $ua);
    if (!$res) return null;
    foreach (($res['query']['pages'] ?? []) as $p) {
        $u = $p['imageinfo'][0]['thumburl'] ?? null;
        if ($u && (str_starts_with($u, 'https://upload.wikimedia.org/')
                || str_starts_with($u, 'https://thumb.wikimedia.org/'))) {
            return strtok($u, '?');
        }
    }
    return null;
}

$sql = "SELECT t.id, t.etiqueta, t.anio_orden, c.nombre AS club
        FROM temporadas t JOIN clubes c ON c.id = t.club_id
        WHERE t.escudo_epoca IS NULL";
if ($anio > 0) $sql .= " AND t.anio_orden = " . $anio;
$sql .= " ORDER BY t.anio_orden, t.etiqueta";
if ($limit > 0) $sql .= " LIMIT " . $limit;
$filas = $pdo->query($sql)->fetchAll();

$ok = 0;
$sin = 0;
foreach ($filas as $f) {
    $cand = buscar_escudo($f['club'], (int)$f['anio_orden'], $UA);
    $thumb = $cand ? thumb_de($cand['title'], $UA) : null;
    if ($cand && $thumb) {
        $ok++;
        echo "[ESCUDO {$f['anio_orden']}] {$f['etiqueta']} => {$thumb}\n";
        echo "        fuente: {$cand['title']}\n";
        if ($apply) {
            $up = $pdo->prepare(
                "UPDATE temporadas SET escudo_epoca = :url WHERE id = :id AND escudo_epoca IS NULL"
            );
            $up->execute(['url' => $thumb, 'id' => $f['id']]);
        }
    } else {
        $sin++;
        echo "[---- {$f['anio_orden']}] {$f['etiqueta']}\n";
    }
    sleep(1);
}

echo "---\nRevisadas: " . count($filas)
    . " · con escudo de época: {$ok} · sin escudo: {$sin}"
    . ($apply ? " (GUARDADOS)\n" : " (dry-run, sin --apply no se guarda nada)\n");
