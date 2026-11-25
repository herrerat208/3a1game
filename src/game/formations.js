import { lineasPrensa } from './prensa.js'

export const RONDAS = [
  'Fase de grupos · Fecha 1',
  'Fase de grupos · Fecha 2',
  'Fase de grupos · Fecha 3',
  'Octavos de final',
  'Cuartos de final',
  'Semifinal',
  'Final'
]

const EFECTO_ESTILO = {
  ofensivo: { favor: 0.28, contra: 0.22 },
  equilibrado: { favor: 0, contra: 0 },
  defensivo: { favor: -0.18, contra: -0.28 }
}

// Ancho del plantel sobre la cancha. Es una regla de simulación, no un dato:
// estrecho compacta la defensa (menos goles en contra, algo menos de ataque)
// y amplio abre el juego (más ocasiones, también más espacios atrás).
export const EFECTO_ANCHO = {
  estrecho: { favor: -0.08, contra: -0.16 },
  equilibrado: { favor: 0, contra: 0 },
  amplio: { favor: 0.12, contra: 0.16 }
}

// Goles por partido: Poisson con media ajustada por diferencia de OVR.
// La media base (1,32) da ~2,6 goles totales, cerca del fútbol real. Antes el
// mínimo era 1 gol por equipo y los partidos promediaban 4,2.
const GOLES_BASE = 1.32
const GOLES_POR_OVR = 0.085
const GOLES_MAX = 7

export function golesPoisson(lambda, azar = Math.random) {
  const media = Math.max(0.08, Math.min(4.2, Number(lambda) || 0))
  const L = Math.exp(-media)
  const u = azar()
  let p = L
  let acumulado = p
  let k = 0
  while (u > acumulado && k < GOLES_MAX) {
    k++
    p *= media / k
    acumulado += p
  }
  return k
}


const PESO_GOL = { DC: 5, ED: 3, EI: 3, MCO: 3, MD: 2, MI: 2, MC: 2, MCD: 2 }

function peso(j) {
  return PESO_GOL[j.posicion_natural] ?? 1
}

export function promedioOvr(equipo) {
  if (!equipo.length) return 0
  const total = equipo.reduce((acc, j) => acc + Number(j.ovr_final), 0)
  return Math.round((total / equipo.length) * 10) / 10
}

export function sinergias(equipo) {
  const grupos = {}
  for (const j of equipo) {
    const k = `${j.club} ${j.anio_orden}`
    grupos[k] = (grupos[k] ?? 0) + 1
  }
  let bonus = 0
  const detalle = []
  for (const [k, n] of Object.entries(grupos)) {
    if (n >= 5) {
      bonus += 2
      detalle.push({ grupo: k, count: n, bonus: 2 })
    } else if (n >= 3) {
      bonus += 1
      detalle.push({ grupo: k, count: n, bonus: 1 })
    }
  }
  return { bonus: Math.min(2, bonus), detalle }
}

export function ovrEfectivo(equipo) {
  return Math.round((promedioOvr(equipo) + sinergias(equipo).bonus) * 10) / 10
}

// Medias del partido del usuario. Se exponen para la previa: son las mismas
// que usa simularPartido, así que "goles esperados" no es un dato decorativo.
export function mediasGoles(ovrPromedio, rivalOvr = 84, estilo = 'equilibrado', jugadoresEnCampo = 11, anchura = 'equilibrado') {
  const ef = EFECTO_ESTILO[estilo] ?? EFECTO_ESTILO.equilibrado
  const an = EFECTO_ANCHO[anchura] ?? EFECTO_ANCHO.equilibrado
  const ovrEfectivo = jugadoresEnCampo === 10 ? ovrPromedio - 3 : ovrPromedio
  const diff = Math.max(-24, Math.min(24, ovrEfectivo - rivalOvr))
  const ventaja = diff * GOLES_POR_OVR
  return {
    favor: Math.max(0.08, GOLES_BASE + ventaja + ef.favor + an.favor),
    contra: Math.max(0.08, GOLES_BASE - ventaja + ef.contra + an.contra)
  }
}

export function simularPartido(ovrPromedio, rivalOvr = 84, estilo = 'equilibrado', jugadoresEnCampo = 11, anchura = 'equilibrado', azar = Math.random) {
  const { favor: mediaFavor, contra: mediaContra } = mediasGoles(ovrPromedio, rivalOvr, estilo, jugadoresEnCampo, anchura)
  return {
    favor: golesPoisson(mediaFavor, azar),
    contra: golesPoisson(mediaContra, azar)
  }
}

