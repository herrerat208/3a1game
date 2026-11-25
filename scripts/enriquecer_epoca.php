<?php
// 3A1 — Fotos DE ÉPOCA por participación ( scripts/enriquecer_epoca.php ).
// Uso: php scripts/enriquecer_epoca.php [--apply] [--limit=N]
//   Sin --apply es dry-run (no toca la DB). Respeta foto_epoca IS NULL.
//
// Estrategia (Wikimedia Commons, sin key): por cada temporada_jugadores sin
// foto se busca `Nombre Año` (+ club) en File:. Reglas duras:
//   1) el nombre (nombre+apellido) tiene que estar en el TÍTULO;
//   2) nada grupal (equipo/plantel/squad);
//   3) año EXACTO en título o snippet (el que pide el usuario, sin ±1).
// Solo fotos (jpg/jpeg). Ante la duda, NULL (la UI muestra la inicial;
// jamás una foto de otra época ni de otra persona).
// Guarda foto_epoca (thumb 300px) + foto_fuente (título en Commons).
$_SERVER['REQUEST_METHOD'] = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
require __DIR__ . '/../api/conexion.php';

$apply = in_array('--apply', $argv, true);
$limit = 0;
$anio = 0;
$debug = '';
$soloNombre = '';
foreach ($argv as $a) {
    if (str_starts_with($a, '--limit=')) $limit = max(0, (int)substr($a, 8));
    if (str_starts_with($a, '--anio=')) $anio = max(0, (int)substr($a, 7));
    if (str_starts_with($a, '--debug=')) $debug = substr($a, 8);
    if (str_starts_with($a, '--nombre=')) $soloNombre = substr($a, 9);
}

$UA = '3A1-draft/1.0 (proyecto escolar; contacto local)';

function commons_get(array $params, string $ua): ?array {
    $url = 'https://commons.wikimedia.org/w/api.php?' . http_build_query(
        ['format' => 'json'] + $params);
    for ($intento = 0; $intento < 3; $intento++) {
        if ($intento > 0) sleep(2 * $intento);
        $ctx = stream_context_create(['http' => [
            'header' => "User-Agent: {$ua}\r\n",
            'timeout' => 20,
        ]]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw) {
            $data = json_decode($raw, true);
            if (is_array($data)) return $data;
        }
    }
    return null;
}

function club_corto(string $club): string {
    // 'Boca', 'River Plate' => 'River', 'Newell’s ...' => primer token útil.
    $club = str_replace(['’', "'"], '', $club);
    foreach (preg_split('/\s+/', trim($club)) as $tok) {
        if (mb_strlen($tok) > 2) return $tok;
    }
    return $club;
}

// Minúsculas sin tildes para comparar con títulos de Commons (casi siempre
// sin tildes: "Antonio Rattin (Boca) - El Gráfico 2512.jpg").
// OJO: nada de iconv TRANSLIT (en Windows deforma: Rattín => Ratt'in).
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

function apellido(string $nombre): string {
    $toks = preg_split('/\s+/', trim($nombre));
    return end($toks);
}

function buscar_epoca(string $nombre, int $anio, string $club, string $ua): ?array {
    global $debug;
    $corto = norm(club_corto($club));
    $toks = preg_split('/\s+/', norm($nombre), -1, PREG_SPLIT_NO_EMPTY);
    $ape = end($toks);
    $primero = $toks[0];
    $unico = count($toks) === 1;
    $queries = [norm($nombre) . " {$anio}", "{$ape} {$anio}", norm($nombre) . " {$corto}", "{$ape} {$corto}"];
    $vistos = [];
    $mejor = null;
    foreach ($queries as $sr) {
        $res = commons_get([
            'action' => 'query', 'list' => 'search',
            'srsearch' => $sr, 'srnamespace' => 6, 'srlimit' => 30,
        ], $ua);
        if (!$res) continue;
        foreach (($res['query']['search'] ?? []) as $hit) {
            $title = $hit['title'] ?? '';
            if ($debug !== '') echo "  hit {$title}\n";
            if (isset($vistos[$title])) continue;
            $vistos[$title] = true;
            if (!preg_match('/\.(jpe?g)$/i', $title)) continue; // solo fotos
            $nt = norm($title);
            $ns = norm(strip_tags($hit['snippet'] ?? ''));
            // REGLA 1: el apellido tiene que estar en el título.
            // (Casi todas las fichas Commons usan solo el apellido:
            // "Fillol river.jpg", "Rattin boca figurita.jpg".)
            if (!str_contains($nt, $ape)) {
                if ($debug !== '') echo "  skip {$title} (sin apellido)\n";
                continue;
            }
            // REGLA 2: foto de equipo/plantel no sirve para un jugador.
            if (preg_match('/\bequipo\b|\bplantel\b|formation|team photo|\bsquad\b|\bxi\b/', $nt)) {
                if ($debug !== '') echo "  skip {$title} (grupal)\n";
                continue;
            }
            // REGLA 3: año EXACTO en título o snippet (el que pide el usuario).
            $fotoAnio = null;
            foreach ([$nt, $ns] as $txt) {
                if (preg_match_all('/\b((?:19|20)\d{2})\b/', $txt, $mm)) {
                    foreach ($mm[1] as $y) {
                        if ((int)$y === $anio) $fotoAnio = (int)$y;
                    }
                }
            }
            if ($fotoAnio === null) {
                if ($debug !== '') echo "  skip {$title} (sin año {$anio})\n";
                continue;
            }
            $score = 3;
            if ($corto !== '' && str_contains($nt, $corto)) $score += 1;
            if (preg_match('/el grafico|figurita|cromo|album/', $nt)) $score += 1;
            if ($score >= 3 && ($mejor === null || $score > $mejor['score'])) {
                $mejor = ['title' => $title, 'score' => $score, 'foto_anio' => $fotoAnio];
            }
        }
        usleep(300000);
        if ($debug !== '') echo "  query '{$sr}' dio " . count($res['query']['search'] ?? []) . " hits\n";
        if ($mejor && $mejor['score'] >= 5) break; // año + club + época: listo
    }
    if ($debug !== '') echo '  mejor: ' . json_encode($mejor, JSON_UNESCAPED_UNICODE) . "\n";
    return $mejor;
}

