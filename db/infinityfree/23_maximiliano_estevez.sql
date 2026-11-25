-- ============================================================
-- 3A1 — Racing 2001/02 Apertura: foto de Maximiliano Estévez
-- Producción: `if0_43478740_3a1` — 2026-11-24
--
-- El dueño cargó "Maximiliano Estevez-Racing.jfif" en la carpeta de fotos.
-- El SQL 08 no tenía UPDATE para este jugador, así que se agrega acá con el
-- mismo recorte estándar de 160px usado para todos los rivales.
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE temporada_jugadores tj
  JOIN jugadores j ON j.id = tj.jugador_id
SET tj.foto_epoca = '/jugadores/rivales/maximiliano-estevez-racing.webp',
    tj.foto_fuente = 'Maximiliano Estevez-Racing.jfif',
    tj.foto_anio = 2001
WHERE tj.id = 1484
  AND j.nombre = 'Maximiliano Estévez';

COMMIT;
