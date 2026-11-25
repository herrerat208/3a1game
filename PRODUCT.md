# PRODUCT.md — 3A1

## Qué es

3A1 es un juego de draft de fútbol: el usuario arma su equipo con jugadores
históricos de **River Plate** y lo compite en copas y ligas contra rivales
reales sorteados. Base de la idea: **7a0** (dado → plantel real → elegir un
jugador que jugó ahí → completar el equipo → simular). Los rivales históricos
existen para la simulación, no se draftean.

> 3A1 es el producto que se desarrolla ahora. F11, FIX y FDB son productos
> distintos de la misma familia: no mezclar sus funcionalidades.
> (La marca paraguas Kouvah Sports queda fuera de la UI por ahora.)

## Loop principal

```
ENTRAR (hero) → ELEGIR MODO (copa/liga) + FORMACIÓN + ESTILO → TIRAR → VER PLANTEL
→ ELEGIR 1 JUGADOR → ELEGIR SLOT → CONFIRMAR → (repetir ×16 copa / ×19 liga)
→ SALIR A JUGAR → COMPETENCIA FECHA A FECHA (previa, relato, tabla, cierre)
→ REVANCHA / NUEVA PARTIDA / DIARIO
```

Modos de competencia (`partidas.formato`):
- **Copa Mundial 32**: tu River + 31 de los 79, sorteo balanceado por bombos
  con cabezas de serie, ceremonia de grupos, 8 grupos × 4 (top 2),
  octavos cruzados, cuadro fijo, **final en Madrid**. 7 partidos. Plantel 16
  (XI + 5 suplentes), 3 pases.
- **Premier 20**: tu River + 19, fixture ida/vuelta (38 fechas). Plantel 19
  (XI + 8 suplentes), 5 pases.
- **Liga 30**: tu River + 29, 2 zonas de 15 balanceadas (snake por OVR),
  14 fechas + interzonal con **clásico vs Boca garantizado**, playoffs
  top 8 por zona a octavos cruzados (1°A-8°B…), cuartos, semis y final
  (fechas 17 a 20). Plantel 19, 5 pases.
- Cada run sortea rivales distintos: nunca la misma copa/liga dos veces.

## Reglas (canónicas, no inventar otras)

- **Sorteo solo de River.** El usuario arma su equipo únicamente con jugadores
  de River Plate. Los 79 planteles rivales existen para la simulación y las
  estadísticas, no para el draft (`solo_river=1`; no quitar ese filtro).
- **El equipo se llama siempre "River Plate".** Sin input de nombre
  (en diario se antepone la fecha).
- **1 sorteo = 1 jugador.** Después de guardar, el sorteo se agota. Hay
  **3 pases** por partida en copa (5 en ligas) y los planteles no se repiten
  en la misma partida (con pool completo). En diario el mazo es fijo por fecha.
- **Las elecciones son definitivas y directas.** No hay botón de quitar en la
  UI (como en 7a0) ni confirmación intermedia: elegir jugador + slot guarda
  al instante. El endpoint `quitar_jugador.php` existe solo porque lo pide la
  consigna (y para cambios internos XI↔banco).
- **Formación + estilo se eligen antes del draft** (10 formaciones servidas por
  `formaciones.php`, fuente única: las 8 + 4-2-2-2 + 4-3-3(2) enganche).
  Estilos: ofensivo/equilibrado/defensivo, pesan en la simulación.
- **Elegibilidad:** vale posición natural **o** secundaria. El **backend**
  rechaza (422) slot inexistente o jugador incompatible: la UI sola no alcanza.
- **Sin repetidos:** UNIQUE(partida, slot) + UNIQUE(partida, jugador) + filtro
  de ya-elegidos en UI.
- **Bonus OVR River:** `final = base +1 si el año fue campeón +3 si MVP / +2 si
  estrella` (en año no campeón: +3 MVP / +2 estrella sin el +1).
  Rivales (todos campeones): `+2 MVP / +1 estrella`, ya incluyen el +1.
- **OVR del equipo:** promedio simple de los 11 (modo clásico; en De Memoria se
  oculta hasta jugar).
- **Sorteo balanceado (`game/sorteo_rivales.js`):** los 79 rivales se parten en
  4 bombos por OVR y cada competencia reparte proporcional (copa 8+8+8+7,
  premier 5+5+5+4, liga 7+7+8+7; zonas por snake, dif. de promedio <1).
  **Boca garantizado** en cada sorteo como rival del clásico.
- **Clásico con pica (liga):** previa especial con historial, línea de relato
  propia, logro `clasico_ganado` y racha en el palmarés. Sin bonus de puntos.
- **Simulación fecha a fecha (JS):** mismo motor 7a0 (tanda remate a remate,
  relato en vivo, previa animada, goleadores + **asistencias**, figura,
  calificaciones). El usuario juega su partido; el resto de la fecha se
  simula. Todo persiste (`calendario` + `resultados` con `detalle`) y se
  restaura en F5. **Simular hasta fecha N** disponible en ligas.
- **Desempates:** puntos → diferencia → GF → fair play → sorteo (visibles
  bajo cada tabla).
