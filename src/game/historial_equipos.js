// Historial agregado por equipo: una fila por plantel del catálogo, cruzada
// con todos los partidos del usuario. Es lógica pura (sin datos ni fetch) para
// que la usen tanto la pantalla principal como "Tus drafts · Historial".
import { escudoDe } from './fotos.js'

export function claveEquipo(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// Un partido empatado en los 90' y definido por penales no es un empate:
// para el usuario es victoria o derrota según la tanda. El marcador visible
// conserva el empate (2–2) y agrega la tanda entre paréntesis (4–5).
export function signoPartido(partido) {
  const detalle = partido?.detalle ?? null
  if (detalle && typeof detalle.avanzo_usuario === 'boolean') {
    return detalle.avanzo_usuario ? 1 : -1
  }
  const tanda = detalle?.tanda ?? null
  if (tanda) {
    if (typeof tanda.ganador === 'boolean') return tanda.ganador ? 1 : -1
    const mios = Number(tanda.mios)
    const suyos = Number(tanda.suyos)
    if (Number.isFinite(mios) && Number.isFinite(suyos) && mios !== suyos) {
      return mios > suyos ? 1 : -1
    }
  }
  const gf = Number(partido?.gf)
  const gc = Number(partido?.gc)
  if (Number.isFinite(gf) && Number.isFinite(gc)) {
    return gf > gc ? 1 : gf < gc ? -1 : 0
  }
  const signo = Number(partido?.signo)
  return signo === 1 ? 1 : signo === -1 ? -1 : 0
}

// El signo acordado es victorias − derrotas:
// + si ganaste más, = si empataste en cantidad, − si perdiste más.
export function construirHistorialEquipos(temporadas = [], partidas = []) {
  const porId = new Map()
  const porNombre = new Map()
  const filas = []

  for (const t of temporadas) {
    const fila = {
      id: t.temporada_id ?? t.id,
      club: t.club ?? t.etiqueta,
      etiqueta: t.etiqueta ?? t.club,
      escudo: escudoDe(t),
      g: 0, e: 0, p: 0, gf: 0, gc: 0, partidos: 0
    }
    filas.push(fila)
    porId.set(fila.id, fila)
    porNombre.set(claveEquipo(fila.etiqueta), fila)
    if (!porNombre.has(claveEquipo(fila.club))) porNombre.set(claveEquipo(fila.club), fila)
  }

  for (const partida of partidas) {
    for (const m of partida.partidos ?? []) {
      const fila = porId.get(m.rival_temporada_id)
        ?? porNombre.get(claveEquipo(m.etiqueta))
        ?? porNombre.get(claveEquipo(m.rival))
        ?? porNombre.get(claveEquipo(m.club))
      if (!fila) continue
      fila.partidos++
      fila.gf += Number(m.gf) || 0
      fila.gc += Number(m.gc) || 0
      const signo = signoPartido(m)
      if (signo > 0) fila.g++
      else if (signo < 0) fila.p++
      else fila.e++
    }
  }

  return filas.map((f) => ({
    ...f,
    signo: f.g - f.p > 0 ? 1 : f.g - f.p < 0 ? -1 : 0
  })).sort((a, b) =>
    (b.partidos > 0) - (a.partidos > 0)
    || b.signo - a.signo
    || Math.abs(b.g - b.p) - Math.abs(a.g - a.p)
    || b.partidos - a.partidos
    || String(a.club).localeCompare(String(b.club), 'es')
    || String(a.etiqueta).localeCompare(String(b.etiqueta), 'es')
  )
}
