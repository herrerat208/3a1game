-- ============================================================
-- 3A1 — Complemento del lote 19: renombrar por nombre, no por id
-- Producción: `if0_43478740_3a1` — 2026-11-24
--
-- En la base viva el id del jugador no coincide con el del backup, así que
-- el UPDATE por id fue no-op. La foto ya quedó asignada a la participación
-- 1489; acá se corrige el nombre de la ficha. Idempotente.
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE jugadores
SET nombre = 'Hernán Franco'
WHERE BINARY nombre = 'Hernán Pellerano'
  AND (SELECT COUNT(*) FROM temporada_jugadores tj WHERE tj.jugador_id = jugadores.id) = 1;

COMMIT;
