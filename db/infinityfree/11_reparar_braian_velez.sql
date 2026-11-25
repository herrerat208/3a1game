-- Braian Romero debe figurar como DC de Vélez 2024. La fusión histórica de
-- "Brian Romero" / "Braian Romero" (03_correcciones_nombres.sql) dejó su
-- participación de Vélez fuera de la base en producción; River 2021 sí lo
-- conserva con el avatar local. Este archivo es idempotente: el UNIQUE
-- (temporada_id, jugador_id) evita duplicarlo si ya estuviera presente.
USE `if0_43478740_3a1`;

INSERT IGNORE INTO temporada_jugadores
  (temporada_id, jugador_id, posicion_natural, posiciones_secundarias,
   ovr_base, es_estrella, es_mvp)
SELECT t.id, j.id, 'DC', '', 82, TRUE, FALSE
FROM temporadas t
JOIN clubes c ON c.id = t.club_id
JOIN jugadores j ON j.nombre = 'Braian Romero'
WHERE c.nombre = 'Vélez' AND t.etiqueta = 'Vélez 2024';

-- Misma foto de época que asigna 08_fotos_rivales.sql, sin tocar la de River.
UPDATE temporada_jugadores tj
JOIN jugadores j ON j.id = tj.jugador_id
JOIN temporadas t ON t.id = tj.temporada_id
SET tj.foto_epoca = '/jugadores/rivales/braian-romero-velez.webp',
    tj.foto_fuente = 'Braian Romero-Velez.jfif',
    tj.foto_anio = 2024
WHERE j.nombre = 'Braian Romero' AND t.etiqueta = 'Vélez 2024';
