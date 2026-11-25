// Texto del manual: reglas y explicaciones visibles, sin notas internas.

export const manual = [
  {
    titulo: '1. Qué es 3A1',
    bloques: [
      { tipo: 'p', texto: '3A1 es un juego de draft de fútbol histórico. Armás tu equipo con jugadores que realmente jugaron en River Plate y lo hacés competir contra rivales reales, sorteados entre 79 planteles campeones.' },
      { tipo: 'p', texto: 'La idea viene de 7a0: tirar un dado, ver un plantel real, elegir un jugador que jugó ahí y completar el equipo. Acá el equipo se arma de a uno y después se juega una competencia fecha por fecha.' },
      { tipo: 'nota', texto: 'El equipo se llama siempre River Plate. Los rivales no se draftean: existen solo para la simulación y las estadísticas.' }
    ]
  },
  {
    titulo: '2. Empezar una partida',
    bloques: [
      { tipo: 'ol', items: [
        'Entrá en la Zona de juego y elegí formato: Mundial, Premier o Argentina.',
        'Elegí una formación (hay 10) y una mentalidad: ofensiva, equilibrada o defensiva. La mentalidad adelanta o replega el bloque en la cancha y cambia la simulación.',
        'Elegí el planteo: Estrecho, Equilibrado o Amplio. Estrecho cierra espacios y concede menos; Amplio abre el juego y genera más, con más riesgo. El planteo también se ve en la cancha.',
        'Tocá Crear partida. El nombre del equipo ya está puesto.',
        'Tocá Tirar. Sale un plantel de River de un año concreto y se revela el mazo con una animación.',
        'Elegí un jugador del mazo y después tocá el punto verde compatible de la cancha. La elección guarda al instante.',
        'Repetí hasta completar el XI y el banco, poné capitán y dorsales, y cerrá el draft.'
      ] },
      { tipo: 'nota', texto: 'Un sorteo da un solo jugador. Si el año no sirve, podés Pasar (3 pases en copa, 5 en ligas) o usar el resorteo gratis cuando el plantel no aporta a las posiciones que faltan.' }
    ]
  },
  {
    titulo: '3. Armar el XI y el banco',
    bloques: [
      { tipo: 'p', texto: 'La cancha muestra los puntos del once titular y la pestaña Banco los suplentes. Un punto verde significa que el jugador elegido puede ocuparlo: vale su posición natural o una secundaria. El juego rechaza cualquier puesto inexistente o incompatible.' },
      { tipo: 'ul', items: [
        'Mundial: plantel de 16 (XI + 5 suplentes).',
        'Premier y Argentina: plantel de 19 (XI + 8 suplentes).',
        'Sin repetidos: no podés elegir dos veces al mismo jugador del mismo año.',
        'La misma persona en otro año sí se puede sumar al plantel.',
        'Cada sorteo usa un plantel distinto dentro de la misma partida.',
        'El buscador y el filtro por posición del mazo sirven para ubicar rápido a un jugador.',
        'Cambios XI ↔ banco: se hacen entre partidos, nunca en vivo.'
      ] },
      { tipo: 'p', texto: 'Al cerrar el draft son obligatorios el capitán (brazalete ©) y los dorsales del XI (1-99, sin repetir). El banco debe cubrir las tres líneas de campo: defensa, medio y ataque. El arquero va solo al once y aparece bloqueado al armar el banco. Además, cada suplente debe poder jugar en algún puesto del once y no puede haber más de dos del mismo puesto natural.' },
      { tipo: 'nota', texto: 'Las elecciones son definitivas: no hay botón de quitar ni confirmación intermedia. Elegir jugador y puesto queda guardado al instante; podés cerrar la pestaña y retomar después.' }
    ]
  },
  {
    titulo: '4. Formatos',
    bloques: [
      { tipo: 'h3', texto: 'Mundial' },
      { tipo: 'p', texto: 'River Plate más 31 rivales sorteados entre los 79 planteles campeones. Sorteo balanceado por bombos con cabezas de serie: 8 grupos de 4, clasifican los dos primeros de cada grupo, octavos cruzados y cuadro fijo hasta la final en Madrid. Son 7 partidos.' },
      { tipo: 'h3', texto: 'Premier' },
      { tipo: 'p', texto: 'River Plate más 19 rivales. Fixture de ida y vuelta: 38 fechas. Se juega fecha a fecha y se puede simular hasta la fecha que quieras.' },
      { tipo: 'h3', texto: 'Argentina' },
      { tipo: 'p', texto: 'River Plate más 29 rivales, repartidos en dos zonas de 15 por sistema snake según OVR. Fecha 1 a 15 de zona, fecha 16 interzonal con el clásico contra Boca garantizado, y playoffs del 17 al 20: octavos cruzados (1°A-8°B, etc.), cuartos, semifinales y final. Clasifican los ocho primeros de cada zona.' },
      { tipo: 'nota', texto: 'Cada partida sortea rivales distintos: nunca te va a tocar exactamente la misma copa o liga dos veces. Boca siempre aparece como rival del clásico.' }
    ]
  },
  {
    titulo: '5. Jugar una fecha',
    bloques: [
      { tipo: 'ol', items: [
        'En la previa se ven los escudos de época, el OVR de ambos equipos, el historial y las casas de apuestas: pasá el mouse o tocá “¿Qué dicen las casas de apuestas?” para ver los porcentajes de la misma simulación que después juega el partido.',
        'Tocá Jugar. El relato se escribe minuto a minuto, con goleadores, asistencias, figura y calificaciones.',
        'La crónica “Minuto a minuto” muestra cada gol con el escudo del equipo, el jugador y el marcador parcial.',
        'El marcador tipo tablero se actualiza con los goles; si salís campeón cae confeti y el equipo queda marcado con estrellas.',
        'El resto de los partidos de la fecha se simula automáticamente y la tabla se actualiza sola.',
        'Después podés seguir a la fecha siguiente, simular hasta una fecha (en ligas) o volver al presente con el reproductor de temporada.'
      ] },
      { tipo: 'p', texto: 'El resultado, el detalle y la tabla quedan guardados: podés cerrar la pestaña y retomar después.' },
      { tipo: 'nota', texto: 'Se puede ver el último estado guardado sin conexión, pero no se puede jugar offline: la simulación y el guardado necesitan conexión con el servicio del juego.' }
    ]
  },
  {
    titulo: '6. Tabla y desempates',
    bloques: [
      { tipo: 'p', texto: 'La tabla muestra siempre todas las filas, a ancho completo: #, Equipo, PJ, G, E, P, GF, GC, Dif, Pts y Últimos 5. Cada equipo tiene cinco puntitos con el resultado de sus últimos partidos y una flecha de tendencia. En pantallas chicas se puede desplazar horizontalmente, nunca hacia abajo.' },
      { tipo: 'ol', items: [
        'Puntos ganados (3 por victoria, 1 por empate).',
        'Diferencia de gol.',
        'Goles a favor.',
        'Fair play (menos sanciones).',
        'Sorteo.'
      ] },
      { tipo: 'p', texto: 'El reproductor de temporada tiene un slider y el botón ▶ Reproducir temporada: recorre la tabla fecha por fecha y resalta con un flash las filas que cambiaron. Volver al presente te devuelve a la tabla actual.' },
      { tipo: 'nota', texto: 'En el cierre se muestran goleadores, asistidores, once ideal y MVP de cada temporada, además del palmarés por formato.' }
    ]
  },
  {
    titulo: '7. Tarjetas, cambios y capitán',
    bloques: [
      { tipo: 'p', texto: 'Las amarillas se acumulan: cada dos amarillas el jugador se pierde el partido siguiente; la roja lo saca de inmediato. Las sanciones se cumplen con el banco. Si no hay suplente para cubrir el puesto, se avisa y se juega con diez.' },
      { tipo: 'p', texto: 'Los cambios se hacen solo entre partidos: arrastrando en la cancha o desde la sección del torneo. No se permite cambiar un once en el medio de un partido.' },
      { tipo: 'ul', items: [
        'El capitán lleva el brazalete © y desempata la elección de figura.',
        'Sinergia: 3 jugadores del mismo club y año suman +1 al OVR efectivo; 5 o más suman +2 (tope).',
        'OVR del equipo: promedio simple de los once titulares.',
        'El OVR final de cada jugador se calcula: River suma +1 si ese año fue campeón, +3 si fue MVP o +2 si fue estrella; los rivales (todos campeones) suman +2 por MVP o +1 por estrella.'
      ] }
    ]
  },
  {
    titulo: '8. Estadísticas y modos',
    bloques: [
      { tipo: 'p', texto: 'El panel de estadísticas reúne a los goleadores del torneo, la bestia negra (el rival contra el que mejor rendimiento tenés), los rivales más y menos cruzados, el historial por equipo con su sparkline de puntos y el duelo de temporadas.' },
      { tipo: 'p', texto: '“Tu plantel mezcla N épocas” indica cuántos años distintos aportaron jugadores a tu plantel, ordenados por año real de cada plantel.' },
      { tipo: 'ul', items: [
        'Normal: una partida, una competencia.',
        'Carrera: tres o más torneos seguidos, conservando cinco jugadores entre uno y otro.',
        'Revancha amistosa: se repite el fixture, pero no suma logros ni ranking.'
      ] },
      { tipo: 'p', texto: 'Logros: debut, campeón, 7A0 (campeón con valla invicta), humilde, de memoria, goleada, vallas y revancha. En el Mundial, el gran objetivo es 7A0.' }
    ]
  },
  {
    titulo: '9. Logros y medallas',
    bloques: [
      { tipo: 'p', texto: 'Los logros se desbloquean solos cuando se cumple su condición jugando: debutar, salir campeón, ganar el clásico, terminar un torneo invicto, convertir goleadas, mantener vallas, jugar de memoria y otras metas. No hay que activarlos ni pedirlos.' },
      { tipo: 'ul', items: [
        'Cada logro suma una medalla. La dificultad de la competencia define su color: 7 partidos da bronce, Mundial da plata, Premier da oro y Argentina da diamante.',
        'Jugar de memoria sube un escalón, hasta diamante. Carrera solo se muestra en la etiqueta: no cambia la medalla.',
        'Los logros más difíciles (5 goles de un jugador, 5 pases gol, torneo perfecto, valla total y clásico doble) aseguran una medalla de diamante aunque se consigan en un formato más fácil.',
        'La revancha amistosa no suma logros ni medallas.',
        'En “Tus drafts · Logros” podés ver cuándo se consiguió cada uno, cómo se desbloquea, la dificultad y el detalle de medallas. En el inicio solo se muestra el resumen.'
      ] },
      { tipo: 'p', texto: 'Tus logros y medallas se guardan en este dispositivo junto con el progreso de la partida, para que sigan ahí cuando volvés. No hace falta iniciar sesión.' },
      { tipo: 'nota', texto: 'Si jugás en otro dispositivo, los logros locales se cuentan desde cero; los títulos de cada partida se consultan con su identificador.' }
    ]
  },
  {
    titulo: '10. Atajos y preguntas frecuentes',
    bloques: [
      { tipo: 'ul', items: [
        'T: mostrar u ocultar la ayuda rápida “Cómo jugar” dentro del draft.',
        'Esc: cerrar paneles y volver a la vista anterior.',
        'La guía rápida se recuerda: una vez cerrada, no vuelve a aparecer.'
      ] },
      { tipo: 'h3', texto: '¿Puedo borrar un jugador que elegí?' },
      { tipo: 'p', texto: 'No. Las elecciones son definitivas, como en 7a0. Solo se pueden intercambiar titulares y suplentes entre partidos.' },
      { tipo: 'h3', texto: '¿Por qué un punto de la cancha no está verde?' },
      { tipo: 'p', texto: 'Porque el jugador elegido no juega en ese puesto natural ni secundario, o porque ese slot ya está ocupado.' },
      { tipo: 'h3', texto: '¿Qué pasa si se corta la conexión?' },
      { tipo: 'p', texto: 'El equipo y el torneo siguen guardados. Al volver a abrir la página se recupera todo.' },
      { tipo: 'h3', texto: '¿Se puede jugar sin conexión?' },
      { tipo: 'p', texto: 'No. El estado se puede consultar sin conexión, pero jugar y guardar requieren conexión con el servicio del juego.' }
    ]
  }
]
