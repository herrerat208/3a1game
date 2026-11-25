-- ============================================================
-- 3A1 — Correcciones de jugadores/equipos desde Jugadores_y_equipos_v3.xlsx
-- Hoja usada como fuente: "River A-Z" y "Rivales A-Z" (las hojas por
-- temporada siguen el orden viejo; el dueño corrigió los nombres en A-Z).
--
-- Aplica:
--   * renombres sin colisión (UPDATE jugadores.nombre)
--   * fusiones de duplicados (mueve temporada_jugadores al jugador bueno
--     y borra el jugador viejo)
--   * duplicados de la MISMA temporada: se conserva una sola participación
--   * posiciones secundarias que la hoja A-Z declara y la DB no tenía
--
-- No borra jugadores que están solo en la DB y podrían ser reales
-- (Alberto Gallardo 1974, Máximo Lucas 2003, Miguel Ángel Guzmán 1965,
--  Roberto Blanco 1963, Osvaldo Gagliano 1974, rui Fernando 1994/95):
-- quedan marcados en el reporte para verificar.
--
-- Backup previo: db/backups/3a1_pre_correcciones_20261119_024939.sql
-- ============================================================

USE `3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

-- ------------------------------------------------------------
-- 1) RENOMBRES (sin colisión de nombre)
-- ------------------------------------------------------------
UPDATE jugadores SET nombre = 'Mílton Alves da Silva'      WHERE id = 373;
UPDATE jugadores SET nombre = 'Franco Costanzo'            WHERE id = 322;
UPDATE jugadores SET nombre = 'Juan José Borrelli'         WHERE id = 1434;
UPDATE jugadores SET nombre = 'Jorge da Silva'             WHERE id = 465;
UPDATE jugadores SET nombre = 'Luis Oscar González'        WHERE id = 1510;
UPDATE jugadores SET nombre = 'Pedro Sarabia'              WHERE id = 754;
UPDATE jugadores SET nombre = 'Enrique Fernández'          WHERE id = 1711;
UPDATE jugadores SET nombre = 'Héctor Sabás Pueblas'       WHERE id = 27;
UPDATE jugadores SET nombre = 'Guillermo Matías Fernández' WHERE id = 1691;
UPDATE jugadores SET nombre = 'Nicolás Peric'              WHERE id = 613;
UPDATE jugadores SET nombre = 'Alfredo Anhielo'            WHERE id = 1013;
UPDATE jugadores SET nombre = 'Miguel Ángel Ludueña'       WHERE id = 1515;
UPDATE jugadores SET nombre = 'Héctor Gabriel Banegas'     WHERE id = 1865;
UPDATE jugadores SET nombre = 'Iván Borghello'             WHERE id = 426;
UPDATE jugadores SET nombre = 'Germán Ré'                  WHERE id = 1785;
UPDATE jugadores SET nombre = 'José Medina'                WHERE id = 459;
UPDATE jugadores SET nombre = 'Martín Vitali'              WHERE id = 920;
UPDATE jugadores SET nombre = 'Julio Omar Pedernera'       WHERE id = 764;
UPDATE jugadores SET nombre = 'Hernán Franco'              WHERE id = 1295;
-- El Excel dice "Alexix Maldonado" (typo); el jugador real es Alexis Maldonado.
UPDATE jugadores SET nombre = 'Alexis Maldonado'           WHERE id = 965;

-- ------------------------------------------------------------
-- 2) FUSIONES CON TEMPORADA NUEVA (se mueve la participación)
--    El id de temporada_jugadores no cambia: partida_jugadores y
--    sanciones siguen apuntando bien.
-- ------------------------------------------------------------
-- Abel Vieytez (1967) -> Abel Vieitez (1965, 1966)
UPDATE temporada_jugadores SET jugador_id = 33 WHERE jugador_id = 34;
DELETE FROM jugadores WHERE id = 34;

-- Luis Ferreyra (1940, 1947-49) + Luis Ferreyra (o Avelino Cadilla) (1942)
-- -> Luis Antonio Ferreyra (1943)
UPDATE temporada_jugadores SET jugador_id = 601 WHERE jugador_id IN (607, 608);
DELETE FROM jugadores WHERE id IN (607, 608);

-- Miguel Ángel Guzmán 1966 -> Juan Carlos Guzmán 1967.
-- OJO: Miguel Ángel Guzmán 1965 queda vivo (posible jugador distinto o
-- participación de más; se reporta).
UPDATE temporada_jugadores SET jugador_id = 1420
 WHERE jugador_id = 1595
   AND temporada_id = (SELECT id FROM temporadas WHERE etiqueta = 'River 1966');

-- Juan Carlos Marcelo (1960) -> Marcelo Etchegaray (1961-63)
UPDATE temporada_jugadores SET jugador_id = 625 WHERE jugador_id = 504;
DELETE FROM jugadores WHERE id = 504;

-- Ángel Commisso (1977) -> Oscar Ortiz (1978-80); posición de la A-Z: EI
UPDATE temporada_jugadores SET jugador_id = 731, posicion_natural = 'EI'
 WHERE jugador_id = 1859;
DELETE FROM jugadores WHERE id = 1859;

-- Victor Marquetti (1977) -> Víctor Marchetti (1969-70)
UPDATE temporada_jugadores SET jugador_id = 1843 WHERE jugador_id = 917;
DELETE FROM jugadores WHERE id = 917;

-- Julio Toresani (1993) -> Julio César Toresani (1994-95)
UPDATE temporada_jugadores SET jugador_id = 1463 WHERE jugador_id = 548;
DELETE FROM jugadores WHERE id = 548;

-- Perico Pérez (1972) -> José Alberto Pérez (1973-74)
UPDATE temporada_jugadores SET jugador_id = 1385 WHERE jugador_id = 1690;
DELETE FROM jugadores WHERE id = 1690;

-- Schiavi (2003/04) -> Rolando Schiavi (2011/12)
UPDATE temporada_jugadores SET jugador_id = 849 WHERE jugador_id = 880;
DELETE FROM jugadores WHERE id = 880;

-- Calderón (Argentinos 2009/10) -> Federico Domínguez (mismo jugador;
-- la A-Z lo lista como ED en Argentinos)
UPDATE temporada_jugadores SET jugador_id = 1215, posicion_natural = 'ED'
 WHERE jugador_id = 1051;
DELETE FROM jugadores WHERE id = 1051;

-- Osvaldo Toriani (1963) -> Osvaldo Rubén Toriani (1960)
UPDATE temporada_jugadores SET jugador_id = 1660 WHERE jugador_id = 743;
DELETE FROM jugadores WHERE id = 743;

-- Héctor Martínez (1970) -> Miguel Ángel Raimondo (1971)
UPDATE temporada_jugadores SET jugador_id = 1599 WHERE jugador_id = 1325;
DELETE FROM jugadores WHERE id = 1325;

-- Roberto "Pipo" Ferreiro (1960) -> Roberto Ferreiro (1963, 1967, River 1968-70)
UPDATE temporada_jugadores SET jugador_id = 821 WHERE jugador_id = 813;
DELETE FROM jugadores WHERE id = 813;

-- Rivero (San Lorenzo 2006/07) -> Diego Rivero (Boca 2011/12)
UPDATE temporada_jugadores SET jugador_id = 226 WHERE jugador_id = 811;
DELETE FROM jugadores WHERE id = 811;

-- Pellegrino (Vélez 2004/05) -> Mauricio Pellegrino (Vélez 1995/96, 1997/98)
UPDATE temporada_jugadores SET jugador_id = 664 WHERE jugador_id = 769;
DELETE FROM jugadores WHERE id = 769;

-- ------------------------------------------------------------
-- 3) DUPLICADOS DE LA MISMA TEMPORADA
--    No hay partida_jugadores/sanciones apuntando a estas filas
--    (verificado antes de aplicar). Se conserva la ficha del jugador
--    que ya existía y se borra la participación duplicada.
-- ------------------------------------------------------------
-- Emanuele Crosa 2002 es Ricardo Rojas 2002 (mismo paraguayo, la foto
-- "Ricardo Ismael Rojas" es otra toma del mismo jugador).
DELETE FROM temporada_jugadores WHERE id = 719;
DELETE FROM jugadores WHERE id = 251;

-- Rubén José Suñé 1970 MI es duplicado de Rubén Suñé 1970 LD.
DELETE FROM temporada_jugadores WHERE id = 2967;
DELETE FROM jugadores WHERE id = 1780;
UPDATE temporada_jugadores SET posiciones_secundarias = 'MI,MC' WHERE id = 2961;

-- Raúl Madero 1967 DFC es duplicado de Raúl Horacio Madero 1967 MI.
DELETE FROM temporada_jugadores WHERE id = 2886;
DELETE FROM jugadores WHERE id = 1710;
UPDATE temporada_jugadores SET posiciones_secundarias = 'DFC' WHERE id = 2890;

-- Sebastián Rambert 1993/94 EI es duplicado de Pascual Rambert 1993/94 ED.
DELETE FROM temporada_jugadores WHERE id = 3267;
DELETE FROM jugadores WHERE id = 1807;
UPDATE temporada_jugadores SET posiciones_secundarias = 'EI' WHERE id = 1439;

-- Ariel Cabral y Alejandro Cabral son la misma persona:
-- "Alejandro Ariel Cabral" (Wikipedia). La A-Z conserva Alejandro.
DELETE FROM temporada_jugadores WHERE id = 3528;
DELETE FROM jugadores WHERE id = 108;
UPDATE temporada_jugadores SET posiciones_secundarias = 'MI' WHERE id = 3527;

-- ------------------------------------------------------------
-- 4) CONTROL
-- ------------------------------------------------------------
COMMIT;

SELECT 'jugadores' AS tabla, COUNT(*) AS total FROM jugadores
UNION ALL
SELECT 'temporada_jugadores', COUNT(*) FROM temporada_jugadores;