function thumb_de(string $fileTitle, string $ua): ?string {
    global $debug;
    $res = commons_get([
        'action' => 'query', 'prop' => 'imageinfo',
        'iiprop' => 'url', 'iiurlwidth' => 300,
        'titles' => $fileTitle,
    ], $ua);
    if ($debug !== '') echo '  thumb res: ' . ($res === null ? 'NULL' : 'ok') . "\n";
    if ($debug !== '' && $res !== null) {
        foreach (($res['query']['pages'] ?? []) as $pid => $p) {
            echo '  page ' . $pid . ' keys: ' . implode(',', array_keys($p)) . ' title=' . ($p['title'] ?? '?') . "\n";
        }
    }
    if (!$res) return null;
    foreach (($res['query']['pages'] ?? []) as $p) {
        $u = $p['imageinfo'][0]['thumburl'] ?? null;
        // Thumbs salen de thumb.wikimedia.org; originales de upload.
        if ($u && (str_starts_with($u, 'https://upload.wikimedia.org/')
                || str_starts_with($u, 'https://thumb.wikimedia.org/'))) {
            return strtok($u, '?');
        }
    }
    return null;
}

$sql = "SELECT tj.id, j.nombre, t.anio_orden, c.nombre AS club
        FROM temporada_jugadores tj
        JOIN jugadores j ON j.id = tj.jugador_id
        JOIN temporadas t ON t.id = tj.temporada_id
        JOIN clubes c ON c.id = t.club_id
        WHERE tj.foto_epoca IS NULL
        ORDER BY t.anio_orden DESC, j.nombre";
if ($anio > 0) {
    $sql = "SELECT tj.id, j.nombre, t.anio_orden, c.nombre AS club
        FROM temporada_jugadores tj
        JOIN jugadores j ON j.id = tj.jugador_id
        JOIN temporadas t ON t.id = tj.temporada_id
        JOIN clubes c ON c.id = t.club_id
        WHERE tj.foto_epoca IS NULL AND t.anio_orden = " . $anio . "
        ORDER BY j.nombre";
}
if ($limit > 0) $sql .= " LIMIT " . $limit;
$filas = $pdo->query($sql)->fetchAll();
if ($soloNombre !== '') {
    $sn = norm($soloNombre);
    $filas = array_values(array_filter($filas, fn($f) => str_contains(norm($f['nombre']), $sn)));
}

$ok = 0;
$sin = 0;
foreach ($filas as $f) {
    $cand = buscar_epoca($f['nombre'], (int)$f['anio_orden'], $f['club'], $UA);
    $thumb = $cand ? thumb_de($cand['title'], $UA) : null;
    if ($cand && $thumb) {
        $ok++;
        echo "[EPOCA {$f['anio_orden']}] {$f['nombre']} ({$f['club']}) => {$thumb}\n";
        echo "        fuente: {$cand['title']} (foto {$cand['foto_anio']}, score {$cand['score']})\n";
        if ($apply) {
            $up = $pdo->prepare(
                "UPDATE temporada_jugadores SET foto_epoca = :url, foto_fuente = :fuente, foto_anio = :fanio
                 WHERE id = :id AND foto_epoca IS NULL"
            );
            $up->execute(['url' => $thumb, 'fuente' => $cand['title'], 'fanio' => $cand['foto_anio'], 'id' => $f['id']]);
        }
    } else {
        $sin++;
        echo "[---- {$f['anio_orden']}] {$f['nombre']} ({$f['club']})\n";
    }
    sleep(1); // cortesía con la API pública
}

echo "---\nRevisados: " . count($filas)
    . " · con foto de época: {$ok} · sin foto: {$sin}"
    . ($apply ? " (GUARDADAS)\n" : " (dry-run, sin --apply no se guarda nada)\n");
