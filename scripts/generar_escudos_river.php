<?php
// 3A1 — Escudos de River por época (scripts/generar_escudos_river.php).
// Uso: php scripts/generar_escudos_river.php [--dir=RUTA] [--out=RUTA] [--assets=RUTA]
//   No conecta a la DB: copia los archivos a public/escudos/ y genera
//   db/escudos_river.sql para importar desde phpMyAdmin (o mysql < archivo).
//   Nombres tipo "River 1940 al 1946.png" / "River 2021 a Actualidad.avif".
//   "Actualidad" se resuelve al último año del pool (2026).
//   Los assets de public/escudos/ son WebP livianos (convertir_escudos_webp.py).
//   Después de regenerar, volver a ejecutar scripts/recortar_escudos.py.
//   Si dos rangos se solapan, gana el más reciente (ej.: 1995-2005 sobre
//   1994-1996 en 1995/1996).

$root = dirname(__DIR__);
$dir = dirname($root, 3) . '/Carpeta fotos 3a1/River/Escudos River';
$out = $root . '/db/escudos_river.sql';
$assets = $root . '/public/escudos';

foreach ($argv as $a) {
    if (str_starts_with($a, '--dir=')) $dir = substr($a, 6);
    if (str_starts_with($a, '--out=')) $out = substr($a, 6);
    if (str_starts_with($a, '--assets=')) $assets = substr($a, 9);
}

function norm(string $s): string {
    $de = 'áéíóúñüÁÉÍÓÚÑÜçÇàèêâôëöÀÈÊÂÔËÖ’‘';
    $a  = 'aeiounuAEIOUNUcCaeeaoeoAEEAOEO  ';
    $map = [];
    foreach (preg_split('//u', $de, -1, PREG_SPLIT_NO_EMPTY) as $k => $ch) {
        $map[$ch] = $a[$k];
    }
    $s = mb_strtolower(strtr($s, $map), 'UTF-8');
    $s = preg_replace('/[^a-z0-9]+/', ' ', $s);
    return trim(preg_replace('/\s+/', ' ', $s));
}

function slug(string $s): string {
    return trim(preg_replace('/[^a-z0-9]+/', '-', norm($s)), '-');
}

function sqlStr(string $s): string {
    return str_replace(['\\', "'"], ['\\\\', "\\'"], $s);
}

// Años de River que existen en db/pool_completo.sql.
$pool = @file_get_contents($root . '/db/pool_completo.sql');
if ($pool === false) {
    fwrite(STDERR, "No se pudo leer db/pool_completo.sql\n");
    exit(1);
}
$aniosRiver = [];
foreach (preg_split('/\R/u', $pool) as $line) {
    if (!preg_match('/SELECT c\.id, (\d{4}), \'[^\']+\'.*WHERE c\.nombre = \'River Plate\'/u', $line, $m)) continue;
    $aniosRiver[] = (int)$m[1];
}
$aniosRiver = array_values(array_unique($aniosRiver));
sort($aniosRiver);
if (!$aniosRiver) {
    fwrite(STDERR, "No se encontraron temporadas de River en el pool\n");
    exit(1);
}
$maxAnio = max($aniosRiver);

if (!is_dir($dir)) {
    fwrite(STDERR, "No se encontró la carpeta de escudos: {$dir}\n");
    exit(1);
}
if (!is_dir($assets)) mkdir($assets, 0755, true);

$entradas = [];
foreach (glob($dir . '/*') as $file) {
    if (!is_file($file)) continue;
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (!in_array($ext, ['png', 'webp', 'jpg', 'jpeg', 'avif', 'svg'], true)) continue;
    $base = pathinfo($file, PATHINFO_FILENAME);
    if (!preg_match('/^River\s+(\d{4})\s+(?:al|a)\s+(\d{4}|actualidad|actual|presente|hoy)\b/iu', $base, $m)) {
        fwrite(STDERR, "Nombre no reconocido (se salta): {$base}.{$ext}\n");
        continue;
    }
    $desde = (int)$m[1];
    $hastaRaw = mb_strtolower($m[2], 'UTF-8');
    $hasta = is_numeric($hastaRaw) ? (int)$hastaRaw : $maxAnio;
    $entradas[] = [
        'file' => $file, 'base' => $base, 'ext' => $ext,
        'desde' => $desde, 'hasta' => $hasta,
        'asset' => slug($base) . '.webp',
    ];
}
usort($entradas, fn($a, $b) => [$a['desde'], $a['hasta']] <=> [$b['desde'], $b['hasta']]);

