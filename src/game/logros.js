// Logros que se infieren del detalle ya guardado de cada partido.
// No hay reglas nuevas de simulación: solo se leen goleadores/asistencias,
// marcadores y la marca de clásico que el componente calcula del calendario.
// Las revanchas amistosas nunca cuentan para estos logros.
const MIN_PARTIDOS_TEMPORADA = 7

export function logrosDeTorneo({ campeon = false, partidos = [] } = {}) {
  const cods = []
  const oficiales = partidos.filter((c) => !c.amistoso)
  if (!oficiales.length) return cods

  const goles = oficiales.reduce((a, c) => a + (Number(c.gf) || 0), 0)
  if (goles >= 10) cods.push('diez_goles')
  if (campeon && oficiales.every((c) => (Number(c.gf) || 0) >= (Number(c.gc) || 0))) {
    cods.push('campeon_invicto')
  }

  const porJugador = new Map()
  let asistencias = 0
  for (const c of oficiales) {
    for (const g of c.detalle?.goleadores ?? []) {
      if (g.asistencia || g.asistenciaId) asistencias++
      const nombre = g.jugador
      if (nombre) porJugador.set(nombre, (porJugador.get(nombre) ?? 0) + 1)
    }
  }
  if (asistencias > 0) cods.push('asistencia') // compatibilidad con el logro viejo
  const maxGolesJugador = Math.max(0, ...porJugador.values())
  if (maxGolesJugador >= 3) cods.push('hat_trick') // compatibilidad

  // Los logros nuevos son de competencia completa: exigen al menos 7
  // partidos oficiales. Así un amistoso, una muestra corta o un torneo
  // incompleto no los desbloquea por accidente.
  if (oficiales.length >= MIN_PARTIDOS_TEMPORADA) {
    if (asistencias >= 5) cods.push('cinco_asistencias')
    if (maxGolesJugador >= 5) cods.push('cinco_goles_un_jugador')
    if (oficiales.every((c) => (Number(c.gf) || 0) > (Number(c.gc) || 0))) {
      cods.push('torneo_perfecto')
    }
    if (oficiales.every((c) => Number(c.gc) === 0)) {
      cods.push('valla_total')
    }
  }

  // El clásico de ida y vuelta se decide en la Liga. El componente marca qué
  // partidos son contra Boca (`clasico`) usando local/visita ya guardados;
  // acá solo se cuentan victorias, sin conocer nombres de equipos.
  const clasicos = oficiales.filter((c) => c.clasico)
  if (clasicos.length >= 2 && clasicos.every((c) => (Number(c.gf) || 0) > (Number(c.gc) || 0))) {
    cods.push('clasico_doble')
  }

  return cods
}
