import { mezclar, armarZonas } from './sorteo_rivales.js'
import { golesPoisson } from './formations.js'
import { PITCH_COORDS } from './pitch.js'

export function fixtureIda(equipos) {
  const lista = [...equipos]
  const impar = lista.length % 2 === 1
  if (impar) lista.push(null)
  const n = lista.length
  let fijos = [...lista]
  const fechas = []
  for (let r = 0; r < n - 1; r++) {
    const fecha = []
    for (let i = 0; i < n / 2; i++) {
      const a = fijos[i]
      const b = fijos[n - 1 - i]
      if (a === null || b === null) continue
      fecha.push(r % 2 === 0 ? { local: a, visita: b } : { local: b, visita: a })
    }
    fechas.push(fecha)
    fijos = [fijos[0], fijos[n - 1], ...fijos.slice(1, n - 1)]
  }
  return fechas
}

export function fixtureIdaVuelta(equipos) {
  const ida = fixtureIda(equipos)
  const vuelta = ida.map((fecha) => fecha.map((p) => ({ local: p.visita, visita: p.local })))
  return [...ida, ...vuelta]
}

// Desempate canónico, el mismo de api/tabla.php:
// puntos → diferencia → goles a favor → fair play → id del equipo.
export function desempate(a, b) {
  return b.pts - a.pts || b.dif - a.dif || b.gf - a.gf ||
    (a.fp ?? 0) - (b.fp ?? 0) || String(a.id).localeCompare(String(b.id))
}

export function calcularTabla(equipos, partidos, fairplay = {}) {
  const filas = new Map(equipos.map((id) => [id, {
    id, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dif: 0, pts: 0,
    fp: fairplay[id] ?? 0
  }]))
  for (const p of partidos) {
    if (!p.jugado) continue
    const L = filas.get(p.local)
    const V = filas.get(p.visita)
    if (!L || !V) continue
    L.pj++; V.pj++
    L.gf += p.gf; L.gc += p.gc
    V.gf += p.gf; V.gc += p.gc
    if (p.gf > p.gc) { L.pg++; L.pts += 3; V.pp++ }
    else if (p.gf < p.gc) { V.pg++; V.pts += 3; L.pp++ }
    else { L.pe++; V.pe++; L.pts++; V.pts++ }
  }
  const tabla = mezclar([...filas.values()])
  for (const f of tabla) f.dif = f.gf - f.gc
  tabla.sort(desempate)
  tabla.forEach((f, i) => { f.pos = i + 1 })
  return tabla
}

// Tabla al cierre de una fecha. La usan las flechas de movimiento, el
// reproductor de temporada y cualquier vista "como estaba en la fecha N".
export function tablaHasta(equipos, partidos, { fairplay = {}, fecha = Infinity } = {}) {
  const hasta = partidos.filter((p) => p.jugado && Number(p.fecha_n ?? Infinity) <= fecha)
  return calcularTabla(equipos, hasta, fairplay)
}

export function racha(id, partidos) {
  return racha5(id, partidos).filter(Boolean).join('')
}

// Devuelve siempre 5 casillas (más vieja → más nueva). Las vacías son fechas
// todavía no jugadas, para que la UI pueda mostrar los 5 puntitos completos.
export function racha5(id, partidos) {
  const mios = partidos.filter((p) => p.jugado && (p.local === id || p.visita === id))
  const salida = mios.slice(-5).map((p) => {
    const gf = p.local === id ? p.gf : p.gc
    const gc = p.local === id ? p.gc : p.gf
    return gf > gc ? 'V' : gf < gc ? 'D' : 'E'
  })
  while (salida.length < 5) salida.unshift('')
  return salida
}

