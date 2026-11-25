-- ============================================================
-- 3A1 — Newell’s 2004/05 Apertura: el delantero era Ignacio Scocco
-- Producción: `if0_43478740_3a1` — 2026-11-24
--
-- El dueño confirmó que Jairo Castillo no integraba ese plantel y que el
-- delantero era Ignacio Scocco, que ya figuraba como ED con foto cargada
-- (/jugadores/rivales/ignacio-scocco-newells.webp). Se conserva la ficha real
-- y se le asigna el puesto DC; la fila falsa se borra solo si no tiene
-- partidas ni sanciones. Idempotente.
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE temporada_jugadores SET posicion_natural = 'DC' WHERE id = 1517;

DELETE tj FROM temporada_jugadores tj
 WHERE tj.id = 1518
   AND NOT EXISTS (SELECT 1 FROM partida_jugadores pj WHERE pj.temporada_jugador_id = tj.id)
   AND NOT EXISTS (SELECT 1 FROM sanciones s WHERE s.temporada_jugador_id = tj.id);

DELETE FROM jugadores
 WHERE nombre = 'Jairo Castillo'
   AND NOT EXISTS (SELECT 1 FROM temporada_jugadores tj WHERE tj.jugador_id = jugadores.id);

COMMIT;
