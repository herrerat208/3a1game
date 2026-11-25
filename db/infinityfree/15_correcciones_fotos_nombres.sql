-- ============================================================
-- 3A1 — Lote 2: fotos que ya están en la carpeta pero no se ven
-- Producción: `if0_43478740_3a1` — 2026-11-24
--
-- Origen: db/infinityfree/08_fotos_rivales.sql ya traía los UPDATE con los
-- nombres completos, pero la base viva tiene nombres cortos/variantes y esos
-- UPDATEs fueron no-op. Acá se corrige el nombre o el jugador al que apunta
-- cada participación y se asigna la foto con la ruta/año exactos del SQL 08.
--
-- Verificado en vivo: las temporadas involucradas tienen 11 jugadores; los
-- nombres destino no existen como fila separada salvo los casos marcados
-- "duplicado de la misma temporada", donde se conservan las 11 filas.
-- ============================================================
USE `if0_43478740_3a1`;
SET NAMES utf8mb4;
START TRANSACTION;

-- ---------- 1) Renombres al nombre completo (destino libre) ----------
UPDATE jugadores SET nombre = 'Miguel Angel Ludueña'      WHERE nombre = 'Ludueña';
UPDATE jugadores SET nombre = 'Martín Vitali'             WHERE nombre = 'Vitali';
UPDATE jugadores SET nombre = 'Julio Omar Pedernera'      WHERE nombre = 'Pedernera';
UPDATE jugadores SET nombre = 'Germán Ré'                 WHERE nombre = 'Ré';
UPDATE jugadores SET nombre = 'José Medina'               WHERE nombre = 'Jorge Medina';
UPDATE jugadores SET nombre = 'Guillermo Matías Fernández' WHERE nombre = 'Pol Fernández';
UPDATE jugadores SET nombre = 'Héctor Sabás Pueblas'      WHERE nombre = 'Juan Carlos Pueblas';

-- ---------- 2) Fotos de esos renombres ----------
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/miguel-angel-luduena-independiente.webp', foto_fuente = 'Miguel Angel Ludueña-Independiente.jfif', foto_anio = 1988 WHERE id = 1350;
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/martin-vitali-racing.webp',                foto_fuente = 'Martín Vitali-Racing.jfif',                    foto_anio = 2001 WHERE id = 1477;
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/julio-omar-pedernera-rosario-central.webp', foto_fuente = 'Julio Omar Pedernera -Rosario.jfif',       foto_anio = 1986 WHERE id = 1326;
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/german-re-newells.webp',                   foto_fuente = 'Germán Ré-Newells.jfif',                    foto_anio = 2004 WHERE id = 1512;
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/jose-medina-quilmes.webp',                 foto_fuente = 'José Medina-Quilmes.jfif',                  foto_anio = 1978 WHERE id = 1216;
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/hector-sabas-pueblas-boca.webp',           foto_fuente = 'Héctor Sabás Pueblas-Boca.jfif',           foto_anio = 1962 WHERE id = 30;
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/guillermo-matias-fernandez-racing.webp',   foto_fuente = 'Guillermo Matías Fernández-Racing.jpg',     foto_anio = 2018 WHERE id = 1748;
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/guillermo-matias-fernandez-boca.webp',     foto_fuente = 'Guillermo Matías Fernández-Boca.jpg',       foto_anio = 2019 WHERE id = 1758;
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/guillermo-matias-fernandez-boca.webp',     foto_fuente = 'Guillermo Matías Fernández-Boca.jpg',       foto_anio = 2022 WHERE id = 1767;

-- ---------- 3) Fichas existentes con otra denominación ----------
-- Schiavi 2003/04 = Rolando Schiavi (no hay otro Rolando en esa temporada).
UPDATE temporada_jugadores
SET jugador_id = (SELECT id FROM jugadores WHERE nombre = 'Rolando Schiavi'),
    foto_epoca = '/jugadores/rivales/rolando-schiavi-boca.webp',
    foto_fuente = 'Rolando Schiavi-Boca.jfif', foto_anio = 2003
