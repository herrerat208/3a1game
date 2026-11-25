-- ============================================================
-- 3A1 — escudos locales a PNG en producción (base `if0_43478740_3a1`)
-- Ejecutar DESPUÉS de subir los 51 PNG a public/escudos/.
-- Idempotente: sólo toca rutas que todavía terminan en .webp. Las que ya
-- son .png (o apuntan a Commons) quedan intactas. No agrega SELECT porque
-- el helper de InfinityFree no tolera más de una consulta de lectura.
-- ============================================================
USE `if0_43478740_3a1`;

START TRANSACTION;

-- Escudo de época de cada temporada (River y rivales).
UPDATE temporadas
SET escudo_epoca = REPLACE(escudo_epoca, '.webp', '.png')
WHERE escudo_epoca LIKE '%.webp%';

-- Escudo vigente de cada club (fallback de clubes.escudo).
UPDATE clubes
SET escudo = REPLACE(escudo, '.webp', '.png')
WHERE escudo LIKE '%.webp%';

COMMIT;
