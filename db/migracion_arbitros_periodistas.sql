-- ============================================================
-- Árbitros, periodistas e hinchas reales (solo narrativa)
-- ============================================================
-- Nombres aportados por el dueño del producto. Se usan únicamente para
-- la previa, el relato y el diario: NO alteran resultados, tarjetas,
-- estadísticas ni ratings.
--
-- Ejecutar DESPUÉS de db/schema.sql, db/pool_completo.sql y el resto de
-- migraciones. Estas tres tablas pertenecen a esta feature, por lo que
-- se reconstruyen completas para que la instalación quede siempre igual
-- a la lista vigente (no contienen datos del usuario).
--
-- "Con preferencia" = se muestran más seguido cuando juega su equipo.
-- "Solo River" = se usan únicamente en narrativa de River (solo_river = 1).
--
-- IMPORTANTE: si se aplica desde mysql.exe, usar --default-character-set=utf8mb4
-- para que los acentos no se guarden con mojibake. Desde phpMyAdmin no hace falta.

DROP TABLE IF EXISTS arbitros;
DROP TABLE IF EXISTS periodistas;
DROP TABLE IF EXISTS hinchas;

CREATE TABLE arbitros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_arbitros_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE periodistas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  medio VARCHAR(160) NULL,
  equipo_preferido VARCHAR(60) NULL,
  solo_river TINYINT(1) NOT NULL DEFAULT 0,
  es_streamer TINYINT(1) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_periodistas_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hinchas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  equipo VARCHAR(60) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_hinchas_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Árbitros
-- ============================================================
INSERT INTO arbitros (nombre) VALUES
  ('Darío Herrera'),
  ('Nazareno Arasa'),
  ('Yael Falcón Pérez'),
  ('Luis Lobo Medina'),
  ('Leandro Rey Hilfer'),
  ('Andrés Merlos'),
  ('Nicolás Ramírez'),
  ('Pablo Dóvalo'),
  ('Pablo Echavarría'),
  ('Sebastián Zunino'),
  ('Hernán Mastrángelo'),
  ('Carlos Gariano'),
  ('Sebastián Martínez'),
  ('Bruno Amiconi'),
  ('Fernando Echenique'),
  ('Nicolás Lamolina'),
  ('Ariel Penel'),
  ('Facundo Tello'),
  ('Fernando Espinoza'),
  ('Jorge Baliño'),
  ('Juan Pafundi'),
  ('Felipe Viola'),
  ('Bryan Ferreyra'),
  ('Álvaro Carranza'),
  ('Daniel Zamora'),
  ('Maximiliano Macheroni'),
  ('Gonzalo Pereira'),
  ('Juan Pablo Loustau');

-- ============================================================
-- Periodistas
-- ============================================================
INSERT INTO periodistas (nombre, equipo_preferido, solo_river, es_streamer) VALUES
  ('Sebastián Vignolo', NULL, 0, 0),
  ('Diego Latorre', NULL, 0, 0),
  ('Mariano Closs', NULL, 0, 0),
  ('Juan Pablo Varsky', NULL, 0, 0),
  ('Miguel Simón', NULL, 0, 0),
  ('Gustavo López', NULL, 0, 0),
  ('Morena Beltrán', NULL, 0, 0),
  ('Gastón Edul', NULL, 0, 0),
  ('Horacio Pagani', NULL, 0, 0),
  ('Pablo Giralt', NULL, 0, 0),
  ('Nicolás Distasio', NULL, 1, 1),
  ('RiverLPM', NULL, 1, 1);

-- ============================================================
-- Streamers / periodistas con preferencia de equipo
-- ============================================================
INSERT INTO periodistas (nombre, equipo_preferido, solo_river, es_streamer) VALUES
  ('DavoXeneixe', 'Boca', 0, 1),
  ('La Cobra', 'Boca', 0, 1),
  ('Mateo Zawlesky', 'River', 0, 1),
  ('BenitoSDR', 'River', 0, 1),
  ('Flavio Azzaro', 'Racing', 0, 1),
  ('Diego Yudcovsky', 'Boca', 0, 1),
  ('Sensei', 'River', 0, 1);

-- ============================================================
-- Hinchas
-- ============================================================
INSERT INTO hinchas (nombre, equipo) VALUES
  ('Francoriverplatense', 'River'),
  ('FrankoBonetto', 'River'),
  ('Matias Castillo', 'Boca'),
  ('Facundo Alessandri', 'River'),
  ('Tincho Duella', 'River'),
  ('Kai', 'Boca'),
  ('Leandro Germán Leguizamón', 'River');
