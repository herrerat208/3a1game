<?php
// Token CSRF para formularios y operaciones que cambian datos.
// Se puede pedir sin sesión: así el login también queda protegido.
require 'cors.php';
require_once 'csrf_lib.php';

echo json_encode(['csrfToken' => csrfToken3a1()], JSON_UNESCAPED_UNICODE);