// Partidos entre rivales (los que el usuario no juega). Misma calibración de
// goles que el partido del usuario: ~2,6 totales, con localía leve y la
// diferencia de OVR comprimida para que un 95 no aplaste siempre a un 75.
// Media de goles de un partido entre rivales: misma calibración que el motor
// del usuario, con localía leve. Se usa en las previas para hacer visible la
// expectativa antes de jugar.
export function mediasPartidoLiga(ovrLocal, ovrVisita, { local = true } = {}) {
  const diff = ovrLocal - ovrVisita
  const ventaja = Math.max(-1.2, Math.min(1.2, diff * 0.085))
  const localia = local ? 0.12 : 0
  return {
    favor: 1.32 + ventaja + localia,
    contra: 1.32 - ventaja - localia
  }
}

export function simularPartidoLiga(ovrLocal, ovrVisita, { local = true, azar = Math.random } = {}) {
  const { favor: mediaFavor, contra: mediaContra } = mediasPartidoLiga(ovrLocal, ovrVisita, { local })
  return {
    favor: golesPoisson(mediaFavor, azar),
    contra: golesPoisson(mediaContra, azar)
  }
}

// Cuotas "de las casas de apuestas": Monte Carlo sobre el MISMO motor que
// después juega el partido. No son datos reales ni apuestas: solo hacen visible
// la matemática del juego. Devuelve porcentajes que suman 100.
const cacheProbabilidades = new Map()
export function probabilidades(ovrLocal, ovrVisita, { local = true, n = 400, azar = null } = {}) {
  // Con azar propio (tests) se mantiene el Monte Carlo original para no
  // cambiar el contrato de quien inyecta la semilla.
  if (azar) return calcularProbabilidades(ovrLocal, ovrVisita, local, n, azar)
  const clave = `${ovrLocal}|${ovrVisita}|${local ? 1 : 0}`
  if (cacheProbabilidades.has(clave)) return cacheProbabilidades.get(clave)
  const { favor, contra } = mediasPartidoLiga(ovrLocal, ovrVisita, { local })
  let ganaLocal = 0
  let empate = 0
  const max = 9
  const pf = probabilidadPoisson(favor)
  const pc = probabilidadPoisson(contra)
  for (let a = 0; a <= max; a++) {
    for (let b = 0; b <= max; b++) {
      const p = pf[a] * pc[b]
      if (a > b) ganaLocal += p
      else if (a === b) empate += p
    }
  }
  const localPct = Math.round(ganaLocal * 100)
  const empatePct = Math.round(empate * 100)
  const resultado = { local: localPct, empate: empatePct, visita: 100 - localPct - empatePct }
  cacheProbabilidades.set(clave, resultado)
  return resultado
}

// Poisson truncado: mismo modelo que golesPoisson, sin 400 simulaciones.
function probabilidadPoisson(media) {
  const arr = []
  let p = Math.exp(-media)
  let acum = p
  arr[0] = p
  for (let k = 1; k <= 9; k++) {
    p *= media / k
    arr[k] = p
    acum += p
  }
  const normaliza = 1 / acum
  return arr.map((x) => x * normaliza)
}

function calcularProbabilidades(ovrLocal, ovrVisita, local, n, azar) {
  let ganaLocal = 0
  let empates = 0
  for (let i = 0; i < n; i++) {
    const { favor, contra } = simularPartidoLiga(ovrLocal, ovrVisita, { local, azar })
    if (favor > contra) ganaLocal++
    else if (favor === contra) empates++
  }
  const localPct = Math.round(ganaLocal / n * 100)
  const empatePct = Math.round(empates / n * 100)
  return { local: localPct, empate: empatePct, visita: 100 - localPct - empatePct }
}

// Argentina: los 8 primeros de cada zona juegan octavos cruzados.
// Orden fijo del cuadro: 1A-8B, 4A-5B, 2A-7B, 3A-6B y el espejo por B.
// Los ganadores se aparean de a 2 en cuartos, semis y final.
export function crucesOctavos(zonas) {
  const A = zonas.A ?? []
  const B = zonas.B ?? []
  if (A.length < 8 || B.length < 8) {
    throw new Error('Se necesitan los 8 primeros de cada zona')
  }
  return [
    [A[0], B[7]], [A[3], B[4]], [A[1], B[6]], [A[2], B[5]],
    [B[0], A[7]], [B[3], A[4]], [B[1], A[6]], [B[2], A[5]]
  ]
}

