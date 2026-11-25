-- ============================================================
-- 3A1 — Borrar "Rui Fernando" (no existe)
-- 19/11/2026
--
-- El dueño confirmó que este jugador no existe. Venía de la hoja vieja
-- "Jugadores Rivales" (San Lorenzo 1994/95 Clausura, LI, OVR 76) pero
-- no figura en la hoja corregida "Rivales A-Z" del Excel.
--
-- Seguro: solo borra la participación si no tiene partidas ni sanciones,
-- y solo borra el jugador si no le quedan participaciones.
-- Idempotente: se puede volver a ejecutar.
--
-- No toca schema.sql (no lo contiene) ni los .docx/.xlsx de fuente.
-- pool_completo.sql lo reinserta en instalaciones nuevas: aplicar esta
-- migración DESPUÉS de ese archivo.
-- ============================================================

USE `3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

SET @id := (SELECT id FROM jugadores WHERE BINARY nombre = 'Rui Fernando');

DELETE tj FROM temporada_jugadores tj
 WHERE @id IS NOT NULL
   AND tj.jugador_id = @id
   AND NOT EXISTS (SELECT 1 FROM partida_jugadores pj WHERE pj.temporada_jugador_id = tj.id)
   AND NOT EXISTS (SELECT 1 FROM sanciones s WHERE s.temporada_jugador_id = tj.id);

DELETE j FROM jugadores j
 WHERE @id IS NOT NULL
   AND j.id = @id
   AND NOT EXISTS (SELECT 1 FROM temporada_jugadores tj WHERE tj.jugador_id = j.id);

COMMIT;

-- Controles: deben dar 0 filas.
SELECT id, nombre FROM jugadores WHERE BINARY nombre IN ('Rui Fernando', 'rui Fernando');
SELECT COUNT(*) AS participaciones_huerfanas FROM temporada_jugadores tj
 LEFT JOIN jugadores j ON j.id = tj.jugador_id WHERE j.id IS NULL;
