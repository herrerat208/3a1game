import { claveRival } from './variedad.js'

export function ovrDe(r) {
  return r.ovr_equipo ?? 84
}

export function mezclar(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function porBombos(rivales, nBombos = 4) {
  const orden = [...rivales].sort((a, b) => ovrDe(b) - ovrDe(a))
  const tam = Math.ceil(orden.length / nBombos)
  return Array.from({ length: nBombos }, (_, i) => orden.slice(i * tam, (i + 1) * tam))
}

// El usuario ve repetido el CLUB, no la temporada: Boca 1962 y Boca 2008
// son el mismo rival a efectos de variedad. Los rivales sintéticos de los
// tests no traen club y quedan fuera del tope.
function clubDe(rival) {
  const club = rival?.club ?? rival?.club_nombre ?? rival?.club_id
  if (club === null || club === undefined || club === '') return null
  return String(club).toLocaleLowerCase('es').trim()
}

export function sortearRivales(rivales, cantidad, {
  bombos = 4, usos = {}, maxPorClub = 0, fijos = []
} = {}) {
  if (rivales.length < cantidad) throw new Error('No hay rivales suficientes para el sorteo')
  const pots = porBombos(rivales, bombos)
  const base = Math.floor(cantidad / bombos)
  let resto = cantidad % bombos
  const usosSeguros = usos ?? {}
  const porClub = new Map()
  const contar = (rival) => {
    const club = clubDe(rival)
    if (club) porClub.set(club, (porClub.get(club) ?? 0) + 1)
  }
  for (const f of fijos) contar(f)
  const cabe = (rival) => {
    if (!maxPorClub) return true
    const club = clubDe(rival)
    return !club || (porClub.get(club) ?? 0) < maxPorClub
  }

  const out = []
  for (const pot of pots) {
    const n = base + (resto > 0 ? 1 : 0)
    if (resto > 0) resto--
    // Mezclar primero y ordenar después por uso: desempata al azar.
    const orden = mezclar(pot).sort((a, b) =>
      (usosSeguros[claveRival(a)] ?? 0) - (usosSeguros[claveRival(b)] ?? 0))
    let tomados = 0
    for (const r of orden) {
      if (tomados >= n) break
      if (!cabe(r)) continue
      out.push(r)
      contar(r)
      tomados++
    }
  }
  const elegidos = new Set([...out, ...fijos])
  for (const r of mezclar(rivales)) {
    if (out.length >= cantidad) break
    if (!elegidos.has(r) && cabe(r)) {
      elegidos.add(r)
      out.push(r)
      contar(r)
    }
  }
  // Si el tope por club impidiera completar el lote (pool chico), se relaja
  // antes que dejar un torneo a medias. En producción no llega a pasar.
  if (out.length < cantidad) {
    for (const r of mezclar(rivales)) {
      if (out.length >= cantidad) break
      if (!elegidos.has(r)) {
        elegidos.add(r)
        out.push(r)
      }
    }
  }
  return mezclar(out.slice(0, cantidad))
}

export function sortearConGarantia(rivales, cantidad, pred, opts = {}) {
  const candidatos = mezclar(rivales.filter(pred))
  if (!candidatos.length) throw new Error('Ningún rival cumple la condición garantizada')
  const usos = opts.usos ?? {}
  // El fijo (el clásico) también rota: entre los menos usados, al azar.
  const elegido = candidatos.slice().sort((a, b) =>
    (usos[claveRival(a)] ?? 0) - (usos[claveRival(b)] ?? 0))[0]
  const resto = rivales.filter((r) => r !== elegido)
  return [elegido, ...sortearRivales(resto, cantidad - 1, {
    ...opts, fijos: [elegido]
  })]
}

export function armarZonas(equipos, nZonas = 2) {
  const orden = [...equipos].sort((a, b) => ovrDe(b) - ovrDe(a))
  const zonas = Array.from({ length: nZonas }, () => [])
  orden.forEach((e, i) => {
    const vuelta = Math.floor(i / nZonas) % 2 === 1
    const idx = vuelta ? nZonas - 1 - (i % nZonas) : i % nZonas
    zonas[idx].push(e)
  })
  return zonas
}

export function armarGrupos(equipos32) {
  if (equipos32.length !== 32) throw new Error('El Mundial necesita 32 equipos')
  const pots = porBombos(equipos32, 4)
  return Array.from({ length: 8 }, (_, g) => pots.map((p) => p[g]).filter(Boolean))
}

export function promedioLote(equipos) {
  if (!equipos.length) return 0
  return equipos.reduce((a, e) => a + ovrDe(e), 0) / equipos.length
}
