-- ============================================================
-- 3A1 — San Lorenzo 1974 Nacional: arquero corrido
-- Producción: `if0_43478740_3a1` — 2026-11-24
--
-- El dueño confirmó que "Anastasio Malaquías Asad" no existe y que el arquero
-- era Ricardo Anhielo. La foto del archivo Alfredo Anhielo-Sanlo.jfif ya está
-- publicada como /jugadores/rivales/alfredo-anhielo-san-lorenzo.webp.
-- Se reutiliza la participación (no se borra) para no perder una fila más.
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE jugadores SET nombre = 'Ricardo Anhielo' WHERE nombre = 'Anastasio Malaquías Asad';

UPDATE temporada_jugadores
SET foto_epoca = '/jugadores/rivales/alfredo-anhielo-san-lorenzo.webp',
    foto_fuente = 'Alfredo Anhielo-Sanlo.jfif',
    foto_anio = 1974
WHERE id = 1179;

COMMIT;