WHERE id = 1500;
-- Osvaldo Toriani 1963 = Osvaldo Rubén Toriani (1960, con foto).
UPDATE temporada_jugadores
SET jugador_id = (SELECT id FROM jugadores WHERE nombre = 'Osvaldo Rubén Toriani'),
    foto_epoca = '/jugadores/rivales/osvaldo-ruben-toriani-independiente.webp',
    foto_fuente = 'Osvaldo Rubén Toriani-Independiente.jpg', foto_anio = 1963
WHERE id = 992;
-- Roberto "Pipo" Ferreiro 1960 = Roberto Ferreiro (1963/67, con foto).
UPDATE temporada_jugadores
SET jugador_id = (SELECT id FROM jugadores WHERE nombre = 'Roberto Ferreiro'),
    foto_epoca = '/jugadores/rivales/roberto-ferreiro-independiente.webp',
    foto_fuente = 'Roberto Ferreiro-Independiente.jfif', foto_anio = 1960
WHERE id = 971;
-- Héctor Martínez 1970 = Miguel Ángel Raimondo (1971, con foto).
UPDATE temporada_jugadores
SET jugador_id = (SELECT id FROM jugadores WHERE nombre = 'Miguel Ángel Raimondo'),
    foto_epoca = '/jugadores/rivales/miguel-angel-raimondo-independiente.webp',
    foto_fuente = 'Miguel Ángel Raimondo-Independiente.jfif', foto_anio = 1970
WHERE id = 1098;

-- ---------- 4) Duplicados de la misma temporada: se conservan las 11 filas ----------
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/jose-luis-calderon-argentinos-juniors.webp', foto_fuente = 'José Luis Calderón-Argentinos.jfif', foto_anio = 2009 WHERE id = 1612;
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/ruben-sune-boca.webp',                        foto_fuente = 'Rubén Suñé-Boca.jfif',                       foto_anio = 1970 WHERE id = 1109;
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/raul-horacio-madero-estudiantes.webp',        foto_fuente = 'Raúl Horacio Madero-Estudiantes.jfif',      foto_anio = 1967 WHERE id = 1028;
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/pascual-rambert-independiente.webp',          foto_fuente = 'Pascual Rambert-Independiente.jfif',        foto_anio = 1993 WHERE id = 1409;
UPDATE temporada_jugadores SET foto_epoca = '/jugadores/rivales/omar-indio-gomez-quilmes.webp',               foto_fuente = 'Omar Gómez-Quilmes.jfif',                    foto_anio = 1978 WHERE id = 1222;

-- ---------- 5) Correcciones informadas por el dueño ----------
-- San Lorenzo 1994/95: "Rui Fernando" no existe. El lateral izquierdo era
-- Damián Manusovich, que ya está en la temporada (era DFC). Se saca la fila
-- falsa y se le pone la posición correcta a la ficha real.
DELETE tj FROM temporada_jugadores tj
 WHERE tj.id = 1414
   AND NOT EXISTS (SELECT 1 FROM partida_jugadores pj WHERE pj.temporada_jugador_id = tj.id)
   AND NOT EXISTS (SELECT 1 FROM sanciones s WHERE s.temporada_jugador_id = tj.id);
UPDATE temporada_jugadores SET posicion_natural = 'LI' WHERE id = 1413;

-- San Lorenzo 1974 Nacional: Gagliano no era parte del equipo; Jorge Olguín
-- era el lateral izquierdo (estaba como DFC y ya tiene foto).
DELETE tj FROM temporada_jugadores tj
 WHERE tj.id = 1183
   AND NOT EXISTS (SELECT 1 FROM partida_jugadores pj WHERE pj.temporada_jugador_id = tj.id)
   AND NOT EXISTS (SELECT 1 FROM sanciones s WHERE s.temporada_jugador_id = tj.id);
UPDATE temporada_jugadores SET posicion_natural = 'LI' WHERE id = 1181;

COMMIT;
