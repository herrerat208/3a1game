-- ============================================================
-- 3A1 — Escudos rivales del dueño (generado por scripts/generar_escudos_rivales.php)
-- Las imágenes ya están en public/escudos/. Importar con la base 3a1 activa.
-- Reemplaza escudo_epoca de Commons por el archivo local aportado por el dueño.
-- ============================================================
USE `3a1`;

-- Argentinos Juniors 1984-85.webp
-- temporadas: Argentinos Juniors 1984/85
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/argentinos-juniors-1984-85.webp'
WHERE c.nombre = 'Argentinos Juniors'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1984);

-- Argentinos Juniors 2009-2010.webp
-- temporadas: Argentinos Juniors 2009/10 Clausura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/argentinos-juniors-2009-2010.webp'
WHERE c.nombre = 'Argentinos Juniors'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2009);

-- Arsenal de Sarandí 2011-2012.webp
-- temporadas: Arsenal 2011/12 Clausura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/arsenal-de-sarandi-2011-2012.webp'
WHERE c.nombre = 'Arsenal'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2011);

-- Banfield 2009-2010.webp
-- temporadas: Banfield 2009/10 Apertura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/banfield-2009-2010.webp'
WHERE c.nombre = 'Banfield'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2009);

-- Belgrano 2026.webp
-- temporadas: Belgrano 2026
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/belgrano-2026.webp'
WHERE c.nombre = 'Belgrano'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2026);

-- Boca 1962-1964-1969-1970-1976-1981-1992.webp
-- temporadas: Boca 1962; Boca 1964/65; Boca 1969 Nacional; Boca 1970 Nacional; Boca 1976 Metro + Nacional; Boca 1981; Boca 1992/93 Apertura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/boca-1962-1964-1969-1970-1976-1981-1992.webp'
WHERE c.nombre = 'Boca'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1962, 1964, 1969, 1970, 1976, 1981, 1992);

-- Boca 1998-2000-2003-2005-2008-2011-2015-2016-2019-2022.webp
-- temporadas: Boca 1998/99 Apertura + Clausura; Boca 2000/01 Apertura; Boca 2003/04 Apertura; Boca 2005/06 Apertura + Clausura; Boca 2008/09 Apertura; Boca 2011/12 Apertura; Boca 2015; Boca 2016/17 + 2017/18; Boca 2019/20; Boca 2022
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/boca-1998-2000-2003-2005-2008-2011-2015-2016-2019-2022.webp'
WHERE c.nombre = 'Boca'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1998, 2000, 2003, 2005, 2008, 2011, 2015, 2016, 2019, 2022);

-- Chacarita 1969.webp
-- temporadas: Chacarita 1969 Metro
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/chacarita-1969.webp'
WHERE c.nombre = 'Chacarita'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1969);

-- Estudiantes 1967.webp
-- temporadas: Estudiantes 1967 Metro
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/estudiantes-1967.webp'
WHERE c.nombre = 'Estudiantes'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1967);

-- Estudiantes 1982-1983.webp
-- temporadas: Estudiantes 1982; Estudiantes 1983 Nacional
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/estudiantes-1982-1983.webp'
WHERE c.nombre = 'Estudiantes'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1982, 1983);

-- Estudiantes 2006-2010.webp
-- temporadas: Estudiantes 2006/07 Apertura; Estudiantes 2010/11 Apertura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/estudiantes-2006-2010.webp'
WHERE c.nombre = 'Estudiantes'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2006, 2010);

-- Estudiantes 2024-2025.jpg
-- temporadas: Estudiantes 2024; Estudiantes 2025
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/estudiantes-2024-2025.webp'
WHERE c.nombre = 'Estudiantes'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2024, 2025);

-- Ferro 1982-1984.avif
-- temporadas: Ferro 1982 Nacional; Ferro 1984 Nacional
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/ferro-1982-1984.webp'
WHERE c.nombre = 'Ferro'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1982, 1984);

-- Huracán 1973.webp
-- temporadas: Huracán 1973 Metro
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/huracan-1973.webp'
WHERE c.nombre = 'Huracán'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1973);

-- Independiente 1960-1963-1967-1970-1971.webp
-- temporadas: Independiente 1960; Independiente 1963; Independiente 1967 Nacional; Independiente 1970 Metro; Independiente 1971 Metro
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/independiente-1960-1963-1967-1970-1971.webp'
WHERE c.nombre = 'Independiente'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1960, 1963, 1967, 1970, 1971);

-- Independiente 1977-1978.webp
-- temporadas: Independiente 1977 Nacional; Independiente 1978 Nacional
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/independiente-1977-1978.webp'
WHERE c.nombre = 'Independiente'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1977, 1978);

-- Independiente 1983.webp
-- temporadas: Independiente 1983
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/independiente-1983.webp'
WHERE c.nombre = 'Independiente'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1983);

-- Independiente 1988.webp
-- temporadas: Independiente 1988/89
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/independiente-1988.webp'
WHERE c.nombre = 'Independiente'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1988);

-- Independiente 1993.webp
-- temporadas: Independiente 1993/94 Clausura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/independiente-1993.webp'
WHERE c.nombre = 'Independiente'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1993);

