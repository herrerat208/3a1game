-- 3A1 — Sistema conectado: juegos, usuarios y resultados guardados en base.
-- Se puede aplicar las veces que haga falta: cada ADD se saltea si ya existe.
-- No editar a mano los SQL generados; este sí es de autoría del proyecto.

CREATE TABLE IF NOT EXISTS juegos (
  id INT NOT NULL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  activo TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO juegos (id, nombre, activo) VALUES
  (3, '3A1 · Draft histórico', 1),
  (4, '3A1 · Demo vacío', 1)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), activo = VALUES(activo);

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alias VARCHAR(40) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('jugador', 'admin') NOT NULL DEFAULT 'jugador',
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- helpers: ALTER condicional por columna / índice / restricción.
-- fecha_registro la pone el servidor, nunca el navegador.
SET @col = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE partidas ADD COLUMN usuario_id INT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partidas' AND COLUMN_NAME = 'usuario_id');
PREPARE st FROM @col; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE partidas ADD COLUMN juego_id INT NOT NULL DEFAULT 3', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partidas' AND COLUMN_NAME = 'juego_id');
PREPARE st FROM @col; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE partidas ADD COLUMN puntos INT NOT NULL DEFAULT 0', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partidas' AND COLUMN_NAME = 'puntos');
PREPARE st FROM @col; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE partidas ADD COLUMN duracion_segundos INT NULL', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partidas' AND COLUMN_NAME = 'duracion_segundos');
PREPARE st FROM @col; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE partidas ADD COLUMN fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partidas' AND COLUMN_NAME = 'fecha_registro');
PREPARE st FROM @col; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE partidas ADD COLUMN activo TINYINT NOT NULL DEFAULT 1', 'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partidas' AND COLUMN_NAME = 'activo');
PREPARE st FROM @col; EXECUTE st; DEALLOCATE PREPARE st;

SET @idx = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE partidas ADD INDEX idx_ranking (juego_id, activo, usuario_id, puntos)', 'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partidas' AND INDEX_NAME = 'idx_ranking');
PREPARE st FROM @idx; EXECUTE st; DEALLOCATE PREPARE st;

SET @fk = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE partidas ADD CONSTRAINT fk_partidas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)', 'SELECT 1')
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partidas' AND CONSTRAINT_NAME = 'fk_partidas_usuario');
PREPARE st FROM @fk; EXECUTE st; DEALLOCATE PREPARE st;

SET @fk = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE partidas ADD CONSTRAINT fk_partidas_juego FOREIGN KEY (juego_id) REFERENCES juegos(id)', 'SELECT 1')
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partidas' AND CONSTRAINT_NAME = 'fk_partidas_juego');
PREPARE st FROM @fk; EXECUTE st; DEALLOCATE PREPARE st;