// Un año → un escudo. Al recorrer en orden, el rango más reciente sobrescribe
// los años solapados de rangos anteriores.
$porAnio = [];
$porAsset = [];
$orden = [];
$copiados = 0;
foreach ($entradas as $e) {
    $dest = $assets . '/' . $e['asset'];
    if (!file_exists($dest) || md5_file($e['file']) !== md5_file($dest)) {
        copy($e['file'], $dest);
        $copiados++;
    }
    if (!isset($porAsset[$e['asset']])) {
        $porAsset[$e['asset']] = ['base' => $e['base'], 'anios' => []];
        $orden[] = $e['asset'];
    }
    foreach ($aniosRiver as $y) {
        if ($y < $e['desde'] || $y > $e['hasta']) continue;
        $anterior = $porAnio[$y] ?? null;
        if ($anterior && $anterior !== $e['asset']) {
            $porAsset[$anterior]['anios'] = array_values(array_diff($porAsset[$anterior]['anios'], [$y]));
        }
        $porAnio[$y] = $e['asset'];
        if (!in_array($y, $porAsset[$e['asset']]['anios'], true)) {
            $porAsset[$e['asset']]['anios'][] = $y;
        }
    }
}

$sql = "-- ============================================================\n"
     . "-- 3A1 — Escudos de River del dueño (generado por scripts/generar_escudos_river.php)\n"
     . "-- Las imágenes ya están en public/escudos/. Importar con la base 3a1 activa.\n"
     . "-- Rangos solapados: gana el más reciente (1995-2005 sobre 1994-1996).\n"
     . "-- 'Actualidad' = {$maxAnio} (último año del pool).\n"
     . "-- ============================================================\nUSE `3a1`;\n\n";

$updates = 0;
foreach ($orden as $asset) {
    $info = $porAsset[$asset];
    if (!$info['anios']) continue; // totalmente sobrescrito por un rango posterior
    $anios = $info['anios'];
    sort($anios);
    $sql .= "-- {$info['base']}" . (pathinfo($asset, PATHINFO_EXTENSION) ? '.' . pathinfo($asset, PATHINFO_EXTENSION) : '') . "\n"
         . "-- temporadas: " . count($anios) . (count($anios) === 1 ? ' año' : ' años')
         . " ({$anios[0]}-{$anios[count($anios) - 1]})\n"
         . "UPDATE temporadas t\n"
         . "JOIN clubes c ON c.id = t.club_id\n"
         . "SET t.escudo_epoca = '" . sqlStr('/escudos/' . $asset) . "'\n"
         . "WHERE c.nombre = 'River Plate'\n"
         . "  AND c.es_river = TRUE\n"
         . "  AND t.anio_orden IN (" . implode(', ', $anios) . ");\n\n";
    $updates++;
}

$actual = null;
foreach ($entradas as $e) {
    if (str_contains(norm($e['base']), 'actualidad')) $actual = $e['asset'];
}
if ($actual) {
    $sql .= "-- Escudo vigente de River (fallback de clubes.escudo)\n"
         . "UPDATE clubes SET escudo = '" . sqlStr('/escudos/' . $actual) . "'\n"
         . "WHERE nombre = 'River Plate' AND es_river = TRUE;\n\n";
}

$sinCubrir = array_values(array_diff($aniosRiver, array_keys($porAnio)));
if ($sinCubrir) {
    $sql .= "-- SIN ESCUDO (no hay archivo que cubra estos años): "
         . implode(', ', $sinCubrir) . "\n\n";
}

file_put_contents($out, $sql);

echo "Archivos de River procesados: " . count($entradas) . "\n";
echo "Archivos copiados/actualizados: {$copiados}\n";
echo "UPDATEs de escudo_epoca: {$updates}\n";
echo "Años de River cubiertos: " . count($porAnio) . "/" . count($aniosRiver) . "\n";
if ($sinCubrir) echo "Sin cubrir: " . implode(', ', $sinCubrir) . "\n";
if ($actual) echo "Escudo vigente: /escudos/{$actual}\n";
echo "SQL: {$out}\n";
