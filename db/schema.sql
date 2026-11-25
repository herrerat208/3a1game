-- ============================================================
-- 3A1 (Kouvah Sports) — Base de datos MySQL
-- DB: 3a1 (mantiene el nombre que ya usa htdocs/3a1-api/conexion.php)
-- Modelo adaptado de la consigna: clubes=selecciones,
-- temporadas=planteles (club+anio), temporada_jugadores=plantel_jugadores
-- DER completo en DER.md
-- ============================================================
CREATE DATABASE IF NOT EXISTS `3a1`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `3a1`;

-- ---- Catálogos ----
CREATE TABLE IF NOT EXISTS clubes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  es_river BOOLEAN NOT NULL DEFAULT FALSE,
  escudo VARCHAR(255) NULL COMMENT 'PNG del escudo (scripts/enriquecer_escudos.php)'
);

CREATE TABLE IF NOT EXISTS tecnicos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE
);

-- Una temporada = un club en un año (equivale a "plantel" de la consigna).
-- UNIQUE por (club, etiqueta) y no (club, anio): hay Metro+Nacional del
-- mismo club y anio (Estudiantes 1982 / 1982 Nacional, etc.).
CREATE TABLE IF NOT EXISTS temporadas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  anio_orden INT NOT NULL,
  etiqueta VARCHAR(80) NOT NULL,
  formacion VARCHAR(20) NOT NULL,
  ovr_equipo INT NULL,
  escudo_epoca VARCHAR(255) NULL COMMENT 'Escudo de ESE año (stretch Tanda 1)',
  campeon BOOLEAN NOT NULL DEFAULT FALSE,
  tecnico_id INT NULL,
  UNIQUE KEY `uq_temp_club_etiqueta` (club_id, etiqueta),
  FOREIGN KEY (club_id) REFERENCES clubes(id),
  FOREIGN KEY (tecnico_id) REFERENCES tecnicos(id)
);

CREATE TABLE IF NOT EXISTS jugadores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  foto_url VARCHAR(255) NULL COMMENT 'Pendiente: completar vía API lahistoriariver.com'
);

-- Relación jugador <-> temporada con datos deportivos del juego.
-- posiciones_secundarias: CSV sin espacios ('LD,MI') o '' si no aplica.
-- Rivales no traen secundaria en docs -> ''.
CREATE TABLE IF NOT EXISTS temporada_jugadores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  temporada_id INT NOT NULL,
  jugador_id INT NOT NULL,
  posicion_natural VARCHAR(10) NOT NULL,
  posiciones_secundarias VARCHAR(50) NOT NULL DEFAULT '',
  ovr_base INT NOT NULL,
  es_estrella BOOLEAN NOT NULL DEFAULT FALSE,
  es_mvp BOOLEAN NOT NULL DEFAULT FALSE,
  dorsal INT NULL COMMENT 'Pendiente: completar vía API lahistoriariver.com',
  foto_epoca VARCHAR(255) NULL COMMENT 'Foto de ESE año (scripts/enriquecer_epoca.php)',
  foto_fuente VARCHAR(255) NULL COMMENT 'Título del archivo en Commons (auditoría)',
  foto_anio INT NULL COMMENT 'Año real de la foto (±1 del anio_orden)',
  UNIQUE (temporada_id, jugador_id),
  FOREIGN KEY (temporada_id) REFERENCES temporadas(id),
  FOREIGN KEY (jugador_id) REFERENCES jugadores(id)
);

-- ---- Partida (lo que ocurre cuando alguien juega) ----
CREATE TABLE IF NOT EXISTS partidas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre_equipo VARCHAR(80) NOT NULL,
  formacion VARCHAR(20) NOT NULL,
  estilo VARCHAR(20) NOT NULL DEFAULT 'equilibrado',
  modo VARCHAR(10) NOT NULL DEFAULT 'copa' COMMENT 'copa | liga',
  formato VARCHAR(10) NOT NULL DEFAULT 'copa' COMMENT 'copa | premier | liga30',
  fecha_inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partida_jugadores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partida_id INT NOT NULL,
  temporada_jugador_id INT NOT NULL,
  slot VARCHAR(10) NOT NULL COMMENT 'XI de la formación + SUP1..SUP8 (banco, sin validación posicional)',
  dorsal INT NULL COMMENT 'Dorsal elegido por el usuario (1-99, único por partida)',
  UNIQUE (partida_id, slot),
  UNIQUE (partida_id, temporada_jugador_id),
  UNIQUE (partida_id, dorsal),
  FOREIGN KEY (partida_id) REFERENCES partidas(id),
  FOREIGN KEY (temporada_jugador_id) REFERENCES temporada_jugadores(id)
);

