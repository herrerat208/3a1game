<?php
// TEMPORAL: subir a htdocs/diagnostico.php, abrir en el navegador y BORRARLO después.
// Nunca muestra la contraseña, solo si está cargada.
header('Content-Type: text/plain; charset=utf-8');

$config = __DIR__ . '/config.php';
echo "config.php existe: " . (is_file($config) ? 'SI' : 'NO') . "\n";

$host = 'localhost';
$db   = '3a1';
$user = 'root';
$pass = '';
if (is_file($config)) {
    require $config;
    echo "config.php cargado: SI\n";
}

echo "host: $host\n";
echo "db:   $db\n";
echo "user: $user\n";
echo "pass: " . ($pass === '' ? 'VACIA' : 'cargada (' . strlen($pass) . ' caracteres)') . "\n\n";

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$db;charset=utf8mb4",
        $user,
        $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    echo "CONEXION: OK\n";
    echo "jugadores: " . $pdo->query('SELECT COUNT(*) FROM jugadores')->fetchColumn() . "\n";
    echo "temporadas: " . $pdo->query('SELECT COUNT(*) FROM temporadas')->fetchColumn() . "\n";
    echo "participaciones: " . $pdo->query('SELECT COUNT(*) FROM temporada_jugadores')->fetchColumn() . "\n\n";

    echo "-- Basualdo (deben ser solo Fabián y José) --\n";
    foreach ($pdo->query("SELECT id, nombre FROM jugadores WHERE nombre LIKE '%Basualdo%' ORDER BY nombre") as $r) {
        echo "  {$r['id']}  {$r['nombre']}\n";
    }

    echo "-- Otros duplicados (debe haber UNO de cada) --\n";
    foreach (['Brian Romero', 'Braian Romero', 'Hugo Gatti', 'Hugo Orlando Gatti', 'Jonatan Cristaldo', 'Jonathan Cristaldo'] as $n) {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM jugadores WHERE nombre = :n');
        $stmt->execute([':n' => $n]);
        echo "  $n: " . $stmt->fetchColumn() . "\n";
    }

    echo "-- Nombres a corregir que quedan (debe ser 0) --\n";
    $sql = "SELECT COUNT(*) FROM jugadores WHERE BINARY nombre REGEXP BINARY
      '(^| )(Adrian|Agustin|Angel|Damian|Fabian|Matias|Sebastian|Victor|Maria|Roman|Rolan|Husain|Orion|Nandez|Miguel Angel|Jose Maria|Juan Roman|rui|Brian Romero|Jonathan Cristaldo|Pepe Basualdo)( |$)'";
    echo '  ' . $pdo->query($sql)->fetchColumn() . "\n";
} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
