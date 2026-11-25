-- 3A1 — Diagnóstico y reparación de � (U+FFFD) en la base viva.
-- Causa: filas importadas con un pool viejo; el pool actual es UTF-8 limpio
-- pero INSERT IGNORE no pisa filas existentes. Correr por partes en phpMyAdmin.
USE `3a1`;

-- ============ 1) DIAGNÓSTICO (solo miran, no cambian nada) ============
-- ¿Qué clubes tienen el caracter roto? (bytes EF BF BD)
SELECT id, nombre FROM clubes WHERE HEX(nombre) LIKE '%EFBFBD%';
-- ¿Ya existe además la versión sana? (duplicado: corrupto + sano)
SELECT nombre FROM clubes WHERE nombre IN ('Vélez', 'Newell’s', 'Huracán');
-- Técnicos, etiquetas y jugadores con � :
SELECT id, nombre FROM tecnicos WHERE HEX(nombre) LIKE '%EFBFBD%';
SELECT id, etiqueta FROM temporadas WHERE HEX(etiqueta) LIKE '%EFBFBD%';
SELECT j.id, j.nombre, COUNT(tj.id) AS usos
FROM jugadores j LEFT JOIN temporada_jugadores tj ON tj.jugador_id = j.id
WHERE HEX(j.nombre) LIKE '%EFBFBD%'
GROUP BY j.id;

-- ============ 2) CASO A: no hay duplicado (solo la fila corrupta) ============
-- Renombra directo. Solo tocan filas con �, nunca las sanas.
UPDATE clubes SET nombre = 'Vélez' WHERE HEX(nombre) LIKE '%EFBFBD%' AND nombre LIKE 'V%';
UPDATE clubes SET nombre = 'Newell’s' WHERE HEX(nombre) LIKE '%EFBFBD%' AND nombre LIKE 'N%';
UPDATE clubes SET nombre = 'Huracán' WHERE HEX(nombre) LIKE '%EFBFBD%' AND nombre LIKE 'H%';

-- ============ 3) CASO B: hay duplicado (corrupto + sano) ============
-- Si el paso 2 dio error de UNIQUE duplicado, usar esto en vez del paso 2.
-- Completar los ids según el diagnóstico del paso 1, un club por vez:
-- UPDATE temporadas SET club_id = <id_sano> WHERE club_id = <id_corrupto>;
-- DELETE FROM clubes WHERE id = <id_corrupto>;

-- ============ 4) Jugadores/técnicos/etiquetas corruptos ============
-- No se arreglan a ciegas: buscar el valor correcto en db/pool_completo.sql
-- y renombrar por id. Ejemplo (completar id según diagnóstico):
-- UPDATE jugadores SET nombre = 'Nombre Correcto' WHERE id = <id>;
-- Si el UPDATE da UNIQUE duplicado: mover temporada_jugadores al id sano y
-- borrar el corrupto, igual que el caso B de clubes.