export function crucesMundial(grupos) {
  const g = (z, i) => grupos[z][i]
  return [
    [g('A', 0), g('B', 1)], [g('C', 0), g('D', 1)],
    [g('E', 0), g('F', 1)], [g('G', 0), g('H', 1)],
    [g('B', 0), g('A', 1)], [g('D', 0), g('C', 1)],
    [g('F', 0), g('E', 1)], [g('H', 0), g('G', 1)]
  ]
}

export function fixturePremier(equipos20) {
  if (equipos20.length !== 20) throw new Error('La Premier necesita 20 equipos')
  return fixtureIdaVuelta(equipos20)
}

export function armarZonasLiga30(equipos30) {
  if (equipos30.length !== 30) throw new Error('La Argentina necesita 30 equipos')
  return armarZonas(equipos30, 2)
}

export function fixtureZonas(zonaA, zonaB) {
  return { fechasA: fixtureIda(zonaA), fechasB: fixtureIda(zonaB) }
}

export function garantizarClasicoZonas(zonas, esUsuario, esBoca) {
  const [A, B] = [ [...zonas[0]], [...zonas[1]] ]
  const ia = A.findIndex(esUsuario)
  const ib = B.findIndex(esUsuario)
  const zonaYo = ia >= 0 ? A : ib >= 0 ? B : null
  if (!zonaYo) return [A, B]
  const otra = zonaYo === A ? B : A
  const yo = zonaYo.find(esUsuario)
  const boca = zonaYo.find(esBoca)
  if (yo && boca) {
    const ovr = (e) => e.ovr_equipo ?? 84
    let mejor = 0
    let mejorDif = Infinity
    otra.forEach((e, i) => {
      if (esUsuario(e)) return
      const d = Math.abs(ovr(e) - ovr(boca))
      if (d < mejorDif) { mejorDif = d; mejor = i }
    })
    const j = zonaYo.findIndex(esBoca)
    ;[zonaYo[j], otra[mejor]] = [otra[mejor], zonaYo[j]]
  }
  return [A, B]
}

export function cruceInterzonal(zonaA, zonaB) {
  if (zonaA.length !== zonaB.length) throw new Error('Las zonas deben ser parejas')
  const a = mezclar([...zonaA])
  const b = mezclar([...zonaB])
  return a.map((e, i) => ({ local: e, visita: b[i] }))
}

export function siguienteRondaPlayoffs(ganadores) {
  const pares = []
  for (let i = 0; i + 1 < ganadores.length; i += 2) {
    pares.push([ganadores[i], ganadores[i + 1]])
  }
  return pares
}

// Línea natural de cada código: 0 arquero, 1 defensa, 2 mediocampo, 3 ataque.
const LINEA_POS = {
  ARQ: 0,
  LD: 1, DFC: 1, LI: 1,
  MCD: 2, MC: 2, MCO: 2, MD: 2, MI: 2,
  ED: 3, EI: 3, DC: 3
}
// Costado natural de cada código. Los que no figuran se juegan por el centro.
const LADO_POS = { LD: 'D', MD: 'D', ED: 'D', LI: 'I', MI: 'I', EI: 'I' }

// Qué tan lejos está el jugador natural "a" del puesto pedido "b" en el lado
// "lado". Manda la línea; el costado desempata dentro de la misma línea, así
// el MC2 (centro del 4-3-3) no lo ocupa un extremo ni un volante lateral.
function distanciaPosicion(a, b, lado = 'C') {
  if (a === b) return 0
  const lineas = Math.abs((LINEA_POS[a] ?? 9) - (LINEA_POS[b] ?? 9))
  const ladoJugador = LADO_POS[a] ?? 'C'
  const ladoPuesto = LADO_POS[b] ?? lado
  return lineas * 3 + (ladoJugador === ladoPuesto ? 0 : 1)
}

