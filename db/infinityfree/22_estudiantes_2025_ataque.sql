-- ============================================================
-- 3A1 — Estudiantes 2025: mediocampo y ataque corridos
-- Producción: `if0_43478740_3a1` — 2026-11-24
--
-- Según el dueño:
--   Mediocampo: Piovi (MC), Ascacíbar (MD), Medina (MI) — ya estaban.
--   Ataque: Cetré (EI), Carrillo (DC), Tiago Palacios (ED).
-- Tomás Palacios no jugaba en Estudiantes; se quita su participación y se
-- incorpora la de Tiago con los mismos valores del SQL 08/2024 (OV 83).
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

-- El extremo era Cetré por izquierda, no por derecha.
UPDATE temporada_jugadores SET posicion_natural = 'EI' WHERE id = 1803;

-- Se saca la fila falsa solo si no tiene partidas ni sanciones.
DELETE tj FROM temporada_jugadores tj
 WHERE tj.id = 1805
   AND NOT EXISTS (SELECT 1 FROM partida_jugadores pj WHERE pj.temporada_jugador_id = tj.id)
   AND NOT EXISTS (SELECT 1 FROM sanciones s WHERE s.temporada_jugador_id = tj.id);

DELETE FROM jugadores
 WHERE nombre = 'Tomás Palacios'
   AND NOT EXISTS (SELECT 1 FROM temporada_jugadores tj WHERE tj.jugador_id = jugadores.id);

INSERT IGNORE INTO temporada_jugadores
  (temporada_id, jugador_id, posicion_natural, posiciones_secundarias, ovr_base,
   es_estrella, es_mvp, foto_epoca, foto_fuente, foto_anio)
SELECT t.id, j.id, 'ED', '', 83, FALSE, FALSE,
       '/jugadores/rivales/tiago-palacios-estudiantes.webp',
       'Tiago Palacios-Estudiantes.jpg', 2025
  FROM temporadas t
  JOIN jugadores j ON j.nombre = 'Tiago Palacios'
 WHERE t.etiqueta = 'Estudiantes 2025';

COMMIT;
