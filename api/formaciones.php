<?php
// 3A1 — Formaciones y estilos disponibles (el frontend los pide al iniciar).
// formaciones: las 10 elegibles. todas: mapa completo (para dibujar rivales).
require 'cors.php';
require '_slots.php';

$todas = formaciones_3a1();
$elegibles = [];
foreach (elegibles_3a1() as $nombre) {
    $elegibles[$nombre] = $todas[$nombre];
}

echo json_encode([
    'formaciones' => $elegibles,
    'todas' => $todas,
    'estilos' => estilos_3a1(),
], JSON_UNESCAPED_UNICODE);
