# Decisiones del producto 3A1

Registro de decisiones del bloque de UX/UI y estadísticas. Son decisiones de
producto, no del ecosistema Kouvah. Estado: **aceptadas** por el dueño.

## 1. Un torneo a la vez

- **Decisión**: no construir un hub para gestionar varios torneos en paralelo.
- **Por qué**: no hay evidencia de que el usuario necesite comparar torneos
  activos; el foco es terminar y validar una carrera.
- **Consecuencia**: `LigaSection` y `MundialSection` siguen restaurando un solo
  `torneoId` por partida.

## 2. Probabilidades "de las casas de apuestas"

- **Decisión**: mostrar porcentajes calculados con Monte Carlo sobre el **mismo**
  motor `simularPartidoLiga()` que después juega el partido.
- **Por qué**: es matemática real del juego, no un dato externo inventado. Se
  presenta como acción hover/tap con la aclaración "cuotas simuladas".
- **Alternativa descartada**: inventar cuotas fijas o leer apuestas reales.
- **Consecuencia**: nueva función pura `probabilidades()` en `src/game/ligas.js`,
  con tests deterministas.

## 3. Reproductor y tabla por fecha

- **Decisión**: el reproductor recorre fechas jugadas y muestra la tabla tal como
  estaba en ese momento, calculada en el cliente con `tablaHasta()`.
- **Por qué**: evita llamadas a la API por fecha y usa el mismo desempate
  canónico (puntos → diferencia → GF → fair play → id) que `api/tabla.php`.
- **Consecuencia**: flechas de movimiento, flash de subida/bajada y slider
  compartiendo la misma función. Se corrigió el test que esperaba fair play
  descendente: la API ordena `fp ASC`.

## 4. Minuto a minuto y marcador

- **Decisión**: la crónica mezcla `detalle.goleadores` y `detalle.goleadoresRival`
  del partido, ordenados por minuto, con escudo y marcador parcial.
- **Por qué**: esos datos ya se guardan en `calendario.detalle`. No se inventa
  ningún evento.
- **Consecuencia**: los partidos simulados entre rivales no tienen goleadores,
  por eso el panel de estadísticas dice explícitamente "Goleadores (tus
  partidos)".

## 5. Estadísticas con datos existentes

- **Decisión**: bestia negra, rachas, sparkline de puntos, duelo de temporadas y
  rivales más/menos cruzados se derivan de `calendario`, `api/ranking.php` y el
  historial local de rivales.
- **Por qué**: no se agregaron tablas ni columnas nuevas a la base para una
  feature que todavía no está validada.
- **Consecuencia**: el historial por equipo se muestra solo dentro del torneo
  actual; el contador global de cruces viene de `localStorage`.

## 6. "Tu River mezcla N épocas"

- **Decisión**: contar temporadas distintas usando `anio_orden` de
  `api/equipo.php`, con `t.etiqueta` como nombre legible.
- **Por qué**: es dato real de la DB. Se descartó el texto "Tu River 1982" porque
  el plantel nunca es de un solo año.

## 7. Offline y visibilidad de estado

- **Decisión**: guardar un snapshot del torneo en `localStorage` y, si falla la
  API, mostrarlo con un aviso explícito. La tabla se reconstruye localmente.
- **Por qué**: el backend depende de un túnel; el usuario debe poder ver el
  último estado aunque el túnel esté caído, sin confundirlo con dato vivo.
- **Consecuencia**: no se permite jugar partidos offline (eso sí escribiría en
  una BD desactualizada).

## 8. Cosas deliberadamente NO hechas

- No se agregó el "XI sugerido" propuesto: necesitaría una regla nueva no
  validada y podría quitarle agencia al draft.
- No se tocaron las fotos de rivales: el dueño dijo que están en proceso.
- No se creó Kouvah Core ni infraestructura compartida nueva.

## 9. Documentos dentro de la app y carpeta de campo aparte

- **Decisión**: el topbar abre un panel con cuatro pestañas — Manual,
  Curiosidades, Información y Legal — con botón "Imprimir / Guardar PDF".
  La carpeta de campo NO está dentro de la página: es un HTML imprimible
  separado en `docs/carpeta-campo.html`.
