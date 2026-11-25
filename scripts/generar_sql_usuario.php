<?php
// Genera el SQL para dar de alta un usuario en la base del hosting.
// El hash se crea acá (en tu PC) y se aplica con:
//   node scripts/subir_helper.mjs sql /tmp/usuario.sql
// Así no hace falta dejar un endpoint público de creación de cuentas.
//   php scripts/generar_sql_usuario.php alias password [jugador|admin]
$alias = trim($argv[1] ?? '');
$clave = $argv[2] ?? '';
$rol = $argv[3] ?? 'jugador';

if (!preg_match('/^[\p{L}\p{N}_ -]{3,40}$/u', $alias) || strlen($clave) < 8) {
    fwrite(STDERR, "Uso: php generar_sql_usuario.php <alias> <password>=8 [jugador|admin]\n");
    exit(1);
}
if (!in_array($rol, ['jugador', 'admin'], true)) {
    fwrite(STDERR, "Rol inválido: jugador o admin\n");
    exit(1);
}

$hash = password_hash($clave, PASSWORD_DEFAULT);
$escape = static fn($s) => str_replace(["\\", "'"], ["\\\\", "''"], $s);

echo "-- Alta de usuario para 3A1 (no reimprimir: contiene el hash)\n";
echo "INSERT INTO usuarios (alias, password_hash, rol) VALUES ('"
    . $escape($alias) . "', '" . $escape($hash) . "', '" . $rol . "')\n";
echo "ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), rol = VALUES(rol);\n";
