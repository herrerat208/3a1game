# 3A1 — draft de fútbol (Vue + MySQL + PHP)

Juego de draft histórico de River Plate: del hardcodeo al juego completo.

## Qué es

Draft estilo 7a0 con planteles históricos de River: se elige modo (copa/liga),
formación y estilo, se sortea un plantel por vez, se arma el equipo
(1 jugador por sorteo, sin borrar; XI + 5/8 suplentes) y se compite fecha a
fecha contra rivales reales sorteados por bombos: **Copa Mundial 32** jugable
(grupos + cuadro, final en Madrid, Balón, tarjetas), **Premier 20** (38 fechas)
y **Liga 30** (zonas + interzonal con clásico + top 8 por zona a
octavos/cuartos/semis/final, MVP). Meta copa: 7A0.
Nada de jugadores hardcodeados en Vue: todo sale de MySQL vía PHP.

La guía del **sistema conectado** (usuarios, sesión, roles, ranking compartido,
visor separado, avisos WebSocket y publicación) está en
[`docs/SISTEMA_CONECTADO.md`](docs/SISTEMA_CONECTADO.md).

## Estructura

```text
3a1/
  src/
    services/api.js        # único contacto con el backend (fetch)
    game/formations.js     # motor: torneo, sinergias, penales, relato, asistencias
    game/ligas.js          # fixture round-robin/zonas/playoffs + tabla + desempates
    game/sorteo_rivales.js # sorteo balanceado por bombos (copa/ligas)
    game/pitch.js          # coordenadas de cancha por formación
    game/palmares.js       # palmarés local por formato + racha del clásico
    game/partida.js        # modo de juego (normal/diario/carrera) desde el nombre
    game/sanciones.js      # amarillas: suspensión cada 2 sin resetear el total
    game/sound.js          # WebAudio mínimo, sin archivos
    components/DraftGame.vue      # draft 3 columnas + paneles
    components/MundialSection.vue # Copa 32: sorteo, grupos, cuadro, fecha a fecha
    components/LigaSection.vue    # Premier 20 / Liga 30: sorteo, fixture, fecha a fecha, playoffs
    components/TorneoSection.vue  # previa, relato en vivo, cierre
    components/DiarioPanel.vue | MejorOnce.vue | LogrosPanel.vue
    App.vue                # hero editorial + juego
  api/                     # espejo versionado de htdocs/3a1-api (entrega)
  db/schema.sql            # CREATE base + 3 planteles (entrega)
  db/pool_completo.sql     # 166 planteles (generado por scripts/migrar_pool.py)
  db/report.txt            # inconsistencias de los docs (generado)
  tests/*.test.mjs         # `npm test` (motor + reglas, offline)
  DER.md | PRODUCT.md | AGENTS.md
  docs/                    # fuente River-3a1.docx + Rivales-3a1.docx
```

## Cómo iniciarlo (prueba final de la consigna)

1. XAMPP: iniciar **Apache** y **MySQL**.
2. La API ya está en `C:\xampp\htdocs\3a1-api` (espejo de `api/` del repo).
   Verificar: `http://localhost/3a1-api/clubes.php` devuelve JSON.
   Si un endpoint da 500 con `Unknown column` / `no existe la tabla`,
   falta importar `db/pool_completo.sql` (trae las columnas nuevas) y/o correr
   `db/migracion_torneo_cierre.sql` (campeón/valla del torneo).
3. phpMyAdmin → importar `db/schema.sql` (crea la base `3a1` + 3 planteles de 11)
   y después `db/pool_completo.sql` (166 planteles; ver `db/report.txt`).
4. Frontend:
   ```bash
   npm install
   npm run dev     # http://localhost:5174/
   npm test        # motor: 48 tests (+ test:backend live con XAMPP)
   npm run build   # debe pasar antes de dar por hecho un cambio
   ```
5. Crear partida (modo, formación, estilo) → Tirar → elegir jugador →
   elegir slot verde → Confirmar → completar XI + banco → Salir a jugar →
   Jugar torneo (previa, relato, cierre).
   Actualizar con F5: equipo y torneo guardado se recargan desde MySQL.

## Datos

- 166 planteles / 918 nombres (908 filas en vivo por fusión de tildes) / 1826 participaciones (tras el pool).
- OVR final se **calcula en SQL** (`api/ovr.php`, ver `DER.md`):
  River `base +1 campeón +3 MVP/+2 estrella`; Rivales `base +2 MVP/+1 estrella`.
- `foto_url` se completa con `php scripts/enriquecer_fotos.php --apply`
  (Wikipedia, web general, sin key; sin foto libre queda NULL y la UI la
  oculta). Dorsal histórico NULL (sin fuente fiable); el dorsal del usuario
   vive en `partida_jugadores.dorsal` y se edita en la UI (migración ya
   aplicada en la base viva).
