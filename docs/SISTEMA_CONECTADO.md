# Del juego al sistema conectado

Guía de puesta en marcha y verificación del sistema conectado de 3A1.
La app sigue siendo la misma: Vue + PHP plano + MySQL. El "sistema conectado"
agrega identidad, ranking compartido, un visor separado y avisos en tiempo real.

## Qué cambió respecto del juego suelto

| Antes | Ahora |
| --- | --- |
| El ranking se leía de la base local del navegador | Se lee de la API, con `{usuarioId, alias, puntos}` |
| Cualquier pestaña podía guardar un resultado | El guardado exige sesión, CSRF y un `juegoId` válido |
| Los puntos los podía mandar el navegador | Los calcula el servidor desde los resultados reales |
| El resultado se veía recién al recargar | Un WebSocket avisa y el visor vuelve a consultar |
| No había roles | `jugador` y `admin`; el admin se asigna en el servidor |

La identidad **nunca** viaja en el JSON: el alias y el rol salen de `$_SESSION`.

## Piezas

```
navegador (3A1)  ──HTTP/JSON + cookie──▶  API PHP (Apache/XAMPP o hosting)
                                             │
                                             ├── MySQL: juegos, usuarios, partidas
                                             └── POST /broadcast ─▶ servidor Node `ws`
navegador (visor) ──HTTP──▶ API PHP  ·  ──WebSocket──▶ servidor Node `ws`
```

El WebSocket **solo avisa**: manda `{tipo:'rankingActualizado', juegoId:3}`.
Los datos siempre se traen por HTTP. Si el tubo está caído, el guardado ya
quedó en MySQL y el visor se actualiza al recargar o reconectar.

## Contratos

### Ranking

`GET /ranking.php?juegoId=3`

- `200` con `[{ "usuarioId": 1, "alias": "Luna", "puntos": 1834 }]`
- `200` con `[]` si el juego existe pero todavía no hay resultados
- `404` si el juego no existe
- Orden: mejor puntaje de cada usuario (DESC); si empatan, quien lo alcanzó
  antes; si siguen empatados, menor `usuarioId`.
- El visor recibe **solo** esas tres claves. `?admin=1` agrega `partidaId`
  únicamente si la sesión es de administrador.

### Guardado

`POST /guardar_ranking.php` con `{ "juegoId": 3, "partidaId": 84 }`

- `201`: guarda y devuelve `{id, usuarioId, juegoId, puntos}`.
- `401` sin sesión · `403` sin CSRF · `400` si faltan datos o la partida no
  terminó · `403` si la partida es de otro usuario.
- El navegador **no** manda `usuarioId` ni `puntos`; el servidor los calcula.
- Puntos 3A1: `1000*7A0 + 500*valla + 250*campeón + 10*jugados + gf`,
  limitados a `0..2000`. En formatos nuevos no hay 7A0.

### Sesión y roles

| Endpoint | Uso |
| --- | --- |
| `/csrf.php` | Token antes de cualquier POST |
| `/registro.php` | Alta pública: siempre `jugador` |
| `/login.php`, `/logout.php`, `/me.php` | Sesión; `/me` nunca devuelve el hash |
| `/partidas.php?id=…` `DELETE` | Retirar un resultado (solo admin, baja lógica) |

El rol `admin` se asigna **en el servidor**. No existe opción para pedirlo en
la interfaz ni en el formulario de registro.

## Armado local

```bash
# 1) Base y API
# XAMPP (Apache + MySQL) arriba. Aplicar la migración (es reejecutable):
cat db/migracion_sistema_conectado.sql | /mnt/c/xampp/mysql/bin/mysql.exe -u root 3a1

# 2) Cuentas de práctica (en la PC, no desde el navegador)
# Elegí claves propias y exportalas; no las escribas en el repo.
export CLAVE_JUGADOR='una-clave-de-prueba'
export CLAVE_ADMIN='otra-clave-de-prueba'
/mnt/c/xampp/php/php.exe scripts/crear_usuario.php Luna "$CLAVE_JUGADOR" jugador
/mnt/c/xampp/php/php.exe scripts/crear_usuario.php Admin3a1 "$CLAVE_ADMIN" admin

# 3) Mantener sincronizado el espejo que usa Apache
cp api/*.php /mnt/c/xampp/htdocs/3a1-api/

# 4) Servicios (cada uno en su terminal)
export A1_WS_SECRET='un-secreto-largo-y-aleatorio'
npm run ws                    # ws://localhost:8787/ws
npm run serve:visor           # http://localhost:8080/
npm run serve:dist            # http://localhost:5175/  (tras npm run build)
```

Para probar la interfaz contra la API local, el build debe llevar la URL local:

```bash
VITE_API_URL=http://localhost/3a1-api npm run build
npm run serve:dist
```

Si se usa `npm run dev`, Vite ya toma `http://localhost/3a1-api` por defecto.

### Verificaciones

