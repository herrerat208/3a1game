-- ============================================================
-- 3A1 — Repara partidos guardados con la localía invertida.
-- El simulador devuelve goles desde la perspectiva del usuario;
-- calendario.gf/gc esperan goles del local/visita. Hasta el fix,
-- los partidos que el usuario jugaba DE VISITANTE se guardaban al revés.
-- Solo toca partidos del usuario con detalle de goleadores, nunca
-- partidos simulados entre rivales.
-- Sin CREATE TEMPORARY TABLE (InfinityFree no da ese permiso).
-- IDEMPOTENTE: guarda los valores originales y solo vuelve a swapear
-- si la fila sigue teniendo los valores anteriores al arreglo.
-- ============================================================
USE `3a1`;

CREATE TABLE IF NOT EXISTS reparaciones_localia_v2 (
  calendario_id INT NOT NULL PRIMARY KEY,
  gf_antes INT NOT NULL,
  gc_antes INT NOT NULL,
  reparado_en DATETIME NOT NULL
);

INSERT INTO reparaciones_localia_v2 (calendario_id, gf_antes, gc_antes, reparado_en)
SELECT DISTINCT cal.id, cal.gf, cal.gc, NOW()
FROM calendario cal
JOIN torneos tor ON tor.id = cal.torneo_id
JOIN torneo_equipos teu ON teu.torneo_id = tor.id AND teu.es_usuario = 1
WHERE cal.jugado
  AND cal.visita_id = teu.id
  AND cal.detalle LIKE '%goleadoresRival%'
  AND NOT EXISTS (
    SELECT 1 FROM reparaciones_localia_v2 r WHERE r.calendario_id = cal.id
  );

UPDATE calendario cal
JOIN reparaciones_localia_v2 r ON r.calendario_id = cal.id
SET cal.gf = r.gc_antes, cal.gc = r.gf_antes
WHERE cal.gf = r.gf_antes AND cal.gc = r.gc_antes;

SELECT COUNT(*) AS partidos_reparados FROM reparaciones_localia_v2;
