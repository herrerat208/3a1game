-- 3A1 — Migración dorsal elegido por el usuario.
-- Correr UNA vez en phpMyAdmin (base 3a1) si la base ya existía.
-- (schema.sql ya lo trae para instalaciones nuevas.)
USE `3a1`;
ALTER TABLE partida_jugadores
  ADD COLUMN dorsal INT NULL
  COMMENT 'Dorsal elegido por el usuario (1-99, único por partida)';
ALTER TABLE partida_jugadores
  ADD UNIQUE KEY `uq_partida_dorsal` (partida_id, dorsal);
