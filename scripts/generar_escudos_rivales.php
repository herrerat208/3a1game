<?php
// 3A1 — Escudos rivales aportados por el dueño (scripts/generar_escudos_rivales.php).
// Uso: php scripts/generar_escudos_rivales.php [--dir=RUTA] [--out=RUTA] [--assets=RUTA]
//   No conecta a la DB: copia los archivos a public/escudos/ y genera
//   db/escudos_rivales.sql para importar desde phpMyAdmin (o mysql < archivo).
//   Los nombres traen club + año(s); se respeta el año de anio_orden de la DB.
//   Si hay dos años, se interpreta como rango inclusive (1973-1986 cubre 1980).
//   Si hay tres o más, se toman como años explícitos (Boca 1962-1964-1969...).
//   Los assets de public/escudos/ son WebP livianos (convertir_escudos_webp.py).
//   Después de regenerar, volver a ejecutar scripts/recortar_escudos.py.

$root = dirname(__DIR__);
$dir = dirname($root, 3) . '/Carpeta fotos 3a1/Rivales/Escudos Rivales';
$out = $root . '/db/escudos_rivales.sql';
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

// Catálogo real de temporadas (mismo INSERT que db/pool_completo.sql).
$pool = @file_get_contents($root . '/db/pool_completo.sql');
if ($pool === false) {
    fwrite(STDERR, "No se pudo leer db/pool_completo.sql\n");
    exit(1);
}
$temporadas = [];
$clubesNorm = [];
foreach (preg_split('/\R/u', $pool) as $line) {
    if (!preg_match('/SELECT c\.id, (\d{4}), \'([^\']+)\'.*WHERE c\.nombre = \'([^\']+)\'/u', $line, $m)) continue;
    $club = $m[3];
    $temporadas[$club][(int)$m[1]] = $m[2];
    $clubesNorm[norm($club)] = $club;
}

$alias = [
    'arsenal de sarandi' => 'Arsenal',
    'newells' => 'Newell’s',
    'velez' => 'Vélez',
];

// Ajustes confirmados por el dueño (el año del archivo no coincide con el
// anio_orden de la temporada donde debe usarse). San Lorenzo 2001/02 no existe
// en el pool: el escudo se aplica a 2000/01, que es la temporada que sí está.
$aniosExtra = [
    'velez-2021' => [2024],
    'san-lorenzo-2001-2002' => [2000],
];

if (!is_dir($dir)) {
    fwrite(STDERR, "No se encontró la carpeta de escudos: {$dir}\n");
    exit(1);
}
if (!is_dir($assets)) mkdir($assets, 0755, true);

$archivos = [];
foreach (glob($dir . '/*') as $file) {
    if (!is_file($file)) continue;
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (!in_array($ext, ['png', 'webp', 'jpg', 'jpeg', 'avif', 'svg'], true)) continue;
    $archivos[] = $file;
}
sort($archivos, SORT_STRING | SORT_FLAG_CASE);

$sql = "-- ============================================================\n"
     . "-- 3A1 — Escudos rivales del dueño (generado por scripts/generar_escudos_rivales.php)\n"
     . "-- Las imágenes ya están en public/escudos/. Importar con la base 3a1 activa.\n"
     . "-- Reemplaza escudo_epoca de Commons por el archivo local aportado por el dueño.\n"
     . "-- ============================================================\nUSE `3a1`;\n\n";

$ok = 0;
$sinTemporada = [];
$sinClub = [];
$copiados = 0;

foreach ($archivos as $file) {
    $base = pathinfo($file, PATHINFO_FILENAME);
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));

    if (!preg_match_all('/(?<!\d)(\d{2}|\d{4})(?!\d)/', $base, $ym, PREG_OFFSET_CAPTURE)) {
        $sinTemporada[] = "{$base}.{$ext} (sin años en el nombre)";
        continue;
    }
    $clubRaw = trim(substr($base, 0, $ym[0][0][1]));
    $anios = [];
    foreach ($ym[0] as $token) {
        $y = (int)$token[0];
        if ($y < 100) {
            $anterior = end($anios);
            $y = ($anterior ? intdiv($anterior, 100) * 100 : 1900) + $y;
        }
        $anios[] = $y;
    }
    $anios = array_values(array_unique($anios));
    if (count($anios) === 2 && $anios[1] > $anios[0]) {
        $anios = range($anios[0], $anios[1]); // rango: 1973-1986 incluye 1980
    }
    $anios = array_values(array_unique(array_merge($anios, $aniosExtra[slug($base)] ?? [])));

    $clubNorm = norm($clubRaw);
    $club = $alias[$clubNorm] ?? ($clubesNorm[$clubNorm] ?? null);
    if ($club === null) {
        $sinClub[] = "{$base}.{$ext} (club '{$clubRaw}' no reconocido)";
        continue;
    }

    $asset = slug($base) . '.webp';
    $dest = $assets . '/' . $asset;
    if (!file_exists($dest) || md5_file($file) !== md5_file($dest)) {
        copy($file, $dest);
        $copiados++;
    }

    $disponibles = $temporadas[$club] ?? [];
    $aniosDB = array_values(array_filter($anios, fn($y) => isset($disponibles[$y])));
    if (!$aniosDB) {
        $sinTemporada[] = "{$base}.{$ext} → {$club}, años " . implode(', ', $anios);
        continue;
    }

    $url = '/escudos/' . $asset;
    $etiquetas = array_map(fn($y) => $disponibles[$y], $aniosDB);
    $sql .= "-- {$base}.{$ext}\n"
         . "-- temporadas: " . implode('; ', $etiquetas) . "\n"
         . "UPDATE temporadas t\n"
         . "JOIN clubes c ON c.id = t.club_id\n"
         . "SET t.escudo_epoca = '" . sqlStr($url) . "'\n"
         . "WHERE c.nombre = '" . sqlStr($club) . "'\n"
         . "  AND c.es_river = FALSE\n"
         . "  AND t.anio_orden IN (" . implode(', ', $aniosDB) . ");\n\n";
    $ok++;
}

if ($sinTemporada) {
    $sql .= "-- SIN TEMPORADA EN LA DB (no se aplica; el archivo quedó copiado):\n";
    foreach ($sinTemporada as $aviso) $sql .= "--   {$aviso}\n";
    $sql .= "\n";
}
if ($sinClub) {
    $sql .= "-- CLUB NO RECONOCIDO (no se aplica):\n";
    foreach ($sinClub as $aviso) $sql .= "--   {$aviso}\n";
    $sql .= "\n";
}

file_put_contents($out, $sql);

echo "Escudos procesados: " . count($archivos) . "\n";
echo "Archivos copiados/actualizados en public/escudos: {$copiados}\n";
echo "UPDATEs generados: {$ok}\n";
echo "Sin temporada: " . count($sinTemporada) . "\n";
foreach ($sinTemporada as $aviso) echo "  - {$aviso}\n";
if ($sinClub) {
    echo "Sin club: " . count($sinClub) . "\n";
    foreach ($sinClub as $aviso) echo "  - {$aviso}\n";
}
echo "SQL: {$out}\n";