CREATE TABLE IF NOT EXISTS resultados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partida_id INT NOT NULL,
  ronda VARCHAR(30) NOT NULL,
  rival VARCHAR(80) NOT NULL,
  goles_favor INT NOT NULL,
  goles_contra INT NOT NULL,
  avanzo BOOLEAN NOT NULL DEFAULT TRUE,
  detalle TEXT NULL COMMENT 'JSON: goleadores y tanda de penales',
  amistoso BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'revancha: no suma logros/ranking',
  FOREIGN KEY (partida_id) REFERENCES partidas(id)
);

CREATE TABLE IF NOT EXISTS logros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partida_id INT NOT NULL,
  codigo VARCHAR(40) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (partida_id, codigo),
  FOREIGN KEY (partida_id) REFERENCES partidas(id)
);

-- ---- Ligas (Fase 0): torneos, participantes, fixture y sanciones ----
CREATE TABLE IF NOT EXISTS torneos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partida_id INT NOT NULL,
  formato VARCHAR(10) NOT NULL COMMENT 'copa | premier | liga30',
  fecha_actual INT NOT NULL DEFAULT 0,
  estado VARCHAR(12) NOT NULL DEFAULT 'armado' COMMENT 'armado | curso | finalizado',
  campeon BOOLEAN NULL COMMENT 'NULL = sin cerrar; 1/0 = el usuario salió campeón',
  valla BOOLEAN NULL COMMENT '1 = campeón con el arco en cero',
  UNIQUE KEY `uq_torneo_partida` (partida_id),
  FOREIGN KEY (partida_id) REFERENCES partidas(id)
);

CREATE TABLE IF NOT EXISTS torneo_equipos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  torneo_id INT NOT NULL,
  -- NULL = equipo del usuario (no es una temporada del catálogo).
  temporada_id INT NULL,
  zona VARCHAR(2) NULL COMMENT 'A/B en liga30, A-H en copa, NULL en premier',
  es_usuario BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY `uq_torneo_temp` (torneo_id, temporada_id),
  FOREIGN KEY (torneo_id) REFERENCES torneos(id),
  FOREIGN KEY (temporada_id) REFERENCES temporadas(id)
);

CREATE TABLE IF NOT EXISTS calendario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  torneo_id INT NOT NULL,
  fecha_n INT NOT NULL,
  fase VARCHAR(20) NOT NULL DEFAULT 'liga' COMMENT 'grupo | octavos | cuartos | semi | final | liga',
  local_id INT NOT NULL COMMENT 'torneo_equipos.id',
  visita_id INT NOT NULL COMMENT 'torneo_equipos.id',
  gf INT NULL,
  gc INT NULL,
  jugado BOOLEAN NOT NULL DEFAULT FALSE,
  detalle TEXT NULL COMMENT 'JSON: goleadores+asistencias, tanda, tarjetas',
  FOREIGN KEY (torneo_id) REFERENCES torneos(id),
  CONSTRAINT `fk_cal_local` FOREIGN KEY (local_id) REFERENCES torneo_equipos(id),
  CONSTRAINT `fk_cal_visita` FOREIGN KEY (visita_id) REFERENCES torneo_equipos(id)
);

CREATE TABLE IF NOT EXISTS sanciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  torneo_id INT NOT NULL,
  temporada_jugador_id INT NOT NULL,
  amarillas INT NOT NULL DEFAULT 0,
  roja BOOLEAN NOT NULL DEFAULT FALSE,
  suspendido_hasta_fecha INT NOT NULL DEFAULT 0,
  UNIQUE KEY `uq_sancion` (torneo_id, temporada_jugador_id),
  FOREIGN KEY (torneo_id) REFERENCES torneos(id),
  FOREIGN KEY (temporada_jugador_id) REFERENCES temporada_jugadores(id)
);

