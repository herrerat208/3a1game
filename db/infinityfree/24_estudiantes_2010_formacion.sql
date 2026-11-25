-- ============================================================
-- 3A1 — Estudiantes 2010/11 Apertura: formación 3-4-2-1
-- Producción: `if0_43478740_3a1` — 2026-11-24
--
-- El dueño corrigió la formación histórica (en la web figuraba 4-3-3).
-- La formación se agregó a api/_slots.php como histórica (no elegible) y a
-- src/game/pitch.js con coordenadas para dibujar al rival.
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE temporadas
SET formacion = '3-4-2-1'
WHERE etiqueta = 'Estudiantes 2010/11 Apertura'
  AND formacion = '4-3-3';

COMMIT;
