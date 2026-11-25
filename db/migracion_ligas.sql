-- 3A1 — Migración Fase 0 (ligas): modo/formato, torneos, calendario, sanciones.
-- Correr UNA vez en phpMyAdmin (base 3a1) si la base ya existía.
-- (schema.sql ya lo trae para instalaciones nuevas.)
USE `3a1`;

ALTER TABLE partidas
  ADD COLUMN IF NOT EXISTS `modo` VARCHAR(10) NOT NULL DEFAULT 'copa'
  COMMENT 'copa | liga' AFTER `estilo`;
ALTER TABLE partidas
  ADD COLUMN IF NOT EXISTS `formato` VARCHAR(10) NOT NULL DEFAULT 'copa'
  COMMENT 'copa | premier | liga30' AFTER `modo`;

ALTER TABLE clubes
  ADD COLUMN IF NOT EXISTS `escudo` VARCHAR(255) NULL
  COMMENT 'PNG del escudo (scripts/enriquecer_escudos.php)';

CREATE TABLE IF NOT EXISTS torneos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partida_id INT NOT NULL,
  formato VARCHAR(10) NOT NULL COMMENT 'copa | premier | liga30',
  fecha_actual INT NOT NULL DEFAULT 0,
  estado VARCHAR(12) NOT NULL DEFAULT 'armado' COMMENT 'armado | curso | finalizado',
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
