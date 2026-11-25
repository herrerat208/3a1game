<?php
// 3A1 — Estadísticas (JOIN + COUNT/AVG + GROUP BY + HAVING, pide la consigna).
require 'cors.php';
require 'conexion.php';
require_once 'ovr.php';

$sql = "SELECT c.nombre AS club,
               COUNT(tj.id) AS cantidad_jugadores,
               ROUND(AVG(" . ovr_final_expr() . "), 1) AS promedio_ovr
        FROM clubes c
        JOIN temporadas t ON t.club_id = c.id
        JOIN temporada_jugadores tj ON tj.temporada_id = t.id
        GROUP BY c.id, c.nombre
        HAVING COUNT(tj.id) > 0
        ORDER BY promedio_ovr DESC";

$datos = $pdo->query($sql)->fetchAll();
echo json_encode($datos, JSON_UNESCAPED_UNICODE);
