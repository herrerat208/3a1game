# AGENTS.md — guía para trabajar en este repo (3A1)

## Stack (no cambiar sin motivo)

Vue 3 + JS + Vite (frontend) · Apache + PHP plano + MySQL (backend) ·
`npm` (no pnpm). Consigna escolar: proyecto integrador 7° año
"del hardcodeo al juego completo".

## Estructura

```text
src/
  services/api.js        # ÚNICO contacto con el backend. Nada de URLs/SQL en componentes.
  game/formations.js     # MATEMÁTICA en JS (torneo, sinergias, penales, relato). Sin datos.
  game/ligas.js          # fixture round-robin/zonas/playoffs + tabla + desempates. Sin datos.
  game/sorteo_rivales.js # sorteo balanceado por bombos (copa/ligas). Sin datos.
  game/pitch.js          # coordenadas de cancha por formación (der = der).
  game/fotos.js          # foto de época > genérica > inicial (sin datos).
  game/palmares.js       # palmarés local por formato + racha del clásico.
  game/sound.js          # WebAudio mínimo, sin archivos.
  components/DraftGame.vue    # draft 3 columnas + fase banco + rivales/historial/logros/diario.
  components/MundialSection.vue  # Copa 32: sorteo, grupos, cuadro, fecha a fecha, Balón.
  components/LigaSection.vue     # Premier 20 / Liga 30: sorteo, fixture, fecha a fecha, playoffs, clásico, MVP.
  components/TorneoSection.vue # legacy 7 partidos (solo diario). Previa, relato, cierre.
  components/DiarioPanel.vue | MejorOnce.vue | LogrosPanel.vue
  App.vue                # topbar + juego (intro editorial dentro de DraftGame).
api/
  _slots.php             # mapa formación→slots. FUENTE ÚNICA (formaciones.php lo sirve).
  ovr.php                # fórmula OVR canónica. Toda query que calcule OVR la usa.
  (resto: torneo.php, calendario.php, tabla.php, sanciones.php, torneo_equipos.php…)
  # espejo versionado de C:\xampp\htdocs\3a1-api (entrega).
db/schema.sql            # CREATE base (3 planteles + tablas de ligas). Es el .sql de entrega.
db/migracion_ligas.sql   # Fase 0 en bases viejas (modo/formato, torneos, calendario…).
db/migracion_dorsal.sql  # dorsal en bases viejas (una vez).
db/migracion_torneo_cierre.sql # campeón/valla persistidos (ranking formatos nuevos).
db/reparar_encoding.sql  # diagnóstico + fix de � (por partes, phpMyAdmin).
db/pool_completo.sql     # migración 166 planteles (generado, no editar a mano).
db/escudos_rivales.sql   # 42 UPDATE de escudo_epoca rival (generado, no editar).
db/escudos_river.sql     # 9 UPDATE de escudo_epoca de River (generado, no editar).
db/fotos_jugadores.sql   # avatar local por jugador + limpieza de foto_epoca (generado).
db/report.txt            # inconsistencias de los docs (generado).
public/escudos/          # 51 escudos WebP 160px del dueño (42 rivales + 9 River; 412 KB).
public/jugadores/        # 288 avatares WebP 160px de River, recortados a la cara (2.5 MB).
scripts/migrar_pool.py   # genera pool_completo.sql + report.txt desde los .docx.
scripts/fusionar_dupes.py # fusiona duplicados por mojibake ([--apply]).
scripts/generar_escudos_rivales.php # copia escudos rivales y genera db/escudos_rivales.sql.
scripts/generar_escudos_river.php # copia escudos de River y genera db/escudos_river.sql.
scripts/recortar_escudos.py  # recorta márgenes transparentes (Chrome headless + Vite).
scripts/convertir_escudos_webp.py # todos los escudos a WebP 160px (10.3 MB -> 0.3 MB).
scripts/importar_fotos_jugadores.py # fotos del dueño a avatar WebP centrado en la cara + SQL.
scripts/auditar_fotos.py # detecta avatares con la cara corrida; --corregir re-recorta.
scripts/auditar_docs.py  # auditoría de lectura (legacy del arranque).
tests/motor.test.mjs + tests/ligas.test.mjs + tests/reglas.test.mjs  # `npm test` (offline).
tests-live/backend-422.mjs  # `npm run test:backend` (con XAMPP; skip sin backend).
DER.md / PRODUCT.md / README.md
docs/*.docx              # fuente de datos (no editable a mano para el juego).
```

## Reglas de oro