-- ============================================================
-- DATOS DE PRUEBA: 3 planteles completos reales (docs/*.docx)
-- River 2018 (4-1-4-1) CAMPEON OVR 87 DT Gallardo (11)
-- River 2021 (4-4-2)   CAMPEON OVR 85 DT Gallardo (11)
-- Boca  1962 (4-2-4)   CAMPEON OVR 86 (11, sin DT en docs)
-- Reglas bonus: River +1 campeon, +2 estrella/+3 MVP (en anio campeon);
-- Rivales (todos campeones): +1 estrella / +2 MVP ya incluidos.
-- OVR final se CALCULA en SQL/PHP, no se almacena (ver jugadores.php).
-- ============================================================
INSERT INTO clubes (id, nombre, es_river) VALUES
(1, 'River Plate', TRUE),
(2, 'Boca Juniors', FALSE)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

INSERT INTO tecnicos (id, nombre) VALUES
(1, 'Marcelo Gallardo')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

INSERT INTO temporadas (id, club_id, anio_orden, etiqueta, formacion, ovr_equipo, campeon, tecnico_id) VALUES
(1, 1, 2018, 'River 2018', '4-1-4-1', 87, TRUE, 1),
(2, 1, 2021, 'River 2021', '4-4-2', 85, TRUE, 1),
(3, 2, 1962, 'Boca 1962', '4-2-4', 86, TRUE, NULL)
ON DUPLICATE KEY UPDATE etiqueta = VALUES(etiqueta);

INSERT INTO jugadores (id, nombre) VALUES
(1, 'Franco Armani'),
(2, 'Gonzalo Montiel'),
(3, 'Jonatan Maidana'),
(4, 'Javier Pinola'),
(5, 'Milton Casco'),
(6, 'Leonardo Ponzio'),
(7, 'Enzo Pérez'),
(8, 'Exequiel Palacios'),
(9, 'Juan Fernando Quintero'),
(10, 'Gonzalo Martínez'),
(11, 'Lucas Pratto'),
(12, 'Robert Rojas'),
(13, 'Paulo Díaz'),
(14, 'David Martínez'),
(15, 'Santiago Simón'),
(16, 'Enzo Fernández'),
(17, 'Agustín Palavecino'),
(18, 'Braian Romero'),
(19, 'Julián Álvarez'),
(20, 'Antonio Roma'),
(21, 'Carmelo Simeone'),
(22, 'José Silvero'),
(23, 'Orlando Peçanha de Carvalho'),
(24, 'Silvio Marzolini'),
(25, 'Antonio Ubaldo Rattín'),
(26, 'Ernesto Grillo'),
(27, 'Juan Carlos Pueblas'),
(28, 'Norberto Menéndez'),
(29, 'Paulo Valentim'),
(30, 'Alberto Mario González')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- River 2018 (temporada 1)
INSERT INTO temporada_jugadores
(temporada_id, jugador_id, posicion_natural, posiciones_secundarias, ovr_base, es_estrella, es_mvp) VALUES
(1, 1, 'ARQ', '', 88, FALSE, TRUE),
(1, 2, 'LD', 'DFC', 84, FALSE, FALSE),
(1, 3, 'DFC', '', 85, FALSE, FALSE),
(1, 4, 'DFC', 'LI', 85, FALSE, FALSE),
(1, 5, 'LI', 'LD,MI', 84, FALSE, FALSE),
(1, 6, 'MC', 'MCD', 85, FALSE, FALSE),
(1, 7, 'MCD', 'MC', 85, FALSE, FALSE),
(1, 8, 'MC', 'MCD', 85, FALSE, FALSE),
(1, 9, 'MD', 'MCO,ED', 86, FALSE, FALSE),
(1, 10, 'MI', 'MCO', 86, TRUE, FALSE),
(1, 11, 'DC', '', 86, TRUE, FALSE);

-- River 2021 (temporada 2)
INSERT INTO temporada_jugadores
(temporada_id, jugador_id, posicion_natural, posiciones_secundarias, ovr_base, es_estrella, es_mvp) VALUES
(2, 1, 'ARQ', '', 85, FALSE, FALSE),
(2, 12, 'LD', 'DFC', 82, FALSE, FALSE),
(2, 13, 'DFC', '', 83, FALSE, FALSE),
(2, 14, 'DFC', 'LI', 82, FALSE, FALSE),
(2, 5, 'LI', 'LD,MD', 83, FALSE, FALSE),
(2, 15, 'MD', 'MC', 82, FALSE, FALSE),
(2, 7, 'MC', 'MCD,ARQ', 85, TRUE, FALSE),
(2, 16, 'MC', 'MCD,MCO', 85, TRUE, FALSE),
(2, 17, 'MI', 'MC,MCO', 82, FALSE, FALSE),
(2, 18, 'DC', 'ED', 82, FALSE, FALSE),
(2, 19, 'DC', 'MCO,EI', 87, FALSE, TRUE);

-- Boca 1962 (temporada 3, rival: sin secundaria en docs)
INSERT INTO temporada_jugadores
(temporada_id, jugador_id, posicion_natural, posiciones_secundarias, ovr_base, es_estrella, es_mvp) VALUES
(3, 20, 'ARQ', '', 86, TRUE, FALSE),
(3, 21, 'LD', '', 83, FALSE, FALSE),
(3, 22, 'DFC', '', 80, FALSE, FALSE),
(3, 23, 'DFC', '', 84, FALSE, FALSE),
(3, 24, 'LI', '', 88, TRUE, FALSE),
(3, 25, 'MC', '', 89, FALSE, TRUE),
(3, 26, 'MC', '', 84, FALSE, FALSE),
(3, 27, 'ED', '', 84, FALSE, FALSE),
(3, 28, 'DC', '', 82, FALSE, FALSE),
(3, 29, 'DC', '', 84, FALSE, FALSE),
(3, 30, 'EI', '', 85, FALSE, FALSE);
