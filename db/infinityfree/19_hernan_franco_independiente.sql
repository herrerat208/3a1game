-- ============================================================
-- 3A1 — Independiente 2002/03 Apertura: Pellerano era Hernán Franco
-- Producción: `if0_43478740_3a1` — 2026-11-24
--
-- El dueño confirmó que los dos DFC eran Gabriel Milito y Hernán Franco.
-- El backup muestra que el jugador id 1295 se llamaba "Hernán Pellerano"
-- y migracion_correcciones_v3.sql ya lo renombraba a "Hernán Franco", pero
-- esa migración no se aplicó en producción (por eso el SQL 08 no le pudo
-- asignar la foto). Se reutiliza la participación id 1489, sin borrar filas.
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE jugadores SET nombre = 'Hernán Franco' WHERE id = 1295;

UPDATE temporada_jugadores
SET foto_epoca = '/jugadores/rivales/hernan-franco-independiente.webp',
    foto_fuente = 'Hernán Franco-Independiente.jfif',
    foto_anio = 2002
WHERE id = 1489;

COMMIT;