// El mapa de slots viene de api/_slots.php; las coordenadas, de pitch.js.
// Se comparan las claves para saber qué slot cae a cada lado de la cancha.
const cacheCoords = new Map()
function coordsDelMapa(slotsMapa) {
  const claves = Object.keys(slotsMapa ?? {}).sort().join('|')
  if (cacheCoords.has(claves)) return cacheCoords.get(claves)
  let coords = null
  for (const formacion of Object.keys(PITCH_COORDS)) {
    if (Object.keys(PITCH_COORDS[formacion]).sort().join('|') === claves) {
      coords = PITCH_COORDS[formacion]
      break
    }
  }
  cacheCoords.set(claves, coords)
  return coords
}

function ladoDelSlot(slot, coords) {
  const x = coords?.[slot]?.[0]
  if (Number.isFinite(x)) return x <= 35 ? 'I' : x >= 65 ? 'D' : 'C'
  // Sin coordenadas, se infiere del nombre del slot (LD, MI, ED, ...).
  if (/^(LD|MD|ED)$/.test(slot)) return 'D'
  if (/^(LI|MI|EI)$/.test(slot)) return 'I'
  return 'C'
}

export function onceRival(plantel, slotsMapa) {
  const libres = [...(plantel ?? [])].sort((a, b) => (b.ovr_final ?? 0) - (a.ovr_final ?? 0))
  const secDe = (j) => String(j.posiciones_secundarias ?? '').split(',').map((s) => s.trim())
  const usados = new Set()
  const salida = Object.entries(slotsMapa ?? {}).map(([slot, pos]) => ({ slot, pos, jugador: null }))
  const coords = coordsDelMapa(slotsMapa)
  const tomar = (pred) => {
    const j = libres.find((x) => !usados.has(x) && pred(x))
    if (j) usados.add(j)
    return j ?? null
  }

  // Los huecos repetidos (DFC1/DFC2, MC1/MC2/MC3) se llenan del centro hacia
  // los costados: el MC natural se queda en MC2 y MD/MI van a MC1/MC3.
  const cantPos = salida.reduce((acc, o) => { acc[o.pos] = (acc[o.pos] ?? 0) + 1; return acc }, {})
  const orden = [...salida].sort((a, b) =>
    (cantPos[a.pos] > 1 ? 10 : 0) - (cantPos[b.pos] > 1 ? 10 : 0) ||
    (ladoDelSlot(a.slot, coords) === 'C' ? 0 : 1) - (ladoDelSlot(b.slot, coords) === 'C' ? 0 : 1))

  // 1) Todos los puestos naturales, antes de improvisar: un especialista no
  //    debe quedar relegado por llenar antes otro hueco.
  for (const o of orden) o.jugador = tomar((j) => j.posicion_natural === o.pos)
  // 2) Posiciones secundarias.
  for (const o of orden) if (!o.jugador) o.jugador = tomar((j) => secDe(j).includes(o.pos))
  // 3) Último recurso: el jugador libre más cercano a la línea y al lado del
  //    hueco (MC2 es el centro; MC1 y MC3, las bandas). El orden de salida no
  //    cambia: solo se cambia el orden en que se elige a los jugadores.
  for (const o of orden) {
    if (o.jugador) continue
    const lado = ladoDelSlot(o.slot, coords)
    const libre = libres
      .filter((j) => !usados.has(j))
      .sort((a, b) => distanciaPosicion(a.posicion_natural, o.pos, lado) - distanciaPosicion(b.posicion_natural, o.pos, lado)
        || (b.ovr_final ?? 0) - (a.ovr_final ?? 0))[0]
    if (libre) {
      usados.add(libre)
      o.jugador = libre
    }
  }
  return salida
}