- **Tarjetas:** amarilla acumulada / roja = afuera el partido siguiente; se
  cumple con suplentes (si el banco no cubre el slot, se juega con 10,
  avisado). En copa también rigen (banco corto de 5).
- **Suplentes:** slots `SUP1..SUP8` (liga) / `SUP1..SUP5` (copa), con
  cobertura: cada suplente debe poder jugar en ≥1 puesto del XI y no puede
  haber más de 2 del mismo puesto natural (el **backend** lo rechaza con 422);
  al cerrar el draft el banco debe cubrir las 3 líneas de campo (defensa/medio/
  ataque): el arquero va solo al XI y no se puede elegir para el banco.
  Cambios solo entre partidos (en la cancha por arrastre o en la
  sección del torneo), nunca en vivo. Pestañas XI/Banco en la cancha.
- **Salir a jugar exige capitán (©) y dorsales del XI.**
- **Reroll gratis:** 1 extra si el año sorteado no aporta a posiciones
  faltantes (además de los pases: 3 copa / 5 ligas).
- **Escudos:** `clubes.escudo` (actual, verificado por whitelist en
  `scripts/enriquecer_escudos.php` — 18/19; Platense NULL a propósito).
  **Escudo de época** por temporada en `temporadas.escudo_epoca`
  (`scripts/enriquecer_escudos_epoca.php`: crest datado de esa temporada,
  año exacto o rango que lo contenga). Los escudos del dueño son archivos
  locales en `public/escudos/`: rivales vía `db/escudos_rivales.sql` (79
  temporadas; `Velez 2021` se usa en Vélez 2024 y `San Lorenzo 2001-2002` en
  San Lorenzo 2000/01) y River vía `db/escudos_river.sql` (87 temporadas,
  1940–2026; solape 1995/1996 resuelto a favor de `1995 al 2005`).
  UI: época > actual > nada.
- **Cierre:** palmarés por formato, once ideal + MVP/Balón por temporada,
  goleadores y asistidores. Meta copa: **7A0 = campeón con valla invicta**.
  El cierre de cada torneo guarda `campeon`/`valla`; ranking e historial
  incluyen tanto el legacy de 7 partidos (`resultados`) como los formatos
  nuevos (`calendario`).
- **Sinergias:** 3-4 del mismo club+año +1 al OVR efectivo, 5+ +2 (tope).
- **Capitán:** con brazalete ©; desempata la figura.
- **Revancha amistosa:** mismo fixture, no suma logros ni ranking.
- **Modos:** normal, diario (mismo mazo `semilla=fecha`; el ranking global
  suma los torneos finalizados, no tiene tabla diaria propia), carrera
  (3+ torneos conservando 5).
- **Logros:** debut, campeón, 7A0, humilde, de memoria, goleada, vallas, revancha.

## Datos

- Fuente: `docs/River-3a1.docx` (River 1940–2026, 87 planteles) y
  `docs/Rivales-3a1.docx` (79 campeones 1960–2026, sin River).
- Migración: `scripts/migrar_pool.py` → `db/pool_completo.sql` (idempotente,
  166 planteles, 918 nombres, 1826 participaciones) + `db/report.txt`
  (7 finales mal calculados en el doc + 2 OVR de equipo erróneos, se ignoran:
  el OVR se calcula). Pool importado y deduplicado en vivo
  (`scripts/fusionar_dupes.py` eliminó 800+ filas mojibake de una base vieja
   sin perder picks; conteos verificados: 166/908/1826 en vivo).
- Orden de importación: `db/schema.sql` primero, `db/pool_completo.sql`
  después (incluye el ALTER de UNIQUE a `(club, etiqueta)` y la columna
  `partidas.estilo`; requiere MariaDB/XAMPP).
- Campos por jugador: nombre, posición natural, secundarias CSV, OVR base, rol
  (base/estrella/MVP). El OVR final se **calcula en SQL**, no se almacena.
- `foto_url`: `scripts/enriquecer_fotos.php --apply` (Wikipedia, sin key,
  fallback sin año). **Foto de época**: `temporada_jugadores.foto_epoca` vía
  `scripts/enriquecer_epoca.php --apply` (Commons, año exacto ±1 verificado en
  título/snippet, `foto_anio` real; respeta `foto_epoca IS NULL`; ante la duda
  NULL). La UI muestra época > genérica > inicial, con año real.
  **Fotos del dueño**: `scripts/importar_fotos_jugadores.py` recorta la cara y
  genera `db/fotos_jugadores.sql` (288 avatares WebP → 286 jugadores de River;
  limpia `foto_epoca` para que se vea la local). Escudos: WebP de 160px con
  `scripts/convertir_escudos_webp.py`. `clubes.escudo`:
  `scripts/enriquecer_escudos.php --apply` (misma técnica).
  Dorsal histórico NULL (sin fuente); dorsal del usuario en
   `partida_jugadores.dorsal` (migración ya aplicada en la base viva).

## Marca

