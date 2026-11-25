-- ============================================================
-- 3A1 — Argentinos Juniors 2009/10 Clausura: foto de Luis Ojeda
-- Producción: `if0_43478740_3a1` — 2026-11-24
--
-- El dueño agregó "Luis Ojeda-Argentinos.jfif" a la carpeta. El SQL 08 no
-- tenía UPDATE para este jugador; se aplica el mismo recorte estándar.
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE temporada_jugadores tj
  JOIN jugadores j ON j.id = tj.jugador_id
SET tj.foto_epoca = '/jugadores/rivales/luis-ojeda-argentinos-juniors.webp',
    tj.foto_fuente = 'Luis Ojeda-Argentinos.jfif',
    tj.foto_anio = 2009
WHERE tj.id = 1608
  AND j.nombre = 'Luis Ojeda';

COMMIT;
