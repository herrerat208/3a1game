-- ============================================================
-- 3A1 — Corrección final de ortografía y nombres de jugadores
-- 19/11/2026
--
-- Fuente: "River A-Z" / "Rivales A-Z" de Jugadores_y_equipos_v3.xlsx
-- (donde el dueño corrigió los nombres) + verificación puntual en
-- Wikipedia para los casos dudosos.
--
-- Aplica en este orden:
--   1) fusiones de jugadores repetidos (mueve temporada_jugadores)
--   2) renombres por tildes / apellidos / capitalización
--
-- Idempotente: se puede volver a ejecutar sin duplicar ni romper nada.
-- El id de temporada_jugadores NO cambia: partida_jugadores, sanciones
-- y foto_epoca siguen apuntando a la misma participación.
--
-- Backup previo: db/backups/3a1_pre_ortografia_20261119_034722.sql
-- ============================================================

USE `3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

-- ------------------------------------------------------------
-- 1) FUSIONES
--    Se conserva el id que tiene la foto/participación más completa.
-- ------------------------------------------------------------

-- Pepe Basualdo = José Basualdo (Boca 1998/99, Vélez 1992/93).
-- El destino se busca con un patrón SOLO ASCII: en algunos hostings la
-- comparación byte a byte de 'José' falla por charset, @dst queda NULL, no
-- se borra el duplicado y el rename posterior da #1062. 'Jos%' no matchea
-- a 'Fabián Basualdo', que también existe en el pool.
SET @src := (SELECT id FROM jugadores WHERE nombre = 'Pepe Basualdo' LIMIT 1);
SET @dst := (SELECT id FROM jugadores WHERE nombre LIKE 'Jos% Basualdo' LIMIT 1);
UPDATE temporada_jugadores SET jugador_id = @dst
 WHERE @src IS NOT NULL AND @dst IS NOT NULL AND jugador_id = @src;
DELETE FROM jugadores WHERE @src IS NOT NULL AND @dst IS NOT NULL AND id = @src;

-- Brian Romero = Braian Romero. Se conserva el id de River 2021 porque
-- tiene el avatar local (/jugadores/brian-romero.webp); la participación
-- de Vélez 2024 conserva su foto de época al moverse de jugador.
SET @src := (SELECT id FROM jugadores WHERE nombre = 'Braian Romero');
SET @dst := (SELECT id FROM jugadores WHERE nombre = 'Brian Romero');
UPDATE temporada_jugadores SET jugador_id = @dst
 WHERE @src IS NOT NULL AND @dst IS NOT NULL AND jugador_id = @src;
DELETE FROM jugadores WHERE @src IS NOT NULL AND @dst IS NOT NULL AND id = @src;

-- Hugo Orlando Gatti = Hugo Gatti. Se conserva "Hugo Gatti", nombre que
-- usa el Excel de River y el avatar local.
SET @src := (SELECT id FROM jugadores WHERE nombre = 'Hugo Orlando Gatti');
SET @dst := (SELECT id FROM jugadores WHERE nombre = 'Hugo Gatti');
UPDATE temporada_jugadores SET jugador_id = @dst
 WHERE @src IS NOT NULL AND @dst IS NOT NULL AND jugador_id = @src;
DELETE FROM jugadores WHERE @src IS NOT NULL AND @dst IS NOT NULL AND id = @src;

-- Jonathan Cristaldo = Jonatan Cristaldo (escritura de Wikipedia y del
-- Excel de Racing).
SET @src := (SELECT id FROM jugadores WHERE nombre = 'Jonathan Cristaldo');
SET @dst := (SELECT id FROM jugadores WHERE nombre = 'Jonatan Cristaldo');
UPDATE temporada_jugadores SET jugador_id = @dst
 WHERE @src IS NOT NULL AND @dst IS NOT NULL AND jugador_id = @src;
DELETE FROM jugadores WHERE @src IS NOT NULL AND @dst IS NOT NULL AND id = @src;

-- ------------------------------------------------------------
-- 2) RENOMBRES
--    IGNORE evita que un duplicado suelto aborte toda la importación con
--    #1062; el SELECT de control de abajo deja visible lo que no se pudo
--    renombrar. Las fusiones de arriba ya vaciaron los nombres viejos.
-- ------------------------------------------------------------
UPDATE IGNORE jugadores SET nombre = 'Adrián Bastía'          WHERE nombre = 'Adrian Bastía';
UPDATE jugadores SET nombre = 'Agustín Orión'          WHERE nombre = 'Agustín Orion';
UPDATE jugadores SET nombre = 'Alejandro Domínguez'   WHERE nombre = 'Alejandro Dominguez';
UPDATE jugadores SET nombre = 'Braian Romero'         WHERE nombre = 'Brian Romero';
UPDATE jugadores SET nombre = 'Carlos Tévez'           WHERE nombre = 'Carlos Tevez';
UPDATE jugadores SET nombre = 'Claudio Husaín'         WHERE nombre = 'Claudio Husain';
UPDATE jugadores SET nombre = 'Damián Manso'           WHERE nombre = 'Damian Manso';
UPDATE jugadores SET nombre = 'Fabián Basualdo'        WHERE nombre = 'Fabian Basualdo';
UPDATE jugadores SET nombre = 'Fabián Monzón'          WHERE nombre = 'Fabian Monzón';
UPDATE jugadores SET nombre = 'Hugo Gatti'             WHERE nombre = 'Hugo Orlando Gatti';
UPDATE jugadores SET nombre = 'Ignacio Fernández'      WHERE nombre = 'Ignacio Fernandez';
UPDATE jugadores SET nombre = 'Jonatan Cristaldo'      WHERE nombre = 'Jonathan Cristaldo';
UPDATE jugadores SET nombre = 'José Basualdo'          WHERE nombre = 'Pepe Basualdo';
UPDATE jugadores SET nombre = 'José María Vieta'       WHERE nombre = 'José Maria Vieta';
UPDATE jugadores SET nombre = 'Juan Román Riquelme'    WHERE nombre = 'Juan Roman Riquelme';
UPDATE jugadores SET nombre = 'Leandro González Pírez' WHERE nombre = 'Leandro González Pirez';
UPDATE jugadores SET nombre = 'Leonardo Díaz'          WHERE nombre = 'Leo Díaz';
UPDATE jugadores SET nombre = 'Lucas Martínez Quarta'  WHERE nombre = 'Lucas Martinez Quarta';
UPDATE jugadores SET nombre = 'Matías Zaracho'         WHERE nombre = 'Matias Zaracho';
UPDATE jugadores SET nombre = 'Miguel Ángel Ludueña'   WHERE nombre = 'Miguel Angel Ludueña';
UPDATE jugadores SET nombre = 'Nahitan Nández'         WHERE nombre = 'Nahitán Nández';
UPDATE jugadores SET nombre = 'Pablo Álvarez'          WHERE nombre = 'Pablo Alvarez';
UPDATE jugadores SET nombre = 'Rui Fernando'           WHERE nombre = 'rui Fernando';
UPDATE jugadores SET nombre = 'Sebastián Battaglia'    WHERE nombre = 'Sebastian Battaglia';
UPDATE jugadores SET nombre = 'Sebastián Driussi'      WHERE nombre = 'Sebastian Driussi';
UPDATE jugadores SET nombre = 'Tomás Rolán'            WHERE nombre = 'Tomás Rolan';
UPDATE jugadores SET nombre = 'Víctor Hugo Sotomayor'  WHERE nombre = 'Victor Hugo Sotomayor';
UPDATE jugadores SET nombre = 'Víctor Zapata'          WHERE nombre = 'Victor Zapata';

COMMIT;

-- ------------------------------------------------------------
-- 3) CONTROL (debe dar 0 filas)
-- ------------------------------------------------------------
SELECT id, nombre FROM jugadores WHERE BINARY nombre REGEXP BINARY
  '(^| )(Adrian|Agustin|Angel|Damian|Fabian|Matias|Sebastian|Victor|Maria|Roman|Rolan|Husain|Orion|Nandez|Miguel Angel|Jose Maria|Juan Roman|rui|Brian Romero|Jonathan Cristaldo|Pepe Basualdo)( |$)'
ORDER BY nombre;
SELECT COUNT(*) AS jugadores, (SELECT COUNT(*) FROM temporada_jugadores) AS participaciones FROM jugadores;
