-- ============================================================
-- 3A1 — Belgrano 2026: "Agustín Maldonado" es Alexis Maldonado
-- Producción: `if0_43478740_3a1` — 2026-11-24
--
-- El backup y migracion_correcciones_v3.sql muestran que el jugador id 965
-- se llamaba "Agustín Maldonado" y fue corregido a "Alexis Maldonado".
-- En producción no se aplicó esa migración, por eso el UPDATE de foto del
-- SQL 08 (que busca "Alexis Maldonado") nunca encontró la fila.
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE jugadores SET nombre = 'Alexis Maldonado' WHERE nombre = 'Agustín Maldonado';

UPDATE temporada_jugadores
SET foto_epoca = '/jugadores/rivales/alexis-maldonado-belgrano.webp',
    foto_fuente = 'Alexis Maldonado-Belgrano.jfif',
    foto_anio = 2026
WHERE id = 1820;

COMMIT;
