# Instalación en InfinityFree (cuenta `if0_43478740`)

InfinityFree **no permite** `CREATE DATABASE`: el panel crea la base con el
prefijo de la cuenta. Los `.sql` ya tienen:

- `USE \`if0_43478740_3a1\`;`
- sin `CREATE DATABASE`
- sin los `ALTER TABLE ... IF NOT EXISTS` viejos (el `schema.sql` ya trae esas columnas)

Si elegiste otro nombre de base en el panel, reemplazá `if0_43478740_3a1`
por el nombre real en los `.sql` y en `api/config.php`.

## Estado actual (producción)

El sitio es **API + frontend en el mismo dominio**: `https://3a1.page.gd`.
La API está en la raíz (`/temporadas.php`, `/jugadores.php`, …) y el
frontend es un `index.html` plano con los assets en `/jugadores/` y `/escudos/`.
Vercel queda solo como respaldo.

SQL ya aplicados en producción, en este orden:

1. `01_schema.sql`
2. `02_pool.sql`
3. `03_correcciones_nombres.sql` (renombres/fusiones; idempotente)
4. `04_fotos_jugadores.sql` (avatars locales WebP)
5. `05_escudos_river.sql`, `06_escudos_rivales.sql` (escudos de época)
6. `07_reparar_localia.sql` (5 partidos con localía invertida)
7. `08_fotos_rivales.sql` (fotos de época de rivales)
8. `09_fotos_river_faltantes.sql` (últimas 13 fotos de River; NO re-ejecutar)
9. `08_fotos_rivales.sql` regenerado desde `db/fotos_rivales.sql` (860 UPDATEs
   por nombre + etiqueta, sin el `Juan Jos?` del espejo viejo)
10. `10a_backup_pre_depuracion.sql` (copia de las filas afectadas)
11. `10_fotos_y_depuracion.sql` (2 fotos de River pendientes, 6 UPDATE con la
    ortografía corregida y baja de los 6 jugadores sin archivo en la carpeta)
12. `10b_verificar.sql` (una sola consulta: el helper no imprime filas de SELECT)
13. `11_reparar_braian_velez.sql` (reincorpora a Braian Romero como DC de Vélez
    2024 y le aplica su foto de época; la fusión de nombres del paso 3 había
    dejado esa participación fuera)

`10` elimina participaciones solo si no fueron usadas en una partida guardada.
`ricardo-ismael-rojas.webp` no se aplica porque es otra toma de Ricardo Rojas,
que ya tiene foto asignada. `10b` también sirve para verificar el backup antes
y después de `10` (el helper solo reporta cuántas sentencias ejecutó).

No hace falta importar los `migracion_*.sql` viejos: `schema.sql` ya incluye
esas tablas/columnas.

## Subir cambios sin FTP

1. Elegir un token largo y aleatorio (por ejemplo con
   `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`).
2. Reemplazar `REEMPLAZAR_CON_TOKEN_LARGO_Y_ALEATORIO` por ese token en
   `db/infinityfree/recibir.php` (y en `subir_fotos.php` si lo usás).
3. Subir `db/infinityfree/recibir.php` a `htdocs/recibir.php` con el File Manager.
4. Exportar el token en la variable de entorno `A1_UPLOAD_TOKEN` (no en el repo):
   `export A1_UPLOAD_TOKEN='el-token-elegido'`.
5. `node scripts/subir_helper.mjs upload` (assets + `index.html` plano).
6. `node scripts/subir_helper.mjs sql db/infinityfree/09_fotos_river_faltantes.sql`
7. `node scripts/subir_helper.mjs verificar`
8. `node scripts/subir_helper.mjs borrar` (borra el helper; verificar 404).

El helper lee el token desde `A1_UPLOAD_TOKEN` y se autodestruye. Nunca dejarlo
en el servidor ni publicar el token real.

## Backend

Subir todo `api/` a la raíz del sitio. La contraseña de MySQL y los secretos de
CORS/WebSocket van en `api/config.php` del servidor (plantilla en
`api/config.example.php`). Ese archivo no debe versionarse ni exponerse.