export function elegirGoleadores(equipo, goles, capitanId = null) {
  const bolsa = []
  for (const j of equipo) {
    if (j.posicion_natural === 'ARQ') continue
    const w = peso(j) + (capitanId && j.temporada_jugador_id === capitanId ? 1 : 0)
    for (let k = 0; k < w; k++) bolsa.push(j)
  }
  if (!bolsa.length) return []
  const mins = new Set()
  const out = []
  for (let g = 0; g < goles; g++) {
    const j = bolsa[Math.floor(Math.random() * bolsa.length)]
    let min = 1 + Math.floor(Math.random() * 90)
    while (mins.has(min)) min = 1 + Math.floor(Math.random() * 90)
    mins.add(min)
    out.push({ minuto: min, jugador: j.nombre, id: j.temporada_jugador_id })
  }
  return out.sort((a, b) => a.minuto - b.minuto)
}

export function elegirGolesConAsistencias(equipo, goles, capitanId = null) {
  const bolsa = []
  for (const j of equipo) {
    if (j.posicion_natural === 'ARQ') continue
    const w = peso(j) + (capitanId && j.temporada_jugador_id === capitanId ? 1 : 0)
    for (let k = 0; k < w; k++) bolsa.push(j)
  }
  if (!bolsa.length) return []
  const mins = new Set()
  const out = []
  for (let g = 0; g < goles; g++) {
    const j = bolsa[Math.floor(Math.random() * bolsa.length)]
    let min = 1 + Math.floor(Math.random() * 90)
    while (mins.has(min)) min = 1 + Math.floor(Math.random() * 90)
    mins.add(min)
    let asistencia = null
    if (Math.random() < 0.75 && bolsa.length > 1) {
      const otros = bolsa.filter((x) => x.temporada_jugador_id !== j.temporada_jugador_id)
      if (otros.length) {
        const a = otros[Math.floor(Math.random() * otros.length)]
        asistencia = { jugador: a.nombre, id: a.temporada_jugador_id }
      }
    }
    out.push({
      minuto: min, jugador: j.nombre, id: j.temporada_jugador_id,
      asistencia: asistencia?.jugador ?? null,
      asistenciaId: asistencia?.id ?? null
    })
  }
  return out.sort((a, b) => a.minuto - b.minuto)
}

export function rankingAportes(goleadores) {
  const mapa = new Map()
  const sumar = (nombre, id, esGol) => {
    if (!nombre) return
    const k = id ?? nombre
    const cur = mapa.get(k) ?? { jugador: nombre, id, g: 0, a: 0 }
    if (esGol) cur.g++
    else cur.a++
    mapa.set(k, cur)
  }
  for (const g of goleadores) {
    sumar(g.jugador, g.id ?? null, true)
    if (g.asistencia) sumar(g.asistencia, g.asistenciaId ?? null, false)
  }
  return [...mapa.values()]
    .map((r) => ({ ...r, pts: r.g * 2 + r.a }))
    .sort((a, b) => b.pts - a.pts || b.g - a.g || b.a - a.a)
}

export function mvpAportes(goleadores) {
  const r = rankingAportes(goleadores)
  return r.length ? r[0] : null
}

export function simularTanda(ovr, rivalOvr, capitanEsArquero = false) {
  const diff = ovr - rivalOvr
  const pMio = Math.min(0.9, Math.max(0.5, 0.72 + diff * 0.02))
  const pRival = Math.min(0.9, Math.max(0.5, 0.72 - diff * 0.02 - (capitanEsArquero ? 0.08 : 0)))
  const remates = []
  let mios = 0
  let suyos = 0
  for (let r = 0; r < 5; r++) {
    const convierto = Math.random() < pMio
    const convierteRival = Math.random() < pRival
    if (convierto) mios++
    if (convierteRival) suyos++
    remates.push({ orden: r + 1, convierto, convierteRival })
    const restan = 4 - r
    if (mios > suyos + restan || suyos > mios + restan) break
  }
  let muerte = 0
  while (mios === suyos && muerte < 10) {
    muerte++
    const convierto = Math.random() < pMio
    const convierteRival = Math.random() < pRival
    if (convierto) mios++
    if (convierteRival) suyos++
    remates.push({ orden: 5 + muerte, convierto, convierteRival, muerteSubita: true })
  }
  return { mios, suyos, ganador: mios > suyos, remates }
}