```bash
npm test                         # motor (offline)
npm run test:sistema             # API: CSRF, 401/403, login, ranking, guardado, DELETE
npm run test:ws                  # dos clientes reciben el mismo aviso
npm run test:interfaz            # Chrome CDP: login por UI, visor en vivo y permisos
```

Las pruebas en vivo no traen claves ni secretos escritos: exportá
`CLAVE_JUGADOR`, `CLAVE_ADMIN` y `A1_WS_SECRET` con los valores usados arriba.
`test:interfaz` también acepta `ALIAS_JUGADOR` y `ALIAS_ADMIN` si cambiaste los
alias. Necesita Chrome con `--remote-debugging-port=9226` y los tres servicios
arriba. Los datos de prueba se retiran solos al finalizar.

## Publicación en InfinityFree

1. **Build de producción.** `.env` ya apunta a `https://3a1.page.gd`, así que
   no hace falta pasar variables:

   ```bash
   npm run build
   python3 scripts/generar_build_plano.py
   ```

2. **Helper de subida.** Si `/recibir.php` da 404, reemplazar el placeholder
   `REEMPLAZAR_CON_TOKEN_LARGO_Y_ALEATORIO` en
   `db/infinityfree/recibir.php` por un token propio, subirlo a la raíz por File
   Manager y exportar el mismo valor en `A1_UPLOAD_TOKEN`. Después:

   ```bash
   export A1_UPLOAD_TOKEN='el-token-elegido'
   node scripts/subir_helper.mjs upload
   node scripts/subir_helper.mjs borrar
   ```

   El helper publica el `index.html` plano, los PHP de `api/` en la raíz,
   fotos/escudos y el visor en `/visor/`. **Nunca** sube `api/config.php`:
   las credenciales del hosting quedan intactas. El token real tampoco se
   versiona: vive solo en el servidor y en la variable de entorno local.

3. **Migración.** En el panel (o con el helper):

   ```bash
   node scripts/subir_helper.mjs sql db/migracion_sistema_conectado.sql
   ```

4. **Config del hosting.** Editar `config.php` de la raíz y agregar:

   ```php
   $A1_ORIGENES = [
       'https://3a1.page.gd',
       'http://localhost:5174', 'http://127.0.0.1:5174',
       'http://localhost:5175', 'http://127.0.0.1:5175',
       'http://localhost:8080', 'http://127.0.0.1:8080'
   ];
   $A1_WS_URL = 'https://WS_PUBLICO';              // origen HTTPS del proxy WSS
   $A1_WS_SECRET = 'secreto-largo-y-aleatorio';    // el mismo del servidor Node
   ```

   CORS usa orígenes concretos (nunca `*`), con
   `Access-Control-Allow-Credentials: true`.

5. **Cuentas reales.** Generar el SQL en local y aplicarlo:

   ```bash
   /mnt/c/xampp/php/php.exe scripts/generar_sql_usuario.php TU_CLAVE_LARGA jugador > /tmp/usuario.sql
   node scripts/subir_helper.mjs sql /tmp/usuario.sql
   rm /tmp/usuario.sql
   ```

   Repetir con otra contraseña y `admin` para la cuenta administradora.

6. **Tiempo real.** InfinityFree no ejecuta Node: el servidor `ws-server.mjs`
   tiene que correr en otra máquina (por ejemplo la PC con XAMPP) detrás de un
   proxy que sirva **WSS** con certificado válido. En producción está prohibido
   `ws://`: el visor usa `wss://`. Configurar:

   ```bash
   A1_WS_SECRET=el_mismo_secreto A1_WS_ORIGINES=https://3a1.page.gd npm run ws
   ```

   Y abrir el visor indicando el origen del socket:

   ```text
   https://3a1.page.gd/visor/?ws=wss://TU-SERVIDOR/ws
   ```

   El visor toma la API del mismo origen automáticamente. Si el proxy no está,
   el visor sigue funcionando con "Actualizar ahora" (solo pierde los avisos).

## Seguridad y datos

- Cookies de sesión `HttpOnly`, `SameSite=Lax` y `Secure` cuando hay HTTPS.
- CSRF en todas las operaciones que escriben o borran.
- Contraseñas con `password_hash()` de PHP; nunca se guardan en claro.
- Borrado de ranking = `activo=0`, no `DELETE` físico.
- Un mismo jugador de otra temporada **no** es duplicado: solo se bloquea el
  `temporada_jugador_id` exacto.
- Los orígenes del WebSocket se validan en `/ws`; `/broadcast` exige el header
  `X-Ws-Secret`.

## Estado conocido

El recorrido completo quedó verificado en local: login por interfaz, guardado
con 1834 puntos calculados por el servidor, visor actualizado sin recargar,
filtro por `juegoId`, panel de ranking sin botones para jugadores y retirada
por administrador. Falta repetir la verificación en producción desde dos
equipos después de aplicar los pasos anteriores.
