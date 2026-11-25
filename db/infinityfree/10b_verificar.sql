-- Verificación de 10a/10 en UNA SOLA consulta. El helper de InfinityFree
-- falla con error 2014 si un archivo tiene más de un SELECT (PDO sin buffer).
-- Ejecutar antes y después de 10_fotos_y_depuracion.sql.
USE `if0_43478740_3a1`;
SELECT
  (SELECT COUNT(*) FROM backup_20261124_temporada_jugadores) AS backup_participaciones,
  (SELECT COUNT(*) FROM backup_20261124_jugadores) AS backup_jugadores,
  (SELECT COUNT(*) FROM backup_20261124_fotos) AS backup_fotos,
  (SELECT COUNT(*) FROM temporada_jugadores tj
     JOIN jugadores j ON j.id = tj.jugador_id
    WHERE j.nombre IN ('Alberto Gallardo', 'Ángel Commisso', 'Gustavo Salvador',
                       'Máximo Lucas', 'Miguel Ángel Guzmán', 'Recaredo Fernández')
  ) AS participaciones_actuales,
  (SELECT COUNT(*) FROM jugadores
    WHERE nombre IN ('Alberto Gallardo', 'Ángel Commisso', 'Gustavo Salvador',
                     'Máximo Lucas', 'Miguel Ángel Guzmán', 'Recaredo Fernández')
  ) AS jugadores_actuales,
  (SELECT COUNT(*) FROM jugadores
    WHERE nombre IN ('Enrique Fernández', 'Mílton Alves da Silva',
                     'Fabián Basualdo', 'Ignacio Fernández', 'Leandro González Pírez',
                     'Lucas Martínez Quarta', 'Sebastián Driussi', 'Víctor Zapata')
      AND foto_url LIKE '/jugadores/%'
  ) AS fotos_aplicadas;
