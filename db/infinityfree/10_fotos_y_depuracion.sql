-- ============================================================
-- 3A1 — Fotos pendientes de River + depuración de jugadores sin fuente
-- Ejecutar DESPUÉS de 09_fotos_river_faltantes.sql. No re-ejecutar el 09.
--
-- La carpeta del dueño es la fuente de verdad de las fotos: si un nombre no
-- está ahí, el jugador no existe en el juego. Los 6 nombres del final no
-- tienen archivo en "Carpeta fotos 3a1" (24 participaciones) y se quitan del
-- pool. Las filas ya usadas en una partida se conservan para no romper el
-- historial: por eso el DELETE excluye las que tienen partida_jugadores.
-- Antes de ejecutar, exportar una copia de la base desde phpMyAdmin.
-- ============================================================
USE `if0_43478740_3a1`;

-- Los conteos previos y posteriores se hacen con 10b_verificar.sql (una sola
-- consulta): el helper de InfinityFree no tolera más de un SELECT por archivo.

START TRANSACTION;

-- 1. Dos retratos de River que sí están en la carpeta y no tenían foto_url.
--    Ricardo Ismael Rojas NO se aplica: es otra toma de Ricardo Rojas, que ya
--    usa /jugadores/ricardo-rojas.webp (ver migracion_correcciones_v3.sql).
UPDATE jugadores SET foto_url = '/jugadores/enrique-fernandez.webp' WHERE nombre = 'Enrique Fernández';
UPDATE jugadores SET foto_url = '/jugadores/milton-alves-da-silva.webp' WHERE nombre = 'Mílton Alves da Silva';

-- 2. Seis fotos cuyo UPDATE original quedó con la ortografía anterior a 03.
UPDATE jugadores SET foto_url = '/jugadores/fabian-basualdo.webp' WHERE nombre = 'Fabián Basualdo';
UPDATE jugadores SET foto_url = '/jugadores/ignacio-fernandez.webp' WHERE nombre = 'Ignacio Fernández';
UPDATE jugadores SET foto_url = '/jugadores/leandro-gonzalez-pirez.webp' WHERE nombre = 'Leandro González Pírez';
UPDATE jugadores SET foto_url = '/jugadores/lucas-martinez-quarta.webp' WHERE nombre = 'Lucas Martínez Quarta';
UPDATE jugadores SET foto_url = '/jugadores/sebastian-driussi.webp' WHERE nombre = 'Sebastián Driussi';
UPDATE jugadores SET foto_url = '/jugadores/victor-zapata.webp' WHERE nombre = 'Víctor Zapata';

-- 3. La foto local manda sobre la de Commons en las participaciones de River.
--    Nunca se limpia una foto de época de rival (p. ej. Braian Romero en
--    Vélez 2024, cargada por 08_fotos_rivales.sql).
UPDATE temporada_jugadores tj
JOIN jugadores j ON j.id = tj.jugador_id
JOIN temporadas t ON t.id = tj.temporada_id
JOIN clubes c ON c.id = t.club_id
SET tj.foto_epoca = NULL, tj.foto_fuente = NULL, tj.foto_anio = NULL
WHERE c.nombre = 'River Plate'
  AND j.foto_url LIKE '/jugadores/%'
  AND j.nombre IN (
    'Enrique Fernández', 'Mílton Alves da Silva',
    'Fabián Basualdo', 'Ignacio Fernández', 'Leandro González Pírez',
    'Lucas Martínez Quarta', 'Sebastián Driussi', 'Víctor Zapata'
  );

-- 4. Sin fuente en la carpeta = jugador inexistente. Se eliminan solo las
--    participaciones que nadie usó en una partida guardada.
DELETE tj FROM temporada_jugadores tj
JOIN jugadores j ON j.id = tj.jugador_id
WHERE j.nombre IN ('Alberto Gallardo', 'Ángel Commisso', 'Gustavo Salvador',
                   'Máximo Lucas', 'Miguel Ángel Guzmán', 'Recaredo Fernández')
  AND NOT EXISTS (
    SELECT 1 FROM partida_jugadores pj WHERE pj.temporada_jugador_id = tj.id
  );

DELETE FROM jugadores
WHERE nombre IN ('Alberto Gallardo', 'Ángel Commisso', 'Gustavo Salvador',
                 'Máximo Lucas', 'Miguel Ángel Guzmán', 'Recaredo Fernández')
  AND NOT EXISTS (
    SELECT 1 FROM temporada_jugadores tj WHERE tj.jugador_id = jugadores.id
  );

COMMIT;

-- Verificar con 10b_verificar.sql.