-- Independiente 2002.webp
-- temporadas: Independiente 2002/03 Apertura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/independiente-2002.webp'
WHERE c.nombre = 'Independiente'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2002);

-- Lanús 2007.webp
-- temporadas: Lanús 2007/08 Apertura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/lanus-2007.webp'
WHERE c.nombre = 'Lanús'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2007);

-- Lanús 2016.webp
-- temporadas: Lanús 2016
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/lanus-2016.webp'
WHERE c.nombre = 'Lanús'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2016);

-- Newells 1974-1987.webp
-- temporadas: Newell’s 1974 Metro; Newell’s 1987/88
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/newells-1974-1987.webp'
WHERE c.nombre = 'Newell’s'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1974, 1987);

-- Newells 1990-1991.webp
-- temporadas: Newell’s 1990/91; Newell’s 1991/92 Clausura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/newells-1990-1991.webp'
WHERE c.nombre = 'Newell’s'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1990, 1991);

-- Newells 2004-2012.webp
-- temporadas: Newell’s 2004/05 Apertura; Newell’s 2012/13 Final
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/newells-2004-2012.webp'
WHERE c.nombre = 'Newell’s'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2004, 2012);

-- Platense 2025.webp
-- temporadas: Platense 2025
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/platense-2025.webp'
WHERE c.nombre = 'Platense'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2025);

-- Quilmes 1978.webp
-- temporadas: Quilmes 1978 Metro
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/quilmes-1978.webp'
WHERE c.nombre = 'Quilmes'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1978);

-- Racing 1961-1966.webp
-- temporadas: Racing 1961; Racing 1966
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/racing-1961-1966.webp'
WHERE c.nombre = 'Racing'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1961, 1966);

-- Racing 2001.webp
-- temporadas: Racing 2001/02 Apertura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/racing-2001.webp'
WHERE c.nombre = 'Racing'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2001);

-- Racing 2014-2018.webp
-- temporadas: Racing 2014; Racing 2018/19
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/racing-2014-2018.webp'
WHERE c.nombre = 'Racing'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2014, 2018);

-- Rosario Central 1971.webp
-- temporadas: Rosario Central 1971 Nacional
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/rosario-central-1971.webp'
WHERE c.nombre = 'Rosario Central'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1971);

-- Rosario Central 1973-1986.webp
-- temporadas: Rosario Central 1973 Nacional; Rosario Central 1980 Nacional; Rosario Central 1986/87
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/rosario-central-1973-1986.webp'
WHERE c.nombre = 'Rosario Central'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1973, 1980, 1986);

-- San Lorenzo 1968-1972-1974-1994.webp
-- temporadas: San Lorenzo 1968 Metro; San Lorenzo 1972 Metro + Nacional; San Lorenzo 1974 Nacional; San Lorenzo 1994/95 Clausura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/san-lorenzo-1968-1972-1974-1994.webp'
WHERE c.nombre = 'San Lorenzo'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1968, 1972, 1974, 1994);

-- San Lorenzo 2001-2002.webp
-- temporadas: San Lorenzo 2000/01 Clausura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/san-lorenzo-2001-2002.webp'
WHERE c.nombre = 'San Lorenzo'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2000);

-- San Lorenzo 2006-2013.jpg
-- temporadas: San Lorenzo 2006/07 Clausura; San Lorenzo 2013/14 Inicial
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/san-lorenzo-2006-2013.webp'
WHERE c.nombre = 'San Lorenzo'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2006, 2013);

-- Velez 1968.webp
-- temporadas: Vélez 1968 Nacional
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/velez-1968.webp'
WHERE c.nombre = 'Vélez'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1968);

-- Velez 1992.webp
-- temporadas: Vélez 1992/93 Clausura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/velez-1992.webp'
WHERE c.nombre = 'Vélez'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1992);

-- Velez 1995-1997.webp
-- temporadas: Vélez 1995/96 Apertura + Clausura; Vélez 1997/98 Clausura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/velez-1995-1997.webp'
WHERE c.nombre = 'Vélez'
  AND c.es_river = FALSE
  AND t.anio_orden IN (1995, 1997);

-- Velez 2004-2008.webp
-- temporadas: Vélez 2004/05 Clausura; Vélez 2008/09 Clausura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/velez-2004-2008.webp'
WHERE c.nombre = 'Vélez'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2004, 2008);

-- Velez 2010.webp
-- temporadas: Vélez 2010/11 Clausura
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/velez-2010.webp'
WHERE c.nombre = 'Vélez'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2010);

-- Velez 2012.webp
-- temporadas: Vélez 2012/13 Inicial + Campeonato
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/velez-2012.webp'
WHERE c.nombre = 'Vélez'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2012);

-- Velez 2021.webp
-- temporadas: Vélez 2024
UPDATE temporadas t
JOIN clubes c ON c.id = t.club_id
SET t.escudo_epoca = '/escudos/velez-2021.webp'
WHERE c.nombre = 'Vélez'
  AND c.es_river = FALSE
  AND t.anio_orden IN (2024);