- Escudos rivales del dueño: 42 imágenes en `public/escudos/` y 42 `UPDATE`
  en `db/escudos_rivales.sql` (generado por
  `scripts/generar_escudos_rivales.php`). Cubre las 79 temporadas rivales.
  Importar con
  `mysql -u root --default-character-set=utf8mb4 < db/escudos_rivales.sql`
  después de `db/pool_completo.sql`. Ajustes confirmados: `Velez 2021` se usa
  en Vélez 2024 y `San Lorenzo 2001-2002` en San Lorenzo 2000/01.
- Escudos de River del dueño: 9 imágenes en `public/escudos/` y 9 `UPDATE` en
  `db/escudos_river.sql` (generado por `scripts/generar_escudos_river.php`).
  Cubre las 87 temporadas (1940–2026) y actualiza `clubes.escudo` con el
  escudo "2021 a Actualidad". Solape 1995/1996: gana `1995 al 2005`. Importar
  después de `db/escudos_rivales.sql`.
- Los 51 escudos están recortados al contenido con
  `python3 scripts/recortar_escudos.py` y convertidos a WebP de 160px con
  `python3 scripts/convertir_escudos_webp.py` (necesitan Vite en :5174 y Chrome).
  Pasaron de 10.3 MB a 412 KB sin perder transparencia.
- Fotos de River: 288 imágenes del dueño convertidas a avatares WebP de 160px
  centrados en la cara (`python3 scripts/importar_fotos_jugadores.py`). Se
  aplican con `db/fotos_jugadores.sql`: 286 jugadores con foto local y se limpia
  `foto_epoca` para que la UI no siga mostrando la foto de Commons. Las fotos de
  jugadores rivales siguen pendientes; mientras tanto quedan las URLs de
  Wikimedia ya cargadas. `python3 scripts/auditar_fotos.py` mide la piel de cada
  avatar y reporta los que tienen la cara corrida; se re-recortan con
  `python3 scripts/importar_fotos_jugadores.py --corregir=<reporte.json>`.

## Deploy en Vercel

Proyecto: `3a1` · URL de producción: https://3a1-eight.vercel.app

El frontend es estático (Vite detectado automáticamente). La API PHP se expone
con un túnel HTTPS de Cloudflare y se conecta mediante `VITE_API_URL`:

```text
VITE_API_URL=https://helmet-debate-chuck-electro.trycloudflare.com/3a1-api
```

> Última actualización: 19/11/2026. La URL del túnel rápido cambia cada vez que
> se reinicia `cloudflared`; si el sitio deja de cargar datos, mirar la URL
> nueva en `%TEMP%\cloudflared4.log` y actualizar `VITE_API_URL` en Vercel.

Ese túnel depende de que esta PC esté encendida con **Apache + MySQL** levantados.
Para levantar todo de un golpe, ejecutar:

```text
scripts\iniciar_tunel.bat
```

El script muestra la URL `https://.../3a1-api` que hay que cargar en
`VITE_API_URL` (o confirmar que sigue siendo la misma).

Si el túnel se reinicia, la URL cambia: actualizá `VITE_API_URL` en Vercel →
Project `3a1` → Settings → Environment Variables y redeployá. Sin la variable,
la app muestra un error claro en vez de intentar `localhost`.

Para redeployar desde esta carpeta:

```bash
npx vercel deploy --prod --yes
```

Para una URL permanente 24/7, reemplazar el túnel por hosting PHP + MySQL
(por ejemplo InfinityFree o Railway) y volver a setear `VITE_API_URL`.

## Documentos y carpeta de campo

El botón **Documentos** del topbar abre Manual, Curiosidades, Información y
Legal. Cada pestaña se puede imprimir o guardar como PDF desde el navegador.
Los textos están en `src/contenido/`; los datos de jugadores siguen viniendo de
MySQL.

La carpeta de campo es un documento aparte, **fuera de la aplicación**:
`docs/carpeta-campo.html`. Se abre directo en el navegador y se imprime en A4.
El bloque Legal tiene marcadores entre corchetes para completar con los datos
reales del titular.

## Entrega

- Proyecto Vue completo (este repo).
- Carpeta `api/` (= contenido de `htdocs/3a1-api`).
- `db/schema.sql` exportado.
- `DER.md` (DER final + equivalencias con el modelo de la consigna).

## Problemas comunes

- **Veo código viejo**: es caché del navegador o del vite. Cerrar pestañas,
  abrir de nuevo (incógnito para probar) y mirar el marcador de versión del
  footer (`draft vX …`).
- **Un endpoint devuelve error de SQL**: reimportar `db/pool_completo.sql`
  (es idempotente).
