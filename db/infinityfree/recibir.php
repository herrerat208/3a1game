<?php
// ============================================================
// 3A1 — HELPER TEMPORAL. Subir a htdocs/recibir.php, usar, BORRAR.
// Permite que el agente envíe por HTTP (en chunks pequeños) los
// archivos y los SQL, sin FTP y sin que el File Manager extraiga ZIP.
// Protegido por token. Solo escribe en jugadores/, escudos/, la raíz y los PHP
// de la API en la raíz (nunca config.php ni el propio helper).
// ============================================================
@set_time_limit(300);
@ini_set('memory_limit', '256M');
header('Content-Type: text/plain; charset=utf-8');

// Reemplazá este placeholder por un token largo y aleatorio ANTES de subir el
// helper. El mismo valor debe ir en A1_UPLOAD_TOKEN al correr subir_helper.mjs.
// Nunca publicar el token real en el repositorio.
const TOKEN = 'REEMPLAZAR_CON_TOKEN_LARGO_Y_ALEATORIO';
if (($_GET['token'] ?? '') !== TOKEN) {
    http_response_code(403);
    echo "Token inválido\n";
    exit;
}

$accion = $_GET['accion'] ?? 'info';
$tmpDir = __DIR__ . '/.tmp3a1';
$payload = $tmpDir . '/payload.bin';
$siguiente = $tmpDir . '/next';

function cuerpo() {
    $f = @fopen('php://input', 'rb');
    if (!$f) return '';
    $s = stream_get_contents($f);
    fclose($f);
    return $s === false ? '' : $s;
}

function rutaOk($p) {
    if ($p === '' || strpos($p, "\0") !== false || substr($p, 0, 1) === '/') return false;
    if (preg_match('#(^|/)\.\.?(/|$)#', $p)) return false;
    $permitidas = ['jugadores/', 'escudos/', 'index.html', 'favicon.png', 'favicon.svg', 'logo-3a1.webp'];
    foreach ($permitidas as $pre) {
        if ($p === $pre || (substr($pre, -1) === '/' && strpos($p, $pre) === 0)) return true;
    }
    // La API de producción vive en la raíz (fetch('/temporadas.php', ...)).
    // Subimos todos los .php de api/ salvo config.php (credenciales del host)
    // y recibir.php (este helper, que se borra al final).
    if (preg_match('#^[A-Za-z0-9_-]+\.php$#', $p)
        && !in_array($p, ['config.php', 'recibir.php'], true)) return true;
    return false;
}

function linea($f) {
    $s = fgets($f);
    if ($s === false) return false;
    return rtrim($s, "\r\n");
}

function contarArchivos($dir) {
    if (!is_dir($dir)) return 0;
    $n = 0;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) if ($f->isFile()) $n++;
    return $n;
}

