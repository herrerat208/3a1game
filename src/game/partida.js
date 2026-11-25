// 3A1 — Modo de juego derivado del nombre persistido de la partida.
// La base guarda `modo` como copa/liga (para el tamaño del banco); el modo
// de juego real (normal/carrera) se reconstruye desde el nombre.
// El desafío diario fue eliminado: las partidas viejas con prefijo "Diario "
// se leen como normales para poder seguir abriéndolas, pero no se pueden
// crear nuevas ni aparecen en el historial.
export function modoDePartida(nombre) {
  const n = String(nombre ?? '')
  if (/ · T\d+$/.test(n)) return 'carrera'
  return 'normal'
}
