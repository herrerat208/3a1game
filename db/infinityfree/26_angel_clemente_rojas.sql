-- Foto de Ángel Clemente Rojas (Boca), derivada de db/fotos_rojas_2026.sql.
-- Identifica las filas por nombre + etiqueta: los ids autoincrementales no
-- coinciden entre XAMPP y el hosting.
USE `if0_43478740_3a1`;

UPDATE temporada_jugadores tj
JOIN jugadores j ON j.id = tj.jugador_id
JOIN temporadas t ON t.id = tj.temporada_id
SET tj.foto_epoca = '/jugadores/rivales/angel-clemente-rojas-boca.webp',
    tj.foto_fuente = 'Angel Clemente Rojas-Boca.jpg',
    tj.foto_anio = 1964
WHERE j.nombre = 'Ángel Clemente Rojas' AND t.etiqueta = 'Boca 1964/65';

UPDATE temporada_jugadores tj
JOIN jugadores j ON j.id = tj.jugador_id
JOIN temporadas t ON t.id = tj.temporada_id
SET tj.foto_epoca = '/jugadores/rivales/angel-clemente-rojas-boca.webp',
    tj.foto_fuente = 'Angel Clemente Rojas-Boca.jpg',
    tj.foto_anio = 1969
WHERE j.nombre = 'Ángel Clemente Rojas' AND t.etiqueta = 'Boca 1969 Nacional';