function conectar() {
    $config = __DIR__ . '/config.php';
    if (!is_file($config)) throw new Exception('Falta config.php');
    $host = 'localhost'; $db = '3a1'; $user = 'root'; $pass = '';
    require $config;
    return new PDO(
        "mysql:host=$host;dbname=$db;charset=utf8mb4",
        $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
}

function dividirSql($sql) {
    $stmts = [];
    $buf = '';
    $n = strlen($sql);
    $i = 0;
    $comilla = null;
    $lineaComentario = false;
    $bloqueComentario = false;
    while ($i < $n) {
        $ch = $sql[$i];
        $nx = $i + 1 < $n ? $sql[$i + 1] : '';
        if ($lineaComentario) {
            $buf .= $ch;
            if ($ch === "\n") $lineaComentario = false;
            $i++;
            continue;
        }
        if ($bloqueComentario) {
            if ($ch === '*' && $nx === '/') {
                $buf .= '*/';
                $i += 2;
                $bloqueComentario = false;
            } else {
                $buf .= $ch;
                $i++;
            }
            continue;
        }
        if ($comilla !== null) {
            if ($ch === '\\' && $i + 1 < $n) {
                $buf .= $ch . $sql[$i + 1];
                $i += 2;
                continue;
            }
            if ($ch === $comilla) {
                if ($nx === $comilla) {
                    $buf .= $comilla . $comilla;
                    $i += 2;
                    continue;
                }
                $comilla = null;
            }
            $buf .= $ch;
            $i++;
            continue;
        }
        if ($ch === "'" || $ch === '"' || $ch === '`') {
            $comilla = $ch;
            $buf .= $ch;
            $i++;
            continue;
        }
        if ($ch === '-' && $nx === '-') {
            $lineaComentario = true;
            $buf .= $ch;
            $i++;
            continue;
        }
        if ($ch === '/' && $nx === '*') {
            $bloqueComentario = true;
            $buf .= $ch;
            $i++;
            continue;
        }
        if ($ch === ';') {
            $s = trim($buf);
            if ($s !== '') $stmts[] = $s;
            $buf = '';
            $i++;
            continue;
        }
        $buf .= $ch;
        $i++;
    }
    $s = trim($buf);
    if ($s !== '') $stmts[] = $s;
    return $stmts;
}

switch ($accion) {
    case 'info':
        echo "PHP: " . PHP_VERSION . "\n";
        echo "post_max_size: " . ini_get('post_max_size') . "\n";
        echo "upload_max_filesize: " . ini_get('upload_max_filesize') . "\n";
        echo "memory_limit: " . ini_get('memory_limit') . "\n";
        echo "ZipArchive: " . (class_exists('ZipArchive') ? 'SI' : 'NO') . "\n";
        echo "htdocs escribible: " . (is_writable(__DIR__) ? 'SI' : 'NO') . "\n";
        echo "config.php: " . (is_file(__DIR__ . '/config.php') ? 'SI' : 'NO') . "\n";
        echo "payload: " . (is_file($payload) ? filesize($payload) . ' bytes' : 'NO') . "\n";
        echo "jugadores/: " . contarArchivos(__DIR__ . '/jugadores') . " archivos\n";
        echo "escudos/: " . contarArchivos(__DIR__ . '/escudos') . " archivos\n";
        try {
            $pdo = conectar();
            echo "DB: OK\n";
            echo "jugadores: " . $pdo->query('SELECT COUNT(*) FROM jugadores')->fetchColumn() . "\n";
        } catch (Exception $e) {
            echo "DB: ERROR " . $e->getMessage() . "\n";
        }
        break;

    case 'reset':
        if (!is_dir($tmpDir)) @mkdir($tmpDir, 0755, true);
        @unlink($payload);
        @unlink($siguiente);
        echo (is_file($payload) ? 'ERROR no se pudo borrar payload' : 'OK') . "\n";
        break;

    case 'chunk':
        $idx = isset($_GET['idx']) ? (int)$_GET['idx'] : -1;
        if ($idx < 0) { echo "ERROR idx\n"; break; }
        if (!is_dir($tmpDir)) @mkdir($tmpDir, 0755, true);
        $esperado = is_file($siguiente) ? (int)trim(file_get_contents($siguiente)) : 0;
        if ($idx !== $esperado && empty($_GET['force'])) {
            echo "ERROR esperaba idx=$esperado, recibi $idx\n";
            break;
        }
        $cuerpo = cuerpo();
        if ($cuerpo === '') { echo "ERROR cuerpo vacío\n"; break; }
        if (file_put_contents($payload, $cuerpo, FILE_APPEND) === false) {
            echo "ERROR escribiendo payload\n";
            break;
        }
        file_put_contents($siguiente, (string)($idx + 1));
        echo "OK idx=$idx chunk=" . strlen($cuerpo) . " total=" . filesize($payload) . "\n";
        break;

    case 'apply':
        if (!is_file($payload)) { echo "ERROR falta payload\n"; break; }
        $f = fopen($payload, 'rb');
        if (!$f) { echo "ERROR abriendo payload\n"; break; }
        $escritos = 0;
        $errores = [];
        $salteados = 0;
        while (!feof($f)) {
            $ruta = linea($f);
            if ($ruta === false) break;
            if ($ruta === '') continue;
            $tamLinea = linea($f);
            if ($tamLinea === false) { $errores[] = 'fin inesperado tras ' . $ruta; break; }
            $tam = (int)$tamLinea;
            if ($tam < 0 || $tam > 200 * 1024 * 1024) {
                $errores[] = 'tamaño inválido: ' . $ruta;
                break;
            }
            if (!rutaOk($ruta)) {
                $errores[] = 'ruta no permitida: ' . $ruta;
                $salteados += $tam;
                if ($tam > 0) fseek($f, $tam, SEEK_CUR);
                continue;
            }
            $datos = '';
            $resto = $tam;
            while ($resto > 0 && !feof($f)) {
                $parte = fread($f, min($resto, 1 << 20));
                if ($parte === false || $parte === '') break;
                $datos .= $parte;
                $resto -= strlen($parte);
            }
            if ($resto !== 0) {
                $errores[] = 'datos incompletos: ' . $ruta;
                break;
            }
            $destino = __DIR__ . '/' . $ruta;
            $carpeta = dirname($destino);
            if (!is_dir($carpeta) && !@mkdir($carpeta, 0755, true)) {
                $errores[] = 'no se pudo crear carpeta: ' . $carpeta;
                continue;
            }
            if (@file_put_contents($destino, $datos) === false) {
                $errores[] = 'no se pudo escribir: ' . $ruta;
                continue;
            }
            $escritos++;
            unset($datos);
        }
        fclose($f);
        echo "escritos: $escritos\n";
        echo "errores: " . count($errores) . "\n";
        foreach (array_slice($errores, 0, 10) as $e) echo "  $e\n";
        echo "jugadores/: " . contarArchivos(__DIR__ . '/jugadores') . " archivos\n";
        echo "jugadores/rivales/: " . contarArchivos(__DIR__ . '/jugadores/rivales') . " archivos\n";
        echo "escudos/: " . contarArchivos(__DIR__ . '/escudos') . " archivos\n";
        echo "index.html: " . (is_file(__DIR__ . '/index.html') ? filesize(__DIR__ . '/index.html') . ' bytes' : 'FALTA') . "\n";
        break;

    case 'sql':
        $sql = cuerpo();
        if (trim($sql) === '') { echo "ERROR SQL vacío\n"; break; }
        $stmts = dividirSql($sql);
        echo "sentencias: " . count($stmts) . "\n";
        try {
            $pdo = conectar();
            $ok = 0;
            foreach ($stmts as $i => $s) {
                try {
                    $pdo->exec($s);
                    $ok++;
                } catch (Exception $e) {
                    echo "ERROR en sentencia " . ($i + 1) . ": " . $e->getMessage() . "\n";
                    echo "  " . substr(str_replace("\n", ' ', $s), 0, 160) . "\n";
                    break;
                }
            }
            echo "ejecutadas: $ok\n";
        } catch (Exception $e) {
            echo "ERROR conexión: " . $e->getMessage() . "\n";
        }
        break;

    case 'verificar':
        echo "-- archivos --\n";
        foreach ([
            'jugadores/abel-vieitez.webp',
            'jugadores/rivales/carlos-ereros-argentinos-juniors.webp',
            'escudos/river-2021-a-actualidad.webp',
            'index.html',
            'asignar_dorsales.php',
        ] as $r) {
            $p = __DIR__ . '/' . $r;
            echo "  $r: " . (is_file($p) ? filesize($p) . ' bytes' : 'FALTA') . "\n";
        }
        echo "  total jugadores: " . contarArchivos(__DIR__ . '/jugadores') . "\n";
        echo "  total rivales: " . contarArchivos(__DIR__ . '/jugadores/rivales') . "\n";
        echo "  total escudos: " . contarArchivos(__DIR__ . '/escudos') . "\n";
        echo "-- base --\n";
        try {
            $pdo = conectar();
            echo "  foto_epoca rivales: " . $pdo->query("SELECT COUNT(*) FROM temporada_jugadores WHERE foto_epoca LIKE '/jugadores/rivales/%'")->fetchColumn() . "\n";
            echo "  escudos temporada: " . $pdo->query("SELECT COUNT(*) FROM temporadas WHERE escudo_epoca LIKE '/escudos/%'")->fetchColumn() . "\n";
            $tabla = $pdo->query("SHOW TABLES LIKE 'reparaciones_localia_v2'")->fetchColumn();
            echo "  reparaciones_localia_v2: " . ($tabla ? 'SI' : 'NO') . "\n";
            if ($tabla) echo "  partidos reparados: " . $pdo->query('SELECT COUNT(*) FROM reparaciones_localia_v2')->fetchColumn() . "\n";
        } catch (Exception $e) {
            echo "  ERROR: " . $e->getMessage() . "\n";
        }
        break;

    case 'borrar':
        @unlink($payload);
        @unlink($siguiente);
        @rmdir($tmpDir);
        echo (unlink(__FILE__) ? "BORRADO recibir.php\n" : "ERROR no se pudo borrar recibir.php\n");
        break;

    default:
        echo "Acciones: info | reset | chunk | apply | sql | verificar | borrar\n";
}
