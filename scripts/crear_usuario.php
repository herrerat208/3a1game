<?php
// Cuentas de práctica / administradores: se ejecuta EN EL SERVIDOR.
//   php scripts/crear_usuario.php luna_clave jugador
//   php scripts/crear_usuario.php admin_3a1 unaClaveLarga admin
// El rol administrador NO se puede pedir desde el formulario público.
require __DIR__ . '/../api/conexion.php';

$alias = trim($argv[1] ?? '');
$clave = $argv[2] ?? '';
$rol = $argv[3] ?? 'jugador';

if (!preg_match('/^[\p{L}\p{N}_ -]{3,40}$/u', $alias) || strlen($clave) < 8) {
    fwrite(STDERR, "Uso: php crear_usuario.php <alias> <password>=8+ [jugador|admin]\n");
    exit(1);
}
if (!in_array($rol, ['jugador', 'admin'], true)) {
    fwrite(STDERR, "Rol inválido. Usá jugador o admin.\n");
    exit(1);
}

$hash = password_hash($clave, PASSWORD_DEFAULT);
$st = $pdo->prepare(
    'INSERT INTO usuarios (alias, password_hash, rol) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), rol = VALUES(rol)'
);
$st->execute([$alias, $hash, $rol]);

$st = $pdo->prepare('SELECT id, alias, rol FROM usuarios WHERE alias = ?');
$st->execute([$alias]);
$u = $st->fetch();
echo "Listo: id={$u['id']} alias={$u['alias']} rol={$u['rol']}\n";
