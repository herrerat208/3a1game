-- 3A1 — Fotos de época: cada participación puede tener su foto del año
-- (El Gráfico, etc.). jugadores.foto_url queda como fallback sin año.
-- Correr en phpMyAdmin (base 3a1). Idempotente.
USE `3a1`;

ALTER TABLE temporada_jugadores
  ADD COLUMN IF NOT EXISTS `foto_epoca` VARCHAR(255) NULL
  COMMENT 'Foto de ESE año (scripts/enriquecer_epoca.php)' AFTER `dorsal`;
ALTER TABLE temporada_jugadores
  ADD COLUMN IF NOT EXISTS `foto_fuente` VARCHAR(255) NULL
  COMMENT 'Título del archivo en Commons (auditoría)' AFTER `foto_epoca`;
ALTER TABLE temporada_jugadores
  ADD COLUMN IF NOT EXISTS `foto_anio` INT NULL
  COMMENT 'Año real de la foto (puede diferir ±1 del anio_orden)' AFTER `foto_fuente`;

ALTER TABLE temporadas
  ADD COLUMN IF NOT EXISTS `escudo_epoca` VARCHAR(255) NULL
  COMMENT 'Escudo de ESE año (stretch Tanda 1)' AFTER `ovr_equipo`;
