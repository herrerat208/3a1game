// El simulador devuelve siempre los goles desde la perspectiva del usuario:
// `favor` = propios, `contra` = rival. Pero en la tabla `calendario`, `gf` es
// del local_id y `gc` del visita_id. Si el usuario juega de visitante hay que
// invertirlos antes de guardar; si no, un 2-1 ganado queda como derrota.
export function golesParaCalendario(ladoMio, favor, contra) {
  return ladoMio === 'local'
    ? { gf: favor, gc: contra }
    : { gf: contra, gc: favor }
}

// inversión para leer un partido ya guardado desde la perspectiva del usuario.
export function golesDesdeMiPerspectiva(ladoMio, c) {
  return ladoMio === 'local'
    ? { favor: c.gf, contra: c.gc }
    : { favor: c.gc, contra: c.gf }
}