- **Por qué**: el dueño pidió expresamente que la ficha no esté dentro de la UI.
  Los textos del panel son contenido, no datos de jugadores: las reglas viven
  en `src/contenido/` y los nombres/OVR siguen viniendo solo de MySQL.
- **Consecuencia**: el panel no modifica ninguna regla ni endpoint; el CSS de
  impresión oculta `#app` e imprime solo la pestaña activa en A4. Los campos de
  titular, domicilio, correo y fecha de revisión del bloque Legal quedan como
  marcadores honestos hasta que el dueño los complete.

## 10. Una sola navbar, cuatro destinos

- **Decisión**: reemplazar el topbar por una navbar con Inicio, Cómo jugar,
  Curiosidades e información y Tus drafts. DraftGame queda montado con `v-show`
  para no perder la partida al navegar. Los documentos completos se abren desde
  el footer.
- **Por qué**: el dueño pidió una navegación única y clara; "Cómo jugar" agrupa
  Manual + Legal y "Curiosidades e información" deja de vivir en el panel.
- **Consecuencia**: `App.vue` es el único dueño de la vista activa. Los textos
  siguen en `src/contenido/` y la carpeta de campo sigue fuera de la UI.

## 11. Fin del modo Diario

- **Decisión**: eliminar el modo Diario del configurador, del panel de tus drafts
  y de los textos. Las filas ya guardadas siguen en MySQL pero se filtran del
  historial (`m.modo !== 'diario'`); no se borra nada de la base.
- **Por qué**: el dueño pidió borrarlo por completo de la experiencia.
- **Consecuencia**: `modoDePartida()` ya no devuelve `diario`: las partidas
  viejas con prefijo `Diario ` se abren como normales. Se borró `DiarioPanel.vue`.

## 12. Rivales, historial y palmarés con datos reales

- **Decisión**: el XV de cada rival se dibuja desde `obtenerJugadores(temporada_id)`
  y `onceRival()`; el historial usa el detalle de `api/historial.php` (signo =
  victorias − derrotas) y "Lo que ganaste" lee `api/ranking.php` (MySQL).
  La racha del clásico queda en un bloque separado y etiquetado como local.
- **Por qué**: el dueño pidió datos verificables, sin hardcode ni insinuaciones.
- **Consecuencia**: no se agregaron tablas nuevas. Se descartó "Mejor 11 histórico"
  por ser una trampa estadística.

## 13. Señales del draft y pases

- **Decisión**: el candado de "sin puesto libre" se muestra en el candidato del
  mazo, no en el jugador ya colocado; el resorteo vuelve a tirar el dado solo;
  "Pasar" es gratis siempre que el plantel sorteado no aporte posiciones faltantes.
- **Por qué**: el dueño detectó los tres casos en uso real.
- **Consecuencia**: cambios de UI y de regla en `DraftGame.vue`; sin tocar la API.

## 14. "De Memoria" reemplaza a "Almanaque"

- **Decisión**: renombrar visiblemente el modo a "De Memoria" en botones y textos.
  Los identificadores internos (`almanaque`, `campeon_almanaque`) y la clave de
  `localStorage` se mantienen por compatibilidad con partidas guardadas.
- **Por qué**: pedido del dueño; cambiar las claves rompería partidas existentes.

## 15. Táctica visible y control de ancho

- **Decisión**: el estilo (ofensivo/equilibrado/defensivo) desplaza el bloque en
  la cancha —adelante, normal o replegado— y el nuevo control Estrecho /
  Equilibrado / Amplio escala las distancias laterales. Ambos afectan la
  simulación: el estilo ya lo hacía, el ancho suma un delta moderado de goles
  a favor y en contra en `EFECTO_ANCHO` (`formations.js`).
- **Por qué**: el dueño pidió que lo que se ve en la cancha coincida con lo que
  se juega, y que el ancho no sea decorativo.
- **Consecuencia**: la transformación es una función pura en `pitch.js`
  (`coordConTactica`) con tests; el ancho se guarda en `localStorage` (no hay
  columna nueva en MySQL) y se reenvía a los tres motores de torneo. El default
  `equilibrado` deja el comportamiento anterior intacto.
- **Alternativa descartada**: agregar una columna `ancho` a `partidas` y tocar
  la API. No aporta nada mientras la simulación es 100% frontend.

