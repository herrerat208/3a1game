<?php
// Copiar a config.php y completar con los datos del panel de InfinityFree.
// config.php NO se versiona (está en .gitignore).
// OJO: en InfinityFree el host NO es 'localhost': es el "MySQL Host" del panel.
$host = 'sqlXXX.epizy.com';          // "MySQL Host" del panel (ej. sql101.epizy.com)
$db   = 'if0_43478740_3a1';          // nombre de la base creada en el panel
$user = 'if0_43478740_XXX';          // usuario MySQL creado en el panel
$pass = 'TU_PASSWORD_MYSQL';         // contraseña del usuario MySQL (solo en config.php del servidor)

// Orígenes autorizados a leer la API con cookies (visor y frontend).
$A1_ORIGENES = [
    'https://3a1.page.gd',
    'http://localhost:5174', 'http://[::1]:5174', 'http://127.0.0.1:5174',
    'http://localhost:5175', 'http://[::1]:5175', 'http://127.0.0.1:5175',
    'http://localhost:8080', 'http://[::1]:8080', 'http://127.0.0.1:8080',
    'http://localhost:5176', 'http://[::1]:5176', 'http://127.0.0.1:5176'
];

// Servicio de tiempo real (programa Node separado, NO InfinityFree).
// Local: la PC donde corre XAMPP y `npm run ws`.
// Producción: origen HTTPS público del proxy que termina WSS (ej.
// https://ws.tudominio.com); PHP solo hace POST /broadcast a ese origen.
$A1_WS_URL = 'http://127.0.0.1:8787';
$A1_WS_SECRET = 'CAMBIAR_SECRETO_LARGO_Y_ALEATORIO';
