-- ============================================================
-- 3A1 — Correcciones de nombres/fotos informadas por el dueño
-- Producción: `if0_43478740_3a1`
--
-- Verificado en vivo antes de escribir (2026-11-24):
--   Vélez 2012/13: 1669 Alejandro Cabral (con foto), 1670 Ariel Cabral (sin foto)
--   Vélez 2004/05: 1522 "Pellegrino" (sin foto)
--   Vélez 1997/98: 1438 "Éber Banega" (sin foto), 1435 Mauricio Pellegrino (con foto)
--   San Lorenzo 2006/07: 1558 "Rivero" (sin foto)
--
-- No se borra ninguna participación: las cuatro temporadas tienen 11 jugadores
-- y el draft necesita ese plantel completo. Solo se corrige el jugador al que
-- apunta cada fila y se le asigna una foto que ya existe en public/jugadores/.
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

-- 1) Ariel Cabral es "Alejandro Ariel Cabral": el archivo de la carpeta es
--    Alejandro Cabral-Velez.jfif (publicado como alejandro-cabral-velez.webp).
--    Se mantiene la fila "Ariel Cabral" y se le aplica esa foto.
UPDATE temporada_jugadores
SET foto_epoca = '/jugadores/rivales/alejandro-cabral-velez.webp',
    foto_fuente = 'Alejandro Cabral-Velez.jfif',
    foto_anio = 2012
WHERE temporada_id = (SELECT id FROM temporadas WHERE etiqueta = 'Vélez 2012/13 Inicial + Campeonato')
  AND jugador_id = (SELECT id FROM jugadores WHERE nombre = 'Ariel Cabral');

-- 2) "Pellegrino" de Vélez 2004/05 es Mauricio Pellegrino, que ya tiene ficha
--    y foto en las temporadas 1995/96 y 1997/98 (el UPDATE 08 no lo tocaba
--    porque buscaba el nombre completo). Se apunta la fila a esa ficha.
UPDATE temporada_jugadores
SET jugador_id = (SELECT id FROM jugadores WHERE nombre = 'Mauricio Pellegrino'),
    foto_epoca = '/jugadores/rivales/mauricio-pellegrino-velez.webp',
    foto_fuente = 'Mauricio Pellegrino-Velez.jfif',
    foto_anio = 2004
WHERE temporada_id = (SELECT id FROM temporadas WHERE etiqueta = 'Vélez 2004/05 Clausura')
  AND jugador_id = (SELECT id FROM jugadores WHERE nombre = 'Pellegrino');

-- 3) Éber Banega no jugó en Vélez 1997/98: en su lugar estaba Marcelo Gómez,
--    que ya tiene marcelo-gomez-velez.webp aplicado en 1992/93 y 1995/96.
UPDATE temporada_jugadores
SET jugador_id = (SELECT id FROM jugadores WHERE nombre = 'Marcelo Gómez'),
    foto_epoca = '/jugadores/rivales/marcelo-gomez-velez.webp',
    foto_fuente = 'Marcelo Gómez-Velez.jfif',
    foto_anio = 1992
WHERE temporada_id = (SELECT id FROM temporadas WHERE etiqueta = 'Vélez 1997/98 Clausura')
  AND jugador_id = (SELECT id FROM jugadores WHERE nombre = 'Éber Banega');

-- 4) "Rivero" de San Lorenzo 2006/07 es Diego Rivero (foto cargada en Boca
--    2011/12). Se apunta la fila a esa ficha y se reutiliza su foto.
UPDATE temporada_jugadores
SET jugador_id = (SELECT id FROM jugadores WHERE nombre = 'Diego Rivero'),
    foto_epoca = '/jugadores/rivales/diego-rivero-boca.webp',
    foto_fuente = 'Diego Rivero-Boca.jpg',
    foto_anio = 2011
WHERE temporada_id = (SELECT id FROM temporadas WHERE etiqueta = 'San Lorenzo 2006/07 Clausura')
  AND jugador_id = (SELECT id FROM jugadores WHERE nombre = 'Rivero');

COMMIT;

SELECT tj.id, j.nombre, t.etiqueta, tj.foto_epoca, tj.foto_anio
FROM temporada_jugadores tj
JOIN jugadores j ON j.id = tj.jugador_id
JOIN temporadas t ON t.id = tj.temporada_id
WHERE j.nombre IN ('Ariel Cabral', 'Mauricio Pellegrino', 'Marcelo Gómez', 'Diego Rivero')
  AND t.etiqueta IN ('Vélez 2012/13 Inicial + Campeonato', 'Vélez 2004/05 Clausura',
                     'Vélez 1997/98 Clausura', 'San Lorenzo 2006/07 Clausura')
ORDER BY t.etiqueta, j.nombre;
