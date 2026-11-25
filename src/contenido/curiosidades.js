// Curiosidades del juego y de los datos históricos. Texto visible, sin notas
// de desarrollo ni detalles internos.

export const curiosidades = [
  {
    titulo: 'Del dado al draft',
    bloques: [
      { tipo: 'p', texto: '3A1 nació a partir de 7A0. En su primera versión, se tiraba un dado que determinaba un plantel real y permitía elegir un jugador que hubiera formado parte de él.' },
      { tipo: 'p', texto: 'En 3A1, el dado fue reemplazado por un mazo de temporadas: aparece un año de River Plate, elegís un jugador de ese plantel y lo ubicás en la cancha.' },
      { tipo: 'p', texto: 'La diferencia principal es que el equipo se construye jugador por jugador y después debe afrontar una competición completa, fecha por fecha, contra rivales que existieron en la historia del fútbol.' }
    ]
  },
  {
    titulo: 'River a través de las décadas',
    bloques: [
      { tipo: 'p', texto: 'El juego reúne planteles de River Plate de muchas temporadas. Esto permite recorrer distintas generaciones del club y combinar futbolistas que pertenecieron a épocas diferentes.' },
      { tipo: 'p', texto: 'Cada temporada representa una oportunidad para descubrir jugadores, recuperar nombres históricos y construir equipos con futbolistas que nunca compartieron una cancha en la realidad.' }
    ]
  },
  {
    titulo: 'Los rivales tienen historia',
    bloques: [
      { tipo: 'p', texto: 'Los equipos rivales no son planteles inventados: los incluidos en el juego corresponden a equipos que consiguieron títulos en sus respectivas competiciones.' },
      { tipo: 'p', texto: 'Cada temporada del archivo aporta una parte de la historia futbolística que sirve como escenario para las competiciones de 3A1.' }
    ]
  },
  {
    titulo: 'El OVR se calcula, no se copia',
    bloques: [
      { tipo: 'p', texto: 'Las valoraciones de los jugadores se construyen a partir de sus logros históricos.' },
      { tipo: 'p', texto: 'Los futbolistas de River reciben bonificaciones según tres criterios:' },
      { tipo: 'ul', items: [
        '+1 por haber sido campeón.',
        '+3 por haber sido MVP.',
        '+2 por haber sido estrella.'
      ] },
      { tipo: 'p', texto: 'Los jugadores de los equipos rivales, cuyos planteles corresponden a campeones, reciben +1 por campeonato, +2 por MVP y +1 por estrella.' },
      { tipo: 'p', texto: 'De esta manera, la valoración final no depende únicamente de un número asignado, sino también de los reconocimientos obtenidos durante cada temporada.' }
    ]
  },
  {
    titulo: 'Siempre aparece Boca',
    bloques: [
      { tipo: 'p', texto: 'No importa qué combinación de equipos salga en el sorteo: Boca siempre está presente como rival del clásico.' },
      { tipo: 'p', texto: 'En Argentina, el enfrentamiento se disputa en la fecha interzonal. En las demás competiciones, Boca forma parte del fixture.' },
      { tipo: 'p', texto: 'El clásico también tiene un relato y un logro propios, aunque no otorga bonificaciones adicionales de puntos.' }
    ]
  },
  {
    titulo: 'El desafío 7A0',
    bloques: [
      { tipo: 'p', texto: 'El objetivo máximo del Mundial es conseguir el 7A0: salir campeón sin recibir ningún gol durante toda la competición.' },
      { tipo: 'p', texto: 'No alcanza con ganar los partidos. Hay que mantener la valla invicta desde el comienzo hasta la final.' },
      { tipo: 'p', texto: 'Es uno de los desafíos más exigentes que propone 3A1.' }
    ]
  },
  {
    titulo: 'Cada partida es diferente',
    bloques: [
      { tipo: 'p', texto: 'Los equipos rivales se distribuyen en cuatro bombos según su OVR para equilibrar los grupos y las zonas.' },
      { tipo: 'p', texto: 'A partir de esos bombos se generan distintas combinaciones de rivales y fixtures. Por eso, dos partidas pueden tener recorridos completamente diferentes, incluso cuando se utiliza el mismo formato de competición.' }
    ]
  },
  {
    titulo: 'Fútbol de otras épocas',
    bloques: [
      { tipo: 'p', texto: 'Una de las particularidades de 3A1 es que permite reunir jugadores de distintas generaciones en un mismo equipo.' },
      { tipo: 'p', texto: 'Podés combinar futbolistas de temporadas separadas por décadas, elegir distintas formaciones y construir un plantel que nunca existió en la realidad.' },
      { tipo: 'p', texto: 'La historia proporciona los jugadores; el draft te permite escribir una nueva versión de esa historia.' }
    ]
  }
]