## 16. Ayuda contextual en "Tu planteo"

- **Decisión**: cada opción muestra una explicación breve solo al pasar el mouse,
  al enfocarla con teclado o mientras se mantiene presionada en táctil.
- **Por qué**: pedido del dueño; evita frenar a quien ya conoce el juego.
- **Consecuencia**: `data-tip` + un pseudo-elemento CSS en `DraftGame.vue`, sin
  librerías ni estado adicional. Los textos son reglas de interfaz, no datos.

## 17. Ajustes finales de interfaz

- **Globos de ayuda**: las explicaciones de "Tu planteo" y de los logros se muestran
  como notificaciones ancladas al control (con flecha), sin velo ni blur. En
  móvil aparecen al tocar la opción; en escritorio, al pasar el mouse o enfocar.
- **Blur**: el desenfocado de fondo quedó reservado al abrir el XV de un rival
  ("Ver XV"), no a las opciones de configuración.
- **Navegación y pantalla inicial**: se sacaron del menú "Cómo jugar" (sigue en
  Documentos completos), el chip "API online", "Temporada abierta", el aviso
  "Mano caliente" y el marcador de build. La información visible no menciona
  tecnologías ni datos personales del titular.
- **Rivales**: el panel del Inicio es una versión compacta del de Tus drafts,
  con escudos, XV y un botón que abre directamente la sección Rivales.
  El XV de cada rival muestra solo los 11 titulares (sin banco).
- **Últimas partidas**: se muestran de a 5 con paginación ("anteriores" /
  "siguientes") en lugar de extender la página con todas las filas.
- **Suavidad de los despliegues**: las animaciones de apertura (XV del rival y
  globos de ayuda) usan un único `transform` compuesto, no la propiedad
  independiente `scale`, para que el navegador las anime en la GPU. El velo
  con blur del XV se aísla en su propia capa para que no se recalcule en cada
  fotograma.
- **Escudos con fondo blanco**: `recortar_escudos.py` solo veía margen transparente.
  Se agregó `recortar_fondo_blanco_escudos.py`, que elimina por flood-fill el
  blanco opaco conectado al borde y recorta al contenido. Corregidos 15 escudos.
- **Logo del juego**: el PNG del dueño en `docs/` se sirve optimizado como
  `/logo-3a1.webp` (navbar y encabezado de Inicio) y `/favicon.png`.
- **Ajustes del configurador (lote UX)**: “Pasar” ahora vuelve a tirar el dado
  y deja un plantel nuevo listo; se agregó resumen visual antes de “Crear
  partida”, que quedó fijo al pie del panel con ese resumen. Las formaciones se
  muestran como dos filas de cinco “x”. Todos los botones tienen al menos 44 px
  de alto en móvil y el estado elegido lleva tilde + borde grueso. Fuentes:
  Barlow Condensed (números/OVR), Inter (texto y botones) y JetBrains Mono
  (etiquetas chicas). El hero se achicó a una franja y el logo quedó solo en el
  menú; “Cómo jugar” es un botón visible en la barra superior que abre el
  Manual. Se quitó el texto redundante del modo Carrera.
- **Tu Historial** reemplaza al bloque promocional “La historia se juega en la
  cancha”. Es una lista paginada de los 79 rivales del catálogo (incluidos los
  que nunca jugaron), con el signo acordado `+ / = / -` (ganados − perdidos)
  calculado desde `partidos[]` de `historial.php`, más G/E/P y goles a favor y
  en contra. Se consulta `obtenerHistorial(200)` para no perder partidas
  antiguas; "Últimas partidas" sigue mostrando las 20 más recientes.
- **Cierre del draft (fase final)**: el pie de la cancha muestra “Plantel
  completo” cuando el contador llega a 16/16; “Dorsales auto” cubre XI (1–11)
  y banco (12–16); “Reiniciar” sale de “Tu marcador”, queda como acción
  secundaria en la columna izquierda y pide confirmación en un modal. El
  capitán tiene un solo estado visible (aplicado con ✓ o sugerido) y el banco
  avisa “mejor que el titular” cuando un suplente supera al titular más flojo
  de su posición, con cambio en un click vía `intercambiar.php`.