Paleta: beige `#EDE6D6` fondo, blanco cards, negro `#141414`, rojo River
`#C8102E` CTA/acentos; MVP dorado `#A8842C`, estrella plata `#6E7681`.
Tipografías Oswald (display) + Inter + DM Mono (etiquetas). Layout de 3
columnas (planteo | cancha | marcador) + hero editorial + teasers, tomado como
referencia de 7a0 pero con cara propia. Tono premium, no gamer.
Sin marca paraguas en la UI por ahora.

## Roadmap (prioridad)

1. ✅ Núcleo copa 7 partidos + De Memoria + carrera + logros + ranking +
   historial + dorsales + fotos + blindaje De Memoria (este repo).
2. ✅ **Fase 0**: base de ligas (`partidas.modo/formato`, `torneos`,
   `torneo_equipos` (temporada NULL = usuario), `calendario` con detalle,
   `sanciones`, SUP1..8 en `guardar_jugador`, `sorteo_rivales.js`,
   `ligas.js`, `tabla.php` GROUP BY + fair play, `torneo.php`,
   `calendario.php`, `sanciones.php`; `db/migracion_ligas.sql`).
3. ✅ **Fase 1**: Copa Mundial 32 (`MundialSection.vue`): sorteo 31+usuario
   con Boca garantizado, ceremonia de grupos, 8×4 top 2, octavos cruzados,
   cuadro fijo, final Madrid, fecha a fecha (tu partido con relato + resto
   simulado), tabla de grupo en vivo, tarjetas con suspensión y reemplazo
   automático desde el banco, Balón de la Copa, F5-restore. Draft 16
   (XI + banco 5, fase banco sin slot, 3 pases). Diario sigue con el flujo
   legacy de 7 partidos (`TorneoSection.vue`).
4. ✅ **Fase 2**: Premier 20/38 (`LigaSection.vue` formato premier): sortear 19
   con Boca garantizado, fixture ida/vuelta 38 fechas, fecha a fecha con XI
   editable (cambios XI↔banco entre partidos), tabla + racha, simular hasta N,
   clásico fecha especial con pica.
5. ✅ **Fase 3**: Liga 30 (`LigaSection.vue` formato liga30): sortear 29, zonas
   snake 15+15 con clásico separado (`garantizarClasicoZonas`), 15 fechas
   zonales + interzonal fecha 16 vs Boca garantizado con pica, playoffs con
   el top 8 de cada zona a octavos/cuartos/semis/final (`crucesOctavos`),
   tabla con los clasificados resaltados y cuadro de playoffs en vivo.
6. ✅ **Fase 4**: plantel 19/reroll gratis/5 pases en ligas + pestañas XI-Banco
   + cambios manuales + visual (escudos `clubes.escudo` en previa/tabla/sorteo,
   ficha de rival, 4-2-2-2 y 4-3-3(2)=4-3-2-1 elegibles (10), palmarés local por
   formato + racha del clásico, once ideal/MVP/goleador/asistidor por temporada,
   logros `campeon_premier/campeon_liga30/clasico_ganado`).
   Los logros suman 16 códigos (5 nuevos: pase gol, hat-trick, 10 goles,
   campeón invicto y veterano) y cada desbloqueo da 1 medalla persistente
   con rangos cosméticos en `LogrosPanel.vue` (`recompensas.js`).
7. ✅ **Fase 5**: datos (headers 87+79 parsean, typo 4-5-1- normalizado,
   MCOs 2002/2007/2025 ubicables por secundaria, Independiente 1960: 5 finales
   del doc ignorados, se calcula) + scripts fotos/escudos. Escudos del dueño
   aplicados en 79 temporadas rivales (`db/escudos_rivales.sql`) y 87 de River
   (`db/escudos_river.sql`), con `public/escudos/` como fuente local. Queda para
   el cierre del dueño: prueba final de la consigna (pág. 18) y
   export `.sql` desde phpMyAdmin. Apache no se verificó en vivo.
8. ✅ **Fase 6 (cierre de formatos)**: clasificación de grupos de Copa 32 por
   tabla completa (no por pts>=3), ranking/historial con `calendario` y
   `torneos.campeon/valla`, fair play del equipo usuario por
   `partida_jugadores`, amarillas cada 2 sin resetear el total, cambios
   XI↔banco atómicos, modo persistido reconstruido desde el nombre de la
   partida, y restauración de F5/arqueros en carrera. Fotos y escudos del
   dueño importados: 288 avatares WebP de River y 51 escudos WebP (10.3 MB →
   412 KB). Falta la foto de los jugadores rivales, que aporta el dueño.

## Trabajo con Bolt (vistas)

Bolt ayuda con la UI (maqueta/template + CSS) sobre este repo. Reglas para él:
solo toca template y `<style scoped>`; no cambia llamadas a `api.js`, nombres de
estados/props/emits ni reglas del juego; conserva las clases que usa la lógica
(`sel`, `blocked`, `open`, `filled`, `justpicked`, `on`, `gold/silver`,
`rolling`); nada de datos hardcodeados; devuelve cada `.vue` completo.
Acá se pega, se corre `npm run build` y se verifica. Referencia visual: 7a0
(tomar ideas, no copiar).