1. **Cero hardcode de datos en `src/`**: nombres, OVR, planteles → MySQL.
   Verificar con: `grep -rin -E "Armani|Maradona|Messi" src` (vacío).
   Lo único permitido en JS son reglas (slots, simulación, animaciones).
2. **OVR final se calcula, no se guarda**: usar `ovr_final_expr()` de
   `api/ovr.php` (River +1/+3/+2, rivales +2/+1). Ver `DER.md`.
3. **Códigos de posición idénticos en DB y frontend**:
   `ARQ,LD,LI,DFC,MD,MI,MC,MCD,MCO,ED,EI,DC`. Si difieren, `?posicion=`
   devuelve `[]`.
4. **`api/` y `htdocs/3a1-api` siempre sincronizados**: editar en `api/` y
   copiar a `C:\xampp\htdocs\3a1-api\`. Comprobar con `diff -r`.
5. **Credenciales MySQL solo en `api/conexion.php`**. Nunca en `src/`.
6. **Los rivales no se draftean** (PRODUCT.md): `sorteo.php` filtra River por
   defecto (fail-safe: solo `?solo_river=0` explícito abre rivales). El frontend
   además pasa `solo_river=1`. No tocar sin decisión del dueño.
7. **1 sorteo = 1 jugador**: `elegir()` agota el sorteo. No reintroducir
   multi-pick por sorteo.
8. **Sin botón de quitar en la UI**: las elecciones son definitivas (7a0)
   y se guardan directo al elegir jugador + slot, sin confirmación intermedia.
   `quitar_jugador.php` existe solo por la consigna (y cambios internos).
9. **Slots desde `_slots.php` (+ `SUP1..SUP8` para banco de liga/copa)**:
   si agregás una formación, agregala ahí;
   el frontend la consume vía `formaciones.php`. No duplicar el mapa en JS.
   `guardar_jugador.php` valida slot+compatibilidad+cobertura del banco (422).
   Probar con un slot inválido además del flujo feliz.
10. **El equipo se llama "River Plate"** (fijo, sin input). Al cerrar el
    draft se exigen capitán y dorsales del XI; el banco debe cubrir las
    3 líneas de campo (defensa/medio/ataque): el arquero va solo al XI y
    aparece bloqueado al armar el banco.

## Comandos

```bash
npm install
npm run dev     # http://localhost:5174 (vite con nohup; ver /tmp/3a1-dev.log)
# En /mnt/c el watcher no detecta cambios: arrancar con
# CHOKIDAR_USEPOLLING=1 nohup npm run dev -- --host --port 5174 &
npm test        # motor: 48 tests, debe pasar
npm run build   # debe pasar antes de dar por hecho un cambio
```

Backend: `http://localhost/3a1-api/<endpoint>.php` (Apache+XAMPP).
Base: importar `db/schema.sql` en phpMyAdmin (base `3a1`).

## Si el navegador muestra código viejo

El footer trae un marcador de versión (`draft vX …`): si no coincide con el
código actual, es caché. Cerrar todas las pestañas de localhost y abrir
`http://localhost:5174/` de nuevo (incógnito para probar). Si persiste, el
proceso vite tiene la caché trabada: matarlo por PID y arrancar de nuevo
(OJO: `pkill -f vite` se mata a sí mismo; filtrar por `vite/bin/vite.js`
excluyendo el propio PID).

## Qué está hecho

- Base `3a1`: 13 tablas (PK/FK/UNIQUE: catálogo + partida + ligas),
  3 planteles completos (River 2018, River 2021, Boca 1962),
  consultas JOIN + `ORDER BY RAND()` + GROUP BY.
- Pool completo generado: 166 planteles / 918 nombres / 1826 filas
  (`db/pool_completo.sql`, importar después de `schema.sql`). En vivo:
  166/908/1826 (10 pares de tildes fusionados por la collation _ci)
  + encoding reparado (400 UPDATEs + 27 merges, verificado sin mojibake).
- Endpoints PHP con `php -l` limpio (sorteo, jugadores, partidas, equipo,
  torneo/resultados/calendario/tabla/sanciones, ranking/historial de formatos
  nuevos, intercambio atómico XI↔banco, estadísticas…;
  `_slots.php`/`ovr.php` son includes compartidos).
- Draft jugable (10 formaciones + 3 estilos + De Memoria) con 1-pick-por-sorteo,
  plantel completo visible, confirmación previa, filtro de ya-elegidos, Pasar,
  F5-recarga, torneo 7 partidos con goleadores y guardado.
