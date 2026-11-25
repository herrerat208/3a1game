-- ============================================================
-- 3A1 — Escudos: rutas .png → .webp
-- Producción: `if0_43478740_3a1` — 2026-11-24
--
-- Los 51 escudos del dueño se convirtieron a WebP transparente y los PNG
-- se borraron de public/escudos/ y dist/escudos/. La base viva todavía
-- apuntaba a los archivos viejos. Solo cambia la extensión de las rutas
-- /escudos/; no toca ningún otro dato. Idempotente.
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE clubes
SET escudo = REPLACE(escudo, '.png', '.webp')
WHERE escudo LIKE '/escudos/%.png';

UPDATE temporadas
SET escudo_epoca = REPLACE(escudo_epoca, '.png', '.webp')
WHERE escudo_epoca LIKE '/escudos/%.png';

COMMIT;
