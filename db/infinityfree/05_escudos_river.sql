-- Generado para hosting compartido — base `if0_43478740_3a1`
-- La base ya existe (creada en el panel del proveedor). Sin CREATE DATABASE.
-- Si elegiste otro nombre en el panel, reemplazá `if0_43478740_3a1` en los tres archivos.

-- ============================================================
-- 3A1 — Escudos de River del dueño (generado por scripts/generar_escudos_river.php)
-- Las imágenes ya están en public/escudos/. Importar con la base 3a1 activa.
-- Rangos solapados: gana el más reciente (1995-2005 sobre 1994-1996).
-- 'Actualidad' = 2026 (último año del pool).
-- ============================================================
USE `if0_43478740_3a1`;

-- River 1940 al 1946.webp
-- temporadas: 7 años (1940-1946)
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/river-1940-al-1946.webp'
WHERE c.nombre = 'River Plate'
  AND c.es_river = TRUE
  AND t.anio_orden IN (1940, 1941, 1942, 1943, 1944, 1945, 1946);

-- River 1947 al 1949.webp
-- temporadas: 3 años (1947-1949)
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/river-1947-al-1949.webp'
WHERE c.nombre = 'River Plate'
  AND c.es_river = TRUE
  AND t.anio_orden IN (1947, 1948, 1949);

-- River 1950 al 1969.webp
-- temporadas: 20 años (1950-1969)
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/river-1950-al-1969.webp'
WHERE c.nombre = 'River Plate'
  AND c.es_river = TRUE
  AND t.anio_orden IN (1950, 1951, 1952, 1953, 1954, 1955, 1956, 1957, 1958, 1959, 1960, 1961, 1962, 1963, 1964, 1965, 1966, 1967, 1968, 1969);

-- River 1970 al 1984.webp
-- temporadas: 15 años (1970-1984)
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/river-1970-al-1984.webp'
WHERE c.nombre = 'River Plate'
  AND c.es_river = TRUE
  AND t.anio_orden IN (1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981, 1982, 1983, 1984);

-- River 1985 al 1993.webp
-- temporadas: 9 años (1985-1993)
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/river-1985-al-1993.webp'
WHERE c.nombre = 'River Plate'
  AND c.es_river = TRUE
  AND t.anio_orden IN (1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993);

-- River 1994 al 1996.webp
-- temporadas: 1 año (1994-1994)
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/river-1994-al-1996.webp'
WHERE c.nombre = 'River Plate'
  AND c.es_river = TRUE
  AND t.anio_orden IN (1994);

-- River 1995 al 2005.webp
-- temporadas: 11 años (1995-2005)
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/river-1995-al-2005.webp'
WHERE c.nombre = 'River Plate'
  AND c.es_river = TRUE
  AND t.anio_orden IN (1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005);

-- River 2006 al 2020.webp
-- temporadas: 15 años (2006-2020)
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/river-2006-al-2020.webp'
WHERE c.nombre = 'River Plate'
  AND c.es_river = TRUE
  AND t.anio_orden IN (2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020);

-- River 2021 a Actualidad.webp
-- temporadas: 6 años (2021-2026)
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/river-2021-a-actualidad.webp'
WHERE c.nombre = 'River Plate'
  AND c.es_river = TRUE
  AND t.anio_orden IN (2021, 2022, 2023, 2024, 2025, 2026);

-- Escudo vigente de River (fallback de clubes.escudo)
UPDATE clubes SET escudo = '/escudos/river-2021-a-actualidad.webp'
WHERE nombre = 'River Plate' AND es_river = TRUE;

