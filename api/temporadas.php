<?php
// 3A1 — Planteles disponibles (JOIN triple, consulta de control de la consigna).
require 'cors.php';
require 'conexion.php';

$sql = "SELECT t.id AS temporada_id, c.nombre AS club, c.es_river, c.escudo, t.escudo_epoca, t.anio_orden,
               t.etiqueta, t.formacion, t.ovr_equipo, t.campeon,
               tec.nombre AS tecnico
        FROM temporadas t
        JOIN clubes c ON c.id = t.club_id
        LEFT JOIN tecnicos tec ON tec.id = t.tecnico_id
        ORDER BY c.nombre, t.anio_orden";
$filas = $pdo->query($sql)->fetchAll();
foreach ($filas as &$f) {
    $f['campeon'] = (bool)$f['campeon'];
    $f['es_river'] = (bool)$f['es_river'];
}
unset($f);
echo json_encode($filas, JSON_UNESCAPED_UNICODE);
