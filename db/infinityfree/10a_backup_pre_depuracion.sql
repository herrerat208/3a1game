-- Copia de seguridad de las filas que 10_fotos_y_depuracion.sql puede cambiar
-- o eliminar. Ejecutar ANTES de ese archivo. Se guarda en la misma base para
-- poder recuperar cualquier dato con un INSERT ... SELECT si hiciera falta.
USE `if0_43478740_3a1`;

DROP TABLE IF EXISTS backup_20261124_temporada_jugadores;
CREATE TABLE backup_20261124_temporada_jugadores AS
SELECT tj.* FROM temporada_jugadores tj
JOIN jugadores j ON j.id = tj.jugador_id
WHERE j.nombre IN ('Alberto Gallardo', 'Ángel Commisso', 'Gustavo Salvador',
                   'Máximo Lucas', 'Miguel Ángel Guzmán', 'Recaredo Fernández');

DROP TABLE IF EXISTS backup_20261124_jugadores;
CREATE TABLE backup_20261124_jugadores AS
SELECT * FROM jugadores
WHERE nombre IN ('Alberto Gallardo', 'Ángel Commisso', 'Gustavo Salvador',
                 'Máximo Lucas', 'Miguel Ángel Guzmán', 'Recaredo Fernández');

DROP TABLE IF EXISTS backup_20261124_fotos;
CREATE TABLE backup_20261124_fotos AS
SELECT id, nombre, foto_url FROM jugadores
WHERE nombre IN ('Enrique Fernández', 'Mílton Alves da Silva',
                 'Fabián Basualdo', 'Ignacio Fernández', 'Leandro González Pírez',
                 'Lucas Martínez Quarta', 'Sebastián Driussi', 'Víctor Zapata');

SELECT 'backup participaciones' AS tabla, COUNT(*) AS filas FROM backup_20261124_temporada_jugadores;
SELECT 'backup jugadores' AS tabla, COUNT(*) AS filas FROM backup_20261124_jugadores;
SELECT 'backup fotos' AS tabla, COUNT(*) AS filas FROM backup_20261124_fotos;
