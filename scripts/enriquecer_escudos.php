<?php
// 3A1 — Escudo ACTUAL por club (scripts/enriquecer_escudos.php).
// Uso: php scripts/enriquecer_escudos.php [--apply] [--limit=N]
//   Sin --apply es dry-run. Respeta escudo IS NULL.
// Commons (sin key), reglas estrictas: el título debe traer TODOS los
// tokens distintivos del club + palabra de escudo (escudo/logo/crest/
// insignia/badge). River Plate = SOLO Argentina (exige 'atletico';
// Montevideo/Asunción/Uruguay se descartan). Nada de PageImages sin
// verificar (así entró un cocodrilo en Boca).
// Solo se guardan archivos de Wikimedia (svg/png/jpg).
$_SERVER['REQUEST_METHOD'] = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
require __DIR__ . '/../api/conexion.php';

$apply = in_array('--apply', $argv, true);
$limit = 0;
$soloClub = '';
foreach ($argv as $a) {
    if (str_starts_with($a, '--limit=')) $limit = max(0, (int)substr($a, 8));
    if (str_starts_with($a, '--club=')) $soloClub = substr($a, 7);
}

$UA = '3A1-draft/1.0 (proyecto escolar; contacto local)';

// Lista blanca verificada a mano (File: en Commons). Nada automático para
// clubes: los homónimos (Arsenal inglés/Viale, Belgrano rugby, River de
// Uruguay/Paraguay, Huracán Las Heras) ya metieron basura una vez.
// Platense queda NULL a propósito (sin archivo fiable).
function mapa_escudos(): array {
    return [
        'River Plate' => 'File:Club Atlético River Plate logo.svg',
        'Argentinos Juniors' => 'File:Asociación Atlética Argentinos Juniors logo.svg',
        'Arsenal' => 'File:Arsenal de Sarandí.png',
        'Banfield' => 'File:Escudo del Club Banfield dos estrellas.png',
        'Belgrano' => 'File:Escudo del Club Atlético Belgrano.svg',
        'Boca' => 'File:Escudo del Club Atlético Boca Juniors 2012.svg',
        'Chacarita' => 'File:Escudo del Club Atlético Chacarita Juniors.svg',
        'Estudiantes' => 'File:Escudo del Club Estudiantes de La Plata.svg',
        'Ferro' => 'File:Escudo del Club Ferro Carril Oeste.svg',
        'Independiente' => 'File:Escudo del Club Atlético Independiente de Avellaneda.svg',
        'Quilmes' => 'File:Escudo de Quilmes Atlético Club.svg',
        'Racing' => 'File:Escudo del Racing Club de Avellaneda.svg',
        'Rosario Central' => 'File:Escudo del Club Atlético Rosario Central.svg',
        'San Lorenzo' => 'File:Escudo del Club Atlético San Lorenzo de Almagro.svg',
        'Huracán' => 'File:Escudo del Club Atlético Huracán.svg',
        'Lanús' => 'File:Escudo del CA Lanús (con 7 estrellas blancas).png',
        'Newell’s' => "File:Newell's Old Boys Escudo.png",
        'Vélez' => 'File:Escudo del Club Atlético Vélez Sarsfield.svg',
    ];
}

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

function norm(string $s): string {
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
    $s = strtr($s, $map);
    return trim(preg_replace('/[^a-z0-9 ]+/', ' ', $s));
}

function buscar_escudo(string $club, string $ua): ?array {
    $nc = norm($club);
    $toks = array_values(array_filter(preg_split('/\s+/', $nc),
        fn($t) => mb_strlen($t) > 2));
    // River Plate argentino: exigir 'atletico' (descarta Montevideo/Asunción).
    $soloArg = ($nc === 'river plate');
    $vistos = [];
    $cands = [];
    foreach (["{$nc} escudo", "{$nc} escudo svg", "{$nc} crest", "{$nc} logo"] as $sr) {
        $res = commons_get([
            'action' => 'query', 'list' => 'search',
            'srsearch' => $sr, 'srnamespace' => 6, 'srlimit' => 20,
        ], $ua);
        if (!$res) continue;
        foreach (($res['query']['search'] ?? []) as $hit) {
            $title = $hit['title'] ?? '';
            if (!preg_match('/\.(svg|png|jpe?g)$/i', $title)) continue;
            $nt = norm($title);
            $ok = true;
            foreach ($toks as $t) {
                if (!str_contains($nt, $t)) { $ok = false; break; }
            }
            if (!$ok) continue;
            if (!preg_match('/escudo|logo|crest|insignia|badge/', $nt)) continue;
            if ($soloArg && !str_contains($nt, 'atletico')) continue;
            // Descarta otros países con el mismo nombre.
            if (preg_match('/montevideo|asuncion|uru\b|paraguay|ecuador|peru|uruguay/', $nt)) continue;
            // Descarta homónimos locales conocidos (Arsenal de Viale ≠ Sarandí).
            if (preg_match('/\bviale\b|\bolta\b|\bboceto\b|\bborrador\b|propuesta|proposal|draft\b/', $nt)) continue;
            // Descarta fan-art y otros clubes homónimos.
            if (preg_match('/las heras|paint|sai\b|athletic club|mural|barrio|figurita|chaco/', $nt)) continue;
            $cands[] = $title;
        }
        usleep(300000);
    }
    if (!$cands) return null;
    // Vigente primero: sin años en el título (el logo actual, no uno viejo).
    usort($cands, fn($a, $b) =>
        preg_match('/\b(19|20)\d{2}\b/', norm($a)) - preg_match('/\b(19|20)\d{2}\b/', norm($b)));
    return ['title' => $cands[0]];
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

$sql = "SELECT id, nombre FROM clubes WHERE escudo IS NULL ORDER BY id";
if ($limit > 0) $sql .= " LIMIT " . $limit;
$nombres = $pdo->query($sql)->fetchAll();
if ($soloClub !== '') {
    $sc = norm($soloClub);
    $nombres = array_values(array_filter($nombres,
        fn($f) => str_contains(norm($f['nombre']), $sc)));
}

$ok = 0;
$sin = 0;
$mapa = mapa_escudos();
foreach ($nombres as $fila) {
    $nombre = $fila['nombre'];
    $forzado = $mapa[$nombre] ?? null;
    if ($forzado) usleep(500000); // cortesía también en vía directa
    $thumb = $forzado ? thumb_de($forzado, $UA) : null;
    $fuente = $forzado;
    if (!$thumb) {
        // Sin entrada verificada: búsqueda estricta como respaldo.
        $cand = buscar_escudo($nombre, $UA);
        $thumb = $cand ? thumb_de($cand['title'], $UA) : null;
        $fuente = $cand['title'] ?? null;
    }
    if ($fuente && $thumb) {
        $ok++;
        echo "[ESCUDO] {$nombre} => {$thumb}\n";
        echo "        fuente: {$fuente}\n";
        if ($apply) {
            $up = $pdo->prepare(
                "UPDATE clubes SET escudo = :url WHERE id = :id AND escudo IS NULL"
            );
            $up->execute(['url' => $thumb, 'id' => $fila['id']]);
        }
    } else {
        $sin++;
        echo "[----] {$nombre} (sin escudo verificable)\n";
    }
    sleep(1); // cortesía con la API pública
}

echo "---\nRevisados: " . count($nombres)
    . " · con escudo: {$ok} · sin escudo: {$sin}"
    . ($apply ? " (GUARDADOS)\n" : " (dry-run, sin --apply no se guarda nada)\n");
