<?php
// 3A1 — Lista de clubes (equivale a selecciones.php de la consigna).
require 'cors.php';
require 'conexion.php';

$sql = "SELECT id, nombre, es_river, escudo FROM clubes ORDER BY nombre";
$filas = $pdo->query($sql)->fetchAll();
foreach ($filas as &$f) {
    $f['es_river'] = (bool)$f['es_river'];
}
unset($f);
echo json_encode($filas, JSON_UNESCAPED_UNICODE);
