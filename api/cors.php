<?php
// 3A1 — CORS: orígenes concretos (no comodín) para poder usar cookies.
require_once __DIR__ . '/config.php';
$origen = $_SERVER['HTTP_ORIGIN'] ?? '';
$permitidos = $A1_ORIGENES ?? [];
if ($origen !== '' && in_array($origen, $permitidos, true)) {
    header('Access-Control-Allow-Origin: ' . $origen);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}