export function simularTorneo(equipo, rivales, estilo = 'equilibrado', capitan = null, offsetRonda = 0, anchura = 'equilibrado', azar = Math.random) {
  const ovr = promedioOvr(equipo) + sinergias(equipo).bonus
  const capId = capitan?.temporada_jugador_id ?? null
  const capEsArquero = capitan?.posicion_natural === 'ARQ'
  const partidos = []
  let puntos = 0
  let valla = true

  for (let i = 0; i < rivales.length; i++) {
    const idx = offsetRonda + i
    if (idx >= RONDAS.length) break
    const rival = rivales[i % rivales.length]
    const { favor, contra } = simularPartido(ovr, rival.ovr_equipo ?? 84, estilo, 11, anchura, azar)
    if (contra > 0) valla = false
    const esGrupo = idx < 3
    let avanzo = true
    let tanda = null
    if (esGrupo) {
      if (favor > contra) puntos += 3
      else if (favor === contra) puntos += 1
      else avanzo = false
      if (idx === 2 && offsetRonda === 0 && puntos < 3) avanzo = false
    } else if (favor < contra) {
      avanzo = false
    } else if (favor === contra) {
      tanda = simularTanda(ovr, rival.ovr_equipo ?? 84, capEsArquero)
      avanzo = tanda.ganador
    }
    partidos.push({
      ronda: RONDAS[idx],
      rival: rival.etiqueta,
      rivalOvr: rival.ovr_equipo ?? 84,
      rivalFormacion: rival.formacion ?? '',
      favor,
      contra,
      goleadores: elegirGoleadores(equipo, favor, capId),
      avanzo,
      tanda
    })
    if (!avanzo) break
  }

  const jugados = partidos.length
  const campeon = offsetRonda === 0 && jugados === 7 && partidos[6].avanzo
  return {
    partidos,
    campeon,
    valla: campeon && valla,
    jugados,
    ovr,
    sinergia: sinergias(equipo)
  }
}

export function relato(partido, nombreEquipo, prensa = null) {
  const lineas = [`${partido.ronda}: ${nombreEquipo} vs ${partido.rival ?? ''}.`]
  // Árbitro y cronista reales: solo narrativa, no altera el resultado.
  lineas.push(...lineasPrensa(prensa))
  const todos = []
  for (const g of partido.goleadores ?? []) todos.push({ ...g, mine: true })
  for (const g of partido.goleadoresRival ?? []) todos.push({ ...g, mine: false })
  todos.sort((a, b) => a.minuto - b.minuto)
  for (const g of todos) {
    lineas.push(`${g.minuto}' ¡GOL de ${g.jugador}!${g.mine ? '' : ` (${partido.rival ?? ''})`}`)
  }
  lineas.push(`Final: ${nombreEquipo} ${partido.favor} – ${partido.contra} ${partido.rival ?? ''}.`)
  if (partido.tanda) {
    const t = partido.tanda
    lineas.push(`Penales ${t.mios}–${t.suyos}: ${t.ganador ? '¡pasa ' + nombreEquipo + '!' : 'afuera.'}`)
  } else if (!partido.avanzo) {
    lineas.push('Eliminado.')
  }
  return lineas
}

export function goleadorTorneo(torneo, capitanId = null) {
  const cuenta = {}
  for (const p of torneo.partidos) {
    for (const g of p.goleadores ?? []) {
      cuenta[g.jugador] = (cuenta[g.jugador] ?? 0) + 1
    }
    for (const g of p.goleadoresRival ?? []) {
      cuenta[g.jugador] = (cuenta[g.jugador] ?? 0) + 1
    }
  }
  const nombres = Object.keys(cuenta)
  if (!nombres.length) return null
  nombres.sort((a, b) => cuenta[b] - cuenta[a])
  return { jugador: nombres[0], goles: cuenta[nombres[0]] }
}

export function figuraPartido(partido, capitanId = null, capitanNombre = null) {
  if ((partido.goleadores ?? []).length) return partido.goleadores[0].jugador
  if ((partido.goleadoresRival ?? []).length) return partido.goleadoresRival[0].jugador
  if (partido.contra === 0 && capitanNombre) return capitanNombre
  return null
}

export function calificaciones(torneo) {
  const gf = torneo.partidos.reduce((a, p) => a + p.favor, 0)
  const gc = torneo.partidos.reduce((a, p) => a + p.contra, 0)
  const n = torneo.partidos.length || 1
  return {
    ataque: Math.min(10, Math.max(1, Math.round(5 + (gf / n - 1.32) * 2.5))),
    defensa: Math.min(10, Math.max(1, Math.round(5 + (1.32 - gc / n) * 2.5)))
  }
}

export function resumenTorneo(torneo) {
  if (torneo.campeon && torneo.valla) return '7A0'
  if (torneo.campeon) return 'C'
  return 'E'
}
