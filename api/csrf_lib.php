<?php
// CSRF mínimo para un backend plano: token por sesión + header X-CSRF-Token.
require_once __DIR__ . '/sesion_lib.php';

function csrfToken3a1() {
    iniciarSesion3a1();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrfValido3a1() {
    iniciarSesion3a1();
    $enviado = trim($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $guardado = (string)($_SESSION['csrf_token'] ?? '');
    return $enviado !== '' && $guardado !== '' && hash_equals($guardado, $enviado);
}
