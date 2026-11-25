-- 3A1 — Migración cierre de torneo: resultado persistido (campeón / valla).
-- Correr UNA vez en phpMyAdmin (base 3a1) si la base ya existía.
-- (schema.sql ya lo trae para instalaciones nuevas.)
-- Sin esto, ranking/historial siguen funcionando con el fallback por calendario,
-- pero el resultado del torneo no queda guardado de forma explícita.
USE `3a1`;

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS `campeon` BOOLEAN NULL
  COMMENT 'NULL = sin cerrar; 1/0 = el usuario salió campeón' AFTER `estado`;
ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS `valla` BOOLEAN NULL
  COMMENT '1 = campeón con el arco en cero' AFTER `campeon`;