- Copa Mundial 32 jugable (grupos + cuadro, final Madrid, Balón, tarjetas,
  banco de 5, draft 16) + Premier 20/38 y Liga 30 jugables (`LigaSection.vue`:
  sorteo con Boca, fixture 38 / zonas+interzonal+top 8 a octavos/cuartos/semis/final,
  fecha a fecha, tabla resaltada y cuadro de playoffs,
  +racha, simular hasta N, clásico con pica, tarjetas, cambios XI↔banco,
  goleadores+asistencias, MVP, palmarés) + base de ligas lista
  (ver PRODUCT.md fases 0-4 ✅).
- Draft: flujo guiado (config → crear → tirar → confirmar → ocupar slot), contador 0/16, cancha central, banco con drag&drop, slots bloqueados por compatibilidad, capitán/dorsales obligatorios al cerrar, banco de campo con cobertura de 3 líneas.
- Motor con tests (`npm test`, 48): sinergias, relato, penales, torneo, notas, asistencias, fixture premier/liga30, bombos, tabla, modos y amarillas.
- Torneo en vivo: previa rival animada, relato, fixture por bombos, goleador, figura, calificaciones, comparativa, revancha amistosa, compartir.
- Modos diario/carrera, logros, mejor 11, ranking, sonido WebAudio, capitán.
- Cierres de formato: clasificación de grupos de Copa 32 por tabla completa
  (`cerrarGrupos`), ranking/historial con torneos jugados en `calendario`
  (campeón/valla persistidos en `torneos`), fair play del equipo usuario por
  `partida_jugadores`, amarillas cada 2 sin resetear el total, cambios
  XI↔banco atómicos (`intercambiar.php`) y restauración de F5/arqueros en
  carrera.
- Fotos de época: `foto_epoca` por participación (Commons, año exacto ±1, El Gráfico/figuritas), UI muestra época > genérica > inicial, chip `📷 año`.
- Escudos: `clubes.escudo` por club (whitelist verificada 18/19, Platense NULL), escudo de época en `temporadas.escudo_epoca` (script `enriquecer_escudos_epoca.php`). Escudos del dueño aplicados en `public/escudos/`: 79 temporadas rivales (`db/escudos_rivales.sql`) + 87 de River (`db/escudos_river.sql`). Los 51 archivos están recortados al contenido (`scripts/recortar_escudos.py`) para que se vean parejos con `object-fit: contain`; los 2 AVIF se convirtieron a WEBP.
- Escudos rivales + River año por año en UI (previa, tabla, sorteo).
- Banco: drag&drop XI↔banco, suplentes a XI ocupado (reemplazo expulsado), tope 2 por puesto natural, cobertura 3 líneas de campo obligatoria al cerrar draft. Arquero bloqueado: solo va en el XI.
- Capitán/dorsales obligatorios al cerrar draft; banco debe cubrir 3 líneas de campo.
- Revisión visual/funcional: título de fecha en Copa corregido, pase de rescate
  cuando un sorteo no aporta jugadores, errores de API con mens claro, avisos de
  tarjetas visibles también después de jugar, tablas finales, date del diario en
  horario local, `:focus-visible` y relato del torneo con el nombre del equipo.

## Qué falta (pendiente para entrega final)

1. **Fotos**: las definitivas las aporta el dueño del producto. Ya entraron los
   escudos (42 rivales + 9 River, todos WebP) y las **fotos de los jugadores de
   River**: 288 avatares locales → 286 jugadores de la DB. Siguen pendientes
   las fotos de los jugadores rivales (hoy 62 `foto_url` y 72 `foto_epoca` siguen
   apuntando a Wikimedia). Los scripts
   (`scripts/enriquecer_epoca.php --apply`, `enriquecer_escudos.php --apply`,
   `enriquecer_escudos_epoca.php --apply`) siguen disponibles para completar
   `foto_epoca`/`clubes.escudo`/`escudo_epoca` con Commons. Dorsal histórico:
   sin fuente general fiable, queda NULL. Dorsal del usuario: columna
   `partida_jugadores.dorsal` (1-99, UNIQUE por partida, endpoint
   `setear_dorsal.php`).
2. Migraciones aplicadas en la base viva: `migracion_dorsal.sql`,
   `migracion_ligas.sql`, `migracion_foto_epoca.sql`,
   `migracion_torneo_cierre.sql` (y `reparar_encoding.sql` por partes).
   Los archivos quedan para instalaciones nuevas.
3. Limpieza hecha (assets del template borrados). Queda: prueba final de la
   consigna (pág. 18): F5, 11/11, torneo, ver filas en `resultados` (diario/
   legacy) y en `calendario` (formatos nuevos), exportar `.sql` desde
   phpMyAdmin.
