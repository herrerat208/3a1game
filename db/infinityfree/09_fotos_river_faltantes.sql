-- ============================================================
-- 3A1 — Últimas fotos de River que faltaban (19 jugadores)
-- 5 WebP nuevos generados con scripts/importar_fotos_river_faltantes.py
-- 8 reasignaciones a WebP que ya existen (alias documentados en
--   db/migracion_correcciones_v3.sql), sin tocar fotos de época de rivales.
-- 6 se dejan sin foto a propósito: no hay fuente segura para su identidad.
-- Ejecutar después de subir los WebP nuevos con scripts/subir_helper.mjs upload.
-- ============================================================
USE `if0_43478740_3a1`;

-- WebP nuevos (recorte facial desde la carpeta original del dueño).
UPDATE jugadores SET foto_url = '/jugadores/marcos-acuna.webp' WHERE nombre = 'Marcos Acuña';
UPDATE jugadores SET foto_url = '/jugadores/matias-abelairas.webp' WHERE nombre = 'Matías Abelairas';
UPDATE jugadores SET foto_url = '/jugadores/oscar-ahumada.webp' WHERE nombre = 'Oscar Ahumada';
UPDATE jugadores SET foto_url = '/jugadores/pablo-aimar.webp' WHERE nombre = 'Pablo Aimar';
UPDATE jugadores SET foto_url = '/jugadores/walter-acevedo.webp' WHERE nombre = 'Walter Acevedo';

-- Reasignaciones seguras: el nombre de la base es un alias o una variante
-- ortográfica del jugador que ya tiene foto en public/jugadores/.
UPDATE jugadores SET foto_url = '/jugadores/brian-romero.webp' WHERE nombre = 'Braian Romero';
UPDATE jugadores SET foto_url = '/jugadores/julio-cesar-toresani.webp' WHERE nombre = 'Julio Toresani';
UPDATE jugadores SET foto_url = '/jugadores/luis-oscar-gonzalez.webp' WHERE nombre = 'Lucho González';
UPDATE jugadores SET foto_url = '/jugadores/avelino-cadilla.webp' WHERE nombre = 'Luis Ferreyra (o Avelino Cadilla)';
UPDATE jugadores SET foto_url = '/jugadores/victor-marchetti.webp' WHERE nombre = 'Victor Marquetti';
UPDATE jugadores SET foto_url = '/jugadores/marcelo-etchegaray.webp' WHERE nombre = 'Juan Carlos Marcelo';
UPDATE jugadores SET foto_url = '/jugadores/jose-alberto-perez.webp' WHERE nombre = 'Perico Pérez';
UPDATE jugadores SET foto_url = '/jugadores/ricardo-rojas.webp' WHERE nombre = 'Emanuele Crosa';

-- La foto local manda sobre la de Commons: limpiamos foto_epoca solo en las
-- participaciones de RIVER de estos 13 jugadores. Ojo: no se puede hacer una
-- limpieza global LIKE '/jugadores/%' porque borraría fotos de época de
-- rivales (p. ej. Braian Romero en Vélez 2024, cargadas por 08_fotos_rivales.sql).
UPDATE temporada_jugadores tj
JOIN jugadores j ON j.id = tj.jugador_id
JOIN temporadas t ON t.id = tj.temporada_id
JOIN clubes c ON c.id = t.club_id
SET tj.foto_epoca = NULL, tj.foto_fuente = NULL, tj.foto_anio = NULL
WHERE c.nombre = 'River Plate'
  AND j.foto_url LIKE '/jugadores/%'
  AND j.nombre IN (
    'Marcos Acuña', 'Matías Abelairas', 'Oscar Ahumada', 'Pablo Aimar', 'Walter Acevedo',
    'Braian Romero', 'Julio Toresani', 'Lucho González', 'Luis Ferreyra (o Avelino Cadilla)',
    'Victor Marquetti', 'Juan Carlos Marcelo', 'Perico Pérez', 'Emanuele Crosa'
  );

-- Sin foto a propósito (no hay fuente exacta o el alias es dudoso):
-- Alberto Gallardo, Ángel Commisso, Gustavo Salvador, Máximo Lucas,
-- Miguel Ángel Guzmán, Recaredo Fernández.
