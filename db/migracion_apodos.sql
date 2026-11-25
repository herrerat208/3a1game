-- ============================================================
-- 3A1 — Último apodo visible en el nombre del jugador
-- 19/11/2026
--
-- El resto de apodos ya los corrigió db/migracion_ortografia.sql
-- (Pepe Basualdo, Leo Díaz, rui Fernando). Quedaba este nombre con
-- apodo entre comillas, que la hoja "Rivales A-Z" del Excel del dueño
-- llama simplemente "Omar Gómez" (Quilmes 1978 Metro).
--
-- No hay otro jugador con ese nombre, así que no hace falta fusión.
-- El id de temporada_jugadores NO cambia: partida_jugadores,
-- sanciones y foto_epoca siguen apuntando a la misma participación.
-- ============================================================

USE `3a1`;
SET NAMES utf8mb4;

UPDATE jugadores SET nombre = 'Omar Gómez'
 WHERE BINARY nombre = 'Omar "Indio" Gómez';

-- Control: debe devolver 0 filas.
SELECT id, nombre FROM jugadores WHERE nombre LIKE '%"%' ORDER BY nombre;
