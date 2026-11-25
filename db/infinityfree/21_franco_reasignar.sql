-- ============================================================
-- 3A1 — Independiente 2002/03 Apertura: reasignar ficha del DFC
-- Producción: `if0_43478740_3a1` — 2026-11-24
--
-- Los UPDATE por id y por nombre anteriores no encontraron la fila en la
-- base viva. Esta corrección actúa directamente sobre la participación 1489:
-- crea/usa la ficha "Hernán Franco" y le aplica su foto. La ficha vieja se
-- borra solo si se quedó sin participaciones. Idempotente.
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

INSERT IGNORE INTO jugadores (nombre) VALUES ('Hernán Franco');

UPDATE temporada_jugadores
SET jugador_id = (SELECT id FROM jugadores WHERE nombre = 'Hernán Franco' LIMIT 1),
    foto_epoca = '/jugadores/rivales/hernan-franco-independiente.webp',
    foto_fuente = 'Hernán Franco-Independiente.jfif',
    foto_anio = 2002
WHERE id = 1489;

DELETE FROM jugadores
WHERE BINARY nombre = 'Hernán Pellerano'
  AND NOT EXISTS (SELECT 1 FROM temporada_jugadores tj WHERE tj.jugador_id = jugadores.id);

COMMIT;
