<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  obtenerRivales, obtenerJugadores, obtenerTemporadas, obtenerRanking,
  crearTorneo, obtenerTorneo,
  actualizarTorneo, agregarCalendario, jugarPartidoCalendario,
  obtenerTabla, sancionar, obtenerSanciones, desbloquearLogro,
  intercambiarJugadores, cargarEquipo
} from '../services/api.js'
import { usePrensa } from '../services/prensa.js'
import {
  simularPartido, mediasGoles, simularTanda, relato,
  promedioOvr, sinergias, elegirGolesConAsistencias, elegirGoleadores,
  rankingAportes, mvpAportes
} from '../game/formations.js'
import {
  sortearConGarantia, mezclar
} from '../game/sorteo_rivales.js'
import { leerUsosRivales, registrarRivales } from '../game/variedad.js'
import {
  fixturePremier, armarZonasLiga30, fixtureZonas, garantizarClasicoZonas,
  calcularTabla, tablaHasta, cruceInterzonal, crucesOctavos, siguienteRondaPlayoffs,
  racha5, simularPartidoLiga, probabilidades, onceRival
} from '../game/ligas.js'
import XvRivalModal from './XvRivalModal.vue'
import RelatoEnVivo from './RelatoEnVivo.vue'
import EstadoSimulacion from './EstadoSimulacion.vue'
import { registrarTitulo, registrarClasico, leerRachaClasico, resumenPalmares } from '../game/palmares.js'
import { logrosDeTorneo } from '../game/logros.js'
import { sonidoGol, sonidoCampeon, sonidoError, sonidoSilbato } from '../game/sound.js'
import { escudoDe, fotoDe, fallbackInicial } from '../game/fotos.js'
import { suspensionPorAmarilla } from '../game/sanciones.js'
import { golesParaCalendario } from '../game/resultado_calendario.js'
import { enLotes } from '../game/concurrencia.js'

const props = defineProps({
  equipo: { type: Array, required: true },
  estilo: { type: String, default: 'equilibrado' },
  anchura: { type: String, default: 'equilibrado' },
  capitan: { type: Object, default: null },
  partidaId: { type: Number, required: true },
  nombreEquipo: { type: String, default: 'Mi 3A1' },
  formacion: { type: String, default: '4-4-2' },
  almanaque: { type: Boolean, default: false },
  formaciones: { type: Object, default: () => ({}) },
  todas: { type: Object, default: () => ({}) },
  formato: { type: String, default: 'premier' } // premier | liga30
})
const emit = defineEmits(['fin', 'equipo'])
const { para: prensaPara, texto: textoPrensa, tribuna: textoTribuna } = usePrensa()

const esPremier = computed(() => props.formato === 'premier')
const FECHA_MAX = computed(() => (esPremier.value ? 38 : 20))
const TITULO = computed(() => (esPremier.value ? 'Premier' : 'Argentina'))

const once = computed(() => props.equipo.filter((j) => !String(j.slot).startsWith('SUP')))
const banco = computed(() => props.equipo.filter((j) => String(j.slot).startsWith('SUP')))
const ovrMio = computed(() => {
  if (!once.value.length) return 84
  return promedioOvr(once.value) + sinergias(once.value).bonus
})
const capId = computed(() => props.capitan?.temporada_jugador_id ?? null)

const torneoId = ref(null)
const equipos = ref([])
const calendario = ref([])
const fecha = ref(0)
const jugando = ref(false)
const preparando = ref(false)
const lineas = ref([])
const finalizado = ref(false)
const campeon = ref(false)
const valla = ref(false)
const figuras = ref({})
const sanciones = ref([])
const goleadoresAcum = ref([])
const aviso = ref('')
const error = ref('')
const simHastaN = ref('')
// Igual que en el torneo de 7 partidos: ir partido a partido o dejar que se
// juegue la fecha completa y se avance solo.
const modoSim = ref('auto')
const tabla = ref([])
const verGeneral = ref(false)
const swapXI = ref('')
const swapSUP = ref('')
const rachaClasico = ref(leerRachaClasico())
const LOGROS_LABEL = {
  primer_campeon: 'Primer campeón',
  siete_cero: '7A0 perfecto',
  campeon_premier: 'Campeón Premier',
  campeon_liga30: 'Campeón Argentina',
  clasico_ganado: 'Clásico ganado',
  campeon_debil: 'Campeón con equipo humilde',
  campeon_almanaque: 'Campeón a ciegas',
  goleada: 'Goleada (4+)',
  asistencia: 'Primer pase gol',
  hat_trick: 'Hat-trick',
  diez_goles: '10 goles en un torneo',
  campeon_invicto: 'Campeón invicto',
  veterano: 'Veterano (5 torneos)',
  cinco_goles_un_jugador: '5 goles de un jugador',
  cinco_asistencias: '5 pases gol',
  torneo_perfecto: 'Torneo perfecto',
  valla_total: 'Valla total',
  clasico_doble: 'Clásico ida y vuelta'
}
const logrosNuevos = ref([])
const todasTemporadas = ref([])
const rankingPrevio = ref([])
const rivalSeleccionado = ref(null)
// UI: 'previa' | 'jugado' | null → un solo despliegue de XI abierto por vista.
const alineacionAbierta = ref(null)
const tablaPanel = ref(null)
function alternarAlineacion(clave) {
  alineacionAbierta.value = alineacionAbierta.value === clave ? null : clave
}
function irATabla() { tablaPanel.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) }

// "Simular hasta": el destino por defecto es la fecha siguiente, así que el
// botón siempre es válido aunque el usuario no toque el control.
const destinoSim = computed(() => {
  const n = Number(simHastaN.value)
  return Number.isInteger(n) && n > fecha.value && n <= FECHA_MAX.value
    ? n
    : Math.min(fecha.value + 1, FECHA_MAX.value)
})
const fechasASimular = computed(() => Math.max(0, destinoSim.value - fecha.value))
const partidosASimular = computed(() => {
  const ya = calendario.value.filter((c) => !c.jugado && c.fecha_n > fecha.value && c.fecha_n <= destinoSim.value).length
  return ya || fechasASimular.value * Math.max(1, Math.floor(equipos.value.length / 2))
})

// Disciplina: cada 2 amarillas (o una roja) se pierde la fecha siguiente.
const disciplina = computed(() => {
  const mapa = new Map(sanciones.value.map((s) => [Number(s.temporada_jugador_id), s]))
  return props.equipo.map((j) => {
    const s = mapa.get(j.temporada_jugador_id)
    const amarillas = Number(s?.amarillas ?? 0)
    const hasta = Number(s?.suspendido_hasta_fecha ?? 0)
    const suspendido = !!s?.roja || (hasta > 0 && hasta >= fecha.value)
    return {
      jugador: j, amarillas, hasta, suspendido,
      titular: once.value.some((x) => x.temporada_jugador_id === j.temporada_jugador_id),
      enRiesgo: !suspendido && amarillas % 2 === 1
    }
  }).filter((d) => d.amarillas > 0 || d.suspendido)
})
const titularesEnRiesgo = computed(() => disciplina.value.filter((d) => d.titular && !d.suspendido))
const titularesSuspendidos = computed(() => disciplina.value.filter((d) => d.titular && d.suspendido))

// Cambios XI ↔ banco: validamos antes de mandar la petición para que la UI
// explique por qué un suplente no puede entrar en ese puesto.
const swapXIJ = computed(() => once.value.find((j) => j.slot === swapXI.value) ?? null)
const swapSUPJ = computed(() => banco.value.find((j) => j.slot === swapSUP.value) ?? null)
const swapMotivo = computed(() => {
  if (!swapXIJ.value || !swapSUPJ.value) return 'Elegí un titular y un suplente para ver el cambio.'
  if (swapXIJ.value.posicion_natural === 'ARQ') return 'El arquero no baja al banco: elegí un jugador de campo.'
  if (!compatible(swapSUPJ.value, swapXIJ.value.slot)) {
    return `${swapSUPJ.value.nombre} no puede jugar en ${swapXIJ.value.slot} (${posDe(swapXIJ.value.slot)}).`
  }
  return ''
})

const esBocaEtiq = (e) => String(e?.etiqueta ?? '').startsWith('Boca')
const eqMapa = computed(() => {
  const mapa = new Map()
  for (const e of equipos.value) mapa.set(e.id, e)
  return mapa
})
const eqPorId = (id) => eqMapa.value.get(id)
const yoTe = computed(() => equipos.value.find((e) => e.es_usuario))
const nombreDe = (teId) => {
  const e = eqPorId(teId)
  if (!e) return '?'
  return e.es_usuario ? props.nombreEquipo : (e.etiqueta ?? '?')
}
const ovrDeTe = (teId) => {
  const e = eqPorId(teId)
  if (!e) return 84
  return e.es_usuario ? Math.round(ovrMio.value * 10) / 10 : (e.ovr_equipo ?? 84)
}
const esMio = (c) => !!eqPorId(c.local_id)?.es_usuario || !!eqPorId(c.visita_id)?.es_usuario
const ladoMio = (c) => (eqPorId(c.local_id)?.es_usuario ? 'local' : 'visita')
const rivalDe = (c) => eqPorId(ladoMio(c) === 'local' ? c.visita_id : c.local_id)
const misGoles = (c) => (ladoMio(c) === 'local' ? c.gf : c.gc)
const susGoles = (c) => (ladoMio(c) === 'local' ? c.gc : c.gf)
const ganeYo = (c) => c.jugado && esMio(c) && misGoles(c) > susGoles(c)
const esMataMata = (c) => ['octavos', 'cuartos', 'semi', 'final'].includes(c.fase)
const esClasico = (c) => esMio(c) && esBocaEtiq(rivalDe(c))
const grupoMio = computed(() => yoTe.value?.zona ?? null)

function rondaNombre(n, fase = '') {
  if (!esPremier.value) {
    if (fase === 'interzonal' || n === 16) return 'Interzonal · el clásico'
    if (fase === 'octavos') return 'Octavos de final'
    if (fase === 'cuartos') return 'Cuartos de final'
    if (fase === 'semi') return 'Semifinal'
    if (fase === 'final') return 'Final'
    return `Zona ${grupoMio.value ?? ''} · Fecha ${n}`
  }
  return `Fecha ${n}`
}

const cuadro = computed(() => esPremier.value ? [] : [17, 18, 19, 20].map((n) => ({
  n,
  nombre: ({ 17: 'Octavos', 18: 'Cuartos', 19: 'Semifinal', 20: 'Final' })[n],
  partidos: calendario.value.filter((c) => c.fecha_n === n && esMataMata(c))
})).filter((r) => r.partidos.length))
function ganadorCruce(c) {
  if (!c.jugado) return null
  if (c.gf !== c.gc) return c.gf > c.gc ? c.local_id : c.visita_id
  return c.detalle?.ganador ?? null
}
const fechaPartidos = computed(() => calendario.value.filter((c) => c.fecha_n === fecha.value))
const partidoMio = computed(() => fechaPartidos.value.find((c) => !c.jugado && esMio(c)))
const miPartidoJugado = computed(() => fechaPartidos.value.find((c) => c.jugado && esMio(c)))
const miPos = computed(() => {
  const t = tabla.value.find((r) => r.equipo_id === yoTe.value?.id)
  return t ? `${t.pos}° (${t.pts} pts)` : '—'
})
// En Argentina el objetivo es entrar entre los 8 primeros de la zona.
const metaClasificacion = computed(() => {
  if (esPremier.value || finalizado.value || fecha.value >= 17 || !tabla.value.length || !yoTe.value) return ''
  const fila = tabla.value.find((r) => r.equipo_id === yoTe.value.id)
  if (!fila) return ''
  const pos = Number(fila.pos)
  const restantes = Math.max(0, 16 - Number(fecha.value))
  if (pos <= 8) {
    if (!restantes) return `Clasificaste ${pos}° a octavos`
    const colchon = 8 - pos
    return colchon
      ? `Clasificás si no perdés ${colchon} puesto${colchon > 1 ? 's' : ''} en ${restantes} fecha${restantes > 1 ? 's' : ''}`
      : 'Clasificás si ganás la zona o mantenés el 8° puesto'
  }
  const subir = pos - 8
  return restantes
    ? `Necesitás subir ${subir} puesto${subir > 1 ? 's' : ''} en ${restantes} fecha${restantes > 1 ? 's' : ''} para clasificar`
    : `No clasificaste (${pos}°)`
})

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
function posDe(slot) {
  return props.formaciones[props.formacion]?.[slot]
}
function compatible(j, slot) {
  const pos = posDe(slot)
  if (!pos) return false
  const sec = String(j.posiciones_secundarias ?? '').split(',').map((s) => s.trim())
  return j.posicion_natural === pos || sec.includes(pos)
}

function ladoParam(e) {
  return e.temporada_id === null || e.temporada_id === undefined
    ? { marca: 'usuario' }
    : { temp: e.temporada_id }
}
function filaCal(p, fechaN, fase) {
  const L = ladoParam(p.local)
  const V = ladoParam(p.visita)
  return {
    fecha_n: fechaN, fase,
    ...(L.marca ? { local: 'usuario' } : { local_temp: L.temp }),
    ...(V.marca ? { visita: 'usuario' } : { visita_temp: V.temp })
  }
}

async function crearTorneoSeguro(formato, participantes, cal, sorteados = []) {
  const res = await crearTorneo(props.partidaId, formato, participantes, cal)
  if (res.ya_existia) aviso.value = 'Ya había un torneo guardado: continuás donde lo dejaste.'
  else registrarRivales(sorteados)
  return res.id
}

async function preparar() {
  // Evita dos sorteos concurrentes mientras se arma el fixture.
  if (preparando.value || torneoId.value) return
  preparando.value = true
  error.value = ''
  aviso.value = ''
  alineacionAbierta.value = null
  try {
  const rivales = await obtenerRivales()
  const usos = leerUsosRivales()
  const esBoca = (r) => String(r.etiqueta).startsWith('Boca')
  if (esPremier.value) {
    if (rivales.length < 19) throw new Error('Faltan rivales en la base (se necesitan 19)')
    const userEntry = { temporada_id: null, etiqueta: props.nombreEquipo, ovr_equipo: Math.round(ovrMio.value), formacion: props.formacion }
    const sorteados = sortearConGarantia(rivales, 19, esBoca, { usos, maxPorClub: 2 })
    const eq20 = mezclar([userEntry, ...sorteados])
    const fixture = fixturePremier(eq20)
    const cal = fixture.flatMap((fechaJ, j) => fechaJ.map((p) => filaCal(p, j + 1, 'liga')))
    const participantes = eq20.map((e) => ({
      temporada_id: e.temporada_id ?? null, zona: null,
      es_usuario: e.temporada_id === null || e.temporada_id === undefined
    }))
    torneoId.value = await crearTorneoSeguro('premier', participantes, cal, sorteados)
  } else {
    if (rivales.length < 29) throw new Error('Faltan rivales en la base (se necesitan 29)')
    const userEntry = { temporada_id: null, etiqueta: props.nombreEquipo, ovr_equipo: Math.round(ovrMio.value), formacion: props.formacion }
    const sorteados = sortearConGarantia(rivales, 29, esBoca, { usos, maxPorClub: 3 })
    const todas = [userEntry, ...sorteados]
    const esYo = (e) => e.temporada_id === null || e.temporada_id === undefined
    let [A, B] = garantizarClasicoZonas(armarZonasLiga30(todas), esYo, esBoca)
    const letras = (zona, l) => zona.map((e) => ({
      temporada_id: e.temporada_id ?? null, zona: l,
      es_usuario: e.temporada_id === null || e.temporada_id === undefined
    }))
    const participantes = [...letras(A, 'A'), ...letras(B, 'B')]
    const { fechasA, fechasB } = fixtureZonas(A, B)
    const cal = []
    fechasA.forEach((fechaJ, j) => fechaJ.forEach((p) => cal.push(filaCal(p, j + 1, 'zona'))))
    fechasB.forEach((fechaJ, j) => fechaJ.forEach((p) => cal.push(filaCal(p, j + 1, 'zona'))))
    const todos = [...A, ...B]
    const yo = todos.find(esYo)
    const boca = todos.find(esBoca)
    const restoA = A.filter((e) => e !== yo && e !== boca)
    const restoB = B.filter((e) => e !== yo && e !== boca)
    const n = Math.min(restoA.length, restoB.length)
    const pares = cruceInterzonal(restoA.slice(0, n), restoB.slice(0, n))
    const sueltos = [...restoA.slice(n), ...restoB.slice(n)]
    for (let i = 0; i + 1 < sueltos.length; i += 2) {
      pares.push({ local: sueltos[i], visita: sueltos[i + 1] })
    }
    if (yo && boca) pares.push(A.includes(yo) ? { local: boca, visita: yo } : { local: yo, visita: boca })
    for (const p of pares.filter(Boolean)) cal.push(filaCal(p, 16, 'interzonal'))
    torneoId.value = await crearTorneoSeguro('liga30', participantes, cal, sorteados)
  }
  await actualizarTorneo(torneoId.value, { fecha_actual: 1, estado: 'curso' })
  await recargar()
  } catch (e) {
    error.value = e.message
  } finally {
    preparando.value = false
  }
}

async function recargar() {
  if (!torneoId.value) return
  if (!todasTemporadas.value.length) todasTemporadas.value = await obtenerTemporadas().catch(() => [])
  if (!rankingPrevio.value.length) rankingPrevio.value = await obtenerRanking().catch(() => [])
  const snapKey = `snap_liga_${props.partidaId}`
  let t
  try {
    t = await obtenerTorneo({ torneoId: torneoId.value })
    try {
      localStorage.setItem(snapKey, JSON.stringify({
        equipos: t.equipos, calendario: t.calendario, fecha_actual: t.fecha_actual,
        estado: t.estado, campeon: t.campeon ?? null, valla: t.valla ?? null
      }))
    } catch { /* storage lleno o deshabilitado */ }
  } catch (e) {
    let guardado = null
    try { guardado = JSON.parse(localStorage.getItem(snapKey) ?? 'null') } catch { /*noop*/ }
    if (!guardado) throw e
    t = guardado
    aviso.value = 'Sin conexión: mostrando el último guardado en este dispositivo.'
  }
  equipos.value = t.equipos
  calendario.value = t.calendario
  fecha.value = Number(t.fecha_actual) || 1
  sanciones.value = await obtenerSanciones(torneoId.value).catch(() => [])
  await recargarTabla()
  goleadoresAcum.value = []
  for (const c of t.calendario) {
    if (c.jugado && esMio(c) && c.detalle?.goleadores) {
      goleadoresAcum.value.push(...c.detalle.goleadores)
    }
  }
  rachaClasico.value = leerRachaClasico()
  const jugadoMio = t.calendario.find((c) => c.jugado && c.fecha_n === fecha.value && esMio(c))
  if (jugadoMio) await verFigurasRival(jugadoMio)
  if (t.estado === 'finalizado') {
    finalizado.value = true
    const mios = t.calendario.filter((c) => c.jugado && esMio(c))
    if (t.campeon !== null && t.campeon !== undefined) {
      campeon.value = !!Number(t.campeon)
      valla.value = t.valla !== null && t.valla !== undefined
        ? !!Number(t.valla)
        : (campeon.value && mios.length > 0 && mios.every((c) => susGoles(c) === 0))
    } else {
      await computarCierre()
    }
  }
}

async function recargarTabla() {
  try {
    if (!esPremier.value && grupoMio.value && !verGeneral.value) {
      tabla.value = await obtenerTabla(torneoId.value, grupoMio.value)
    } else {
      tabla.value = await obtenerTabla(torneoId.value)
    }
  } catch {
    // Modo offline: reconstruimos la tabla con el mismo desempate de la API.
    const ids = equipos.value.map((e) => e.id)
    if (!ids.length) {
      tabla.value = []
      return
    }
    const fp = Object.fromEntries(equipos.value.map((e) => [e.id, 0]))
    tabla.value = calcularTabla(ids, partidosParaTabla.value, fp).map((f) => ({
      equipo_id: f.id, pos: f.pos, pj: f.pj, pg: f.pg, pe: f.pe, pp: f.pp,
      gf: f.gf, gc: f.gc, dif: f.dif, pts: f.pts, fp: f.fp,
      etiqueta: nombreDe(f.id), escudo: escudoDe(eqPorId(f.id))
    }))
  }
}

async function restaurar(id) {
  torneoId.value = id
  alineacionAbierta.value = null
  await recargar()
  if (finalizado.value) {
    emit('fin', { campeon: campeon.value, valla: valla.value, amistoso: false })
  }
  return true
}

async function verFigurasRival(c) {
  const r = rivalDe(c)
  if (!r || r.temporada_id == null || figuras.value[r.temporada_id]) return
  try {
    figuras.value[r.temporada_id] = await obtenerJugadores(r.temporada_id)
  } catch {
    figuras.value[r.temporada_id] = []
  }
}

function onceRivalDe(c) {
  const r = rivalDe(c)
  if (!r) return []
  const plantel = figuras.value[r.temporada_id] ?? []
  const mapa = props.todas[r.formacion] ?? props.formaciones[r.formacion] ?? {}
  return onceRival(plantel, mapa)
}

function suspendidos() {
  return sanciones.value
    .filter((s) => s.suspendido_hasta_fecha >= fecha.value)
    .map((s) => s.temporada_jugador_id)
}

function simularMio(rival, fase) {
  const { favor, contra } = simularPartido(ovrMio.value, rival?.ovr_equipo ?? 84, props.estilo, 11, props.anchura)
  const goleadores = elegirGolesConAsistencias(once.value, favor, capId.value)
  let tanda = null
  let avanzo = true
  if (['octavos', 'cuartos', 'semi', 'final'].includes(fase) && favor === contra) {
    tanda = simularTanda(ovrMio.value, rival?.ovr_equipo ?? 84, props.capitan?.posicion_natural === 'ARQ')
    avanzo = tanda.ganador
  }
  // El marcador de los 90' no cambia por la tanda: si queda 2–2, se muestra
  // 2–2 (4–5). El ganador viaja aparte para el cuadro y el historial.
  return { favor, contra, goleadores, tanda, avanzo }
}

async function jugarMio() {
  const c = partidoMio.value
  if (jugando.value || !c || finalizado.value) return
  jugando.value = true
  error.value = ''
  ladoCache = ladoMio(c)
  try {
    await cubrirSuspendidos()
    await verFigurasRival(c)
    const rival = rivalDe(c)
    const clasico = esBocaEtiq(rival)
    const p = { ...simularMio(rival, c.fase), ronda: rondaNombre(fecha.value, c.fase), rival: rival?.etiqueta ?? '?' }
    p.calendario_id = c.id // misma clave que la previa: árbitro y cronista coinciden
    const xiRival = onceRivalDe(c).map((o) => o.jugador).filter(Boolean)
    p.goleadoresRival = elegirGoleadores(xiRival, p.contra)
    lineas.value = []
    sonidoSilbato()
    if (clasico) {
      lineas.value.push('¡Es el clásico! Todo el país mira este partido.')
      await sleep(120)
    }
    const soloMios = new Set((p.goleadores ?? []).map((g) => g.jugador))
    for (const l of relato(p, props.nombreEquipo, prensaPara(p))) {
      lineas.value.push(l)
      if (l.includes('¡GOL') && soloMios.size && [...soloMios].some((n) => l.includes(n))) sonidoGol()
      await sleep(120)
    }
    if (p.tanda) await sleep(160)
    const { gf, gc } = golesParaCalendario(ladoMio(c), p.favor, p.contra)
    await jugarPartidoCalendario(c.id, gf, gc, {
      goleadores: p.goleadores, tanda: p.tanda, avanzo_usuario: p.avanzo,
      goleadoresRival: p.goleadoresRival
    })
    if (clasico) {
      const res = p.favor > p.contra ? 'g' : p.favor === p.contra ? 'e' : 'p'
      rachaClasico.value = registrarClasico(res)
      if (res === 'g') {
        try {
          const r = await desbloquearLogro(props.partidaId, 'clasico_ganado')
          if (r.nuevo) {
            logrosNuevos.value.push('clasico_ganado')
            window.dispatchEvent(new CustomEvent('3a1:logro', { detail: 'clasico_ganado' }))
          }
        } catch { /*noop*/ }
      }
    }
    await sortearTarjetas()
    await recargar()
    if (esMataMata(c) && !p.avanzo) return terminar(false)
    if (!esPremier.value && c.fase === 'final' && p.avanzo) return terminar(true)
    sonidoCampeon()
  } catch (e) {
    error.value = e.message
  } finally {
    jugando.value = false
  }
}

function resolverMataMata(c, favor, contra) {
  if (favor !== contra || !esMataMata(c)) {
    return { gf: favor, gc: contra, tanda: null, ganador: favor === contra ? null : favor > contra ? c.local_id : c.visita_id }
  }
  const tanda = simularTanda(ovrDeTe(c.local_id), ovrDeTe(c.visita_id))
  // El 90' queda empatado: 2–2 (4–5). El ganador de la tanda viaja aparte.
  return { gf: favor, gc: contra, tanda, ganador: tanda.ganador ? c.local_id : c.visita_id }
}

async function simularResto() {
  if (jugando.value || finalizado.value) return
  if (partidoMio.value) {
    aviso.value = 'Jugá tu partido primero; después se simula el resto.'
    return
  }
  jugando.value = true
  error.value = ''
  try {
    await simularFechaActual()
    await avanzar()
  } catch (e) {
    error.value = e.message
  } finally {
    jugando.value = false
  }
}

async function simularFechaActual() {
  const resto = calendario.value.filter((c) => !c.jugado && c.fecha_n === fecha.value)
  await enLotes(resto, 5, async (c) => {
    if (esMio(c)) {
      // autoMio ya guarda goleadores, asistencias, tarjetas y avanzo_usuario.
      return autoMio(c)
    }
    const { favor, contra } = simularPartidoLiga(ovrDeTe(c.local_id), ovrDeTe(c.visita_id))
    const r = resolverMataMata(c, favor, contra)
    return jugarPartidoCalendario(c.id, r.gf, r.gc, r.tanda ? { tanda: r.tanda, ganador: r.ganador } : null)
  })
  await recargar()
}

async function autoMio(c) {
  await cubrirSuspendidos()
  ladoCache = ladoMio(c)
  const rival = rivalDe(c)
  await verFigurasRival(c)
  const p = simularMio(rival, c.fase)
  const xiRival = onceRivalDe(c).map((o) => o.jugador).filter(Boolean)
  p.goleadoresRival = elegirGoleadores(xiRival, p.contra)
  // El partido se juega dentro de un lote: el relato también debe verse.
  lineas.value = relato(p, props.nombreEquipo, prensaPara(p))
  const { gf, gc } = golesParaCalendario(ladoMio(c), p.favor, p.contra)
  await jugarPartidoCalendario(c.id, gf, gc, {
    goleadores: p.goleadores, tanda: p.tanda, avanzo_usuario: p.avanzo,
    goleadoresRival: p.goleadoresRival
  })
  if (esBocaEtiq(rival)) {
    rachaClasico.value = registrarClasico(p.favor > p.contra ? 'g' : p.favor === p.contra ? 'e' : 'p')
  }
  await sortearTarjetas()
}

async function simularHasta() {
  if (jugando.value || finalizado.value) return
  const n = destinoSim.value
  jugando.value = true
  error.value = ''
  try {
    while (fecha.value < n && !finalizado.value) {
      await simularFechaActual()
      const mioJ = calendario.value.find((c) => c.jugado && c.fecha_n === fecha.value && esMio(c))
      if (mioJ && esMataMata(mioJ) && !ganeYoPlayoff(mioJ)) {
        await recargar()
        return terminar(false)
      }
      await avanzar()
    }
  } catch (e) {
    error.value = e.message
  } finally {
    jugando.value = false
  }
}

function ganeYoPlayoff(c) {
  if (esMio(c) && c.detalle && typeof c.detalle.avanzo_usuario === 'boolean') {
    return c.detalle.avanzo_usuario
  }
  if (c.gf !== c.gc) return ganeYo(c)
  return c.detalle?.ganador === yoTe.value?.id
}

async function avanzar() {
  if (!esPremier.value && fecha.value === 16) {
    const ok = await armarOctavos()
    if (!ok) return terminar(false)
  } else if (!esPremier.value && fecha.value >= 17 && fecha.value <= 19) {
    await armarSiguientePlayoff()
  }
  const sig = fecha.value + 1
  if (sig > FECHA_MAX.value) {
    await recargar()
    return terminar(await soyCampeon())
  }
  fecha.value = sig
  await actualizarTorneo(torneoId.value, { fecha_actual: sig })
  await recargar()
}

async function soyCampeon() {
  await recargarTabla()
  if (esPremier.value) {
    const top = await obtenerTabla(torneoId.value).catch(() => [])
    return !!top.length && top[0].equipo_id === yoTe.value?.id
  }
  const fin = calendario.value.find((c) => c.fase === 'final' && c.jugado && esMio(c))
  return !!fin && ganeYo(fin)
}

async function topZona(z, n = 8) {
  const t = await obtenerTabla(torneoId.value, z)
  return t.slice(0, n).map((r) => r.equipo_id)
}

async function armarOctavos() {
  const topA = await topZona('A', 8)
  const topB = await topZona('B', 8)
  if (![...topA, ...topB].includes(yoTe.value?.id)) {
    const fila = (await obtenerTabla(torneoId.value, grupoMio.value).catch(() => []))
      .find((r) => r.equipo_id === yoTe.value?.id)
    aviso.value = `No clasificaste a octavos${fila ? ` (${fila.pos}° en tu zona)` : ''}. La temporada terminó.`
    return false
  }
  const pares = crucesOctavos({ A: topA, B: topB })
  await agregarCalendario(torneoId.value, pares.map(([a, b]) => ({
    fecha_n: 17, fase: 'octavos', local_eq: a, visita_eq: b
  })))
  await recargar()
  return true
}

const FASE_SIGUIENTE = { 17: 'cuartos', 18: 'semi', 19: 'final' }

async function armarSiguientePlayoff() {
  if (esPremier.value) return
  const faseSig = FASE_SIGUIENTE[fecha.value]
  if (!faseSig) return
  // Partidas viejas (top 4) ya tienen la ronda siguiente creada: no duplicar.
  if (calendario.value.some((c) => c.fecha_n === fecha.value + 1 || c.fase === faseSig)) return
  const jug = calendario.value.filter((c) => c.jugado && c.fecha_n === fecha.value)
  const ganadores = jug.map((c) => {
    if (c.gf !== c.gc) return c.gf > c.gc ? c.local_id : c.visita_id
    return c.detalle?.ganador ?? (Math.random() < 0.5 ? c.local_id : c.visita_id)
  })
  const pares = siguienteRondaPlayoffs(ganadores)
  if (!pares.length) return
  await agregarCalendario(torneoId.value, pares.map(([a, b]) => ({
    fecha_n: fecha.value + 1, fase: faseSig, local_eq: a, visita_eq: b
  })))
  await recargar()
}

async function terminar(esCampeon) {
  finalizado.value = true
  campeon.value = esCampeon
  const mios = calendario.value.filter((c) => c.jugado && esMio(c))
  valla.value = esCampeon && mios.length > 0 && mios.every((c) => susGoles(c) === 0)
  await actualizarTorneo(torneoId.value, {
    estado: 'finalizado', campeon: esCampeon, valla: valla.value
  }).catch(() => {})
  const mvp = mvpAportes(goleadoresAcum.value)
  registrarTitulo({
    formato: props.formato, campeon: esCampeon, valla: valla.value,
    mvp: mvp?.jugador ?? null
  })

  const cods = []
  if (esCampeon) {
    cods.push('primer_campeon', esPremier.value ? 'campeon_premier' : 'campeon_liga30')
    if (valla.value) cods.push('siete_cero')
    if (promedioOvr(props.equipo) < 82) cods.push('campeon_debil')
    if (props.almanaque) cods.push('campeon_almanaque')
  }
  if (mios.some((c) => misGoles(c) - susGoles(c) >= 4)) cods.push('goleada')
  cods.push(...logrosDeTorneo({
    campeon: esCampeon,
    partidos: mios.map((c) => ({
      gf: misGoles(c), gc: susGoles(c), detalle: c.detalle,
      // `clasico` sale de local/visita guardados: logros.js solo cuenta victorias.
      clasico: esClasico(c)
    }))
  }))
  if (resumenPalmares().total >= 5) cods.push('veterano')

  if (esCampeon) sonidoCampeon()
  else sonidoError()
  for (const cod of cods) {
    try {
      const r = await desbloquearLogro(props.partidaId, cod)
      if (r.nuevo) {
        logrosNuevos.value.push(cod)
        window.dispatchEvent(new CustomEvent('3a1:logro', { detail: cod }))
      }
    } catch { /*noop*/ }
  }
  emit('fin', { campeon: esCampeon, valla: valla.value, amistoso: false })
}

async function computarCierre() {
  const mios = calendario.value.filter((c) => c.jugado && esMio(c))
  campeon.value = await soyCampeon().catch(() => false)
  valla.value = campeon.value && mios.length > 0 && mios.every((c) => susGoles(c) === 0)
}

async function sortearTarjetas() {
  if (!torneoId.value || !once.value.length) return
  try {
    const mapa = new Map(sanciones.value.map((s) => [s.temporada_jugador_id, s]))
    const cands = mezclar([...once.value])
    const n = Math.random() < 0.5 ? 1 : Math.random() < 0.2 ? 2 : 0
    for (let i = 0; i < n && i < cands.length; i++) {
      const j = cands[i]
      const prev = mapa.get(j.temporada_jugador_id)?.amarillas ?? 0
      await sancionar(torneoId.value, j.temporada_jugador_id, {
        amarillas: 1, suspendidoHasta: suspensionPorAmarilla(prev, fecha.value)
      })
      aviso.value = `${j.nombre} vio la amarilla.`
    }
    if (Math.random() < 0.04 && cands[n]) {
      const j = cands[n]
      await sancionar(torneoId.value, j.temporada_jugador_id, {
        roja: true, suspendidoHasta: fecha.value + 1
      })
      aviso.value = `¡Roja para ${j.nombre}! Se pierde la próxima fecha.`
    }
    sanciones.value = await obtenerSanciones(torneoId.value).catch(() => [])
  } catch { /* sanciones opcionales */ }
}

async function cubrirSuspendidos() {
  const susp = new Set(suspendidos())
  if (!susp.size) return
  let plantel = [...props.equipo]
  const titulares = plantel.filter((x) => !String(x.slot).startsWith('SUP'))
  for (const j of titulares.filter((x) => susp.has(x.temporada_jugador_id))) {
    const rep = plantel.find((x) =>
      String(x.slot).startsWith('SUP') &&
      !susp.has(x.temporada_jugador_id) &&
      compatible(x, j.slot)
    )
    if (!rep) {
      aviso.value = `${j.nombre} está suspendido y no hay reemplazo: se juega con 10.`
      continue
    }
    await intercambiarJugadores(props.partidaId, j.slot, rep.slot)
    aviso.value = `${j.nombre} (suspendido) sale, entra ${rep.nombre}.`
    plantel = await recargarEquipo()
  }
  await nextTick()
}

async function recargarEquipo() {
  const eq = await cargarEquipo(props.partidaId)
  emit('equipo', eq)
  return eq
}

async function intercambiar() {
  if (!swapXI.value || !swapSUP.value || jugando.value) return
  error.value = ''
  try {
    const xi = swapXIJ.value
    const sup = swapSUPJ.value
    if (swapMotivo.value) {
      error.value = swapMotivo.value
      return
    }
    await intercambiarJugadores(props.partidaId, xi.slot, sup.slot)
    aviso.value = `Cambio: entra ${sup.nombre} por ${xi.nombre}.`
    swapXI.value = ''
    swapSUP.value = ''
    await recargarEquipo()
  } catch (e) {
    error.value = e.message
  }
}

const partidosParaTabla = computed(() => calendario.value.map((c) => ({
  local: c.local_id, visita: c.visita_id, gf: c.gf, gc: c.gc, jugado: c.jugado, fecha_n: c.fecha_n
})))

const tablaRacha = computed(() => {
  const out = {}
  for (const r of tabla.value) out[r.equipo_id] = racha5(r.equipo_id, partidosParaTabla.value)
  return out
})

// Posiciones de cada equipo al cierre de una fecha. Usa el mismo desempate
// que api/tabla.php (puntos → dif → GF → fair play → id) para que la flecha
// refleje el movimiento real y no un desempate distinto.
function posicionesHasta(fechaN) {
  const ids = tabla.value.map((r) => r.equipo_id)
  if (!ids.length) return new Map()
  const fp = Object.fromEntries(tabla.value.map((r) => [r.equipo_id, r.fp ?? 0]))
  const filas = tablaHasta(ids, partidosParaTabla.value, { fairplay: fp, fecha: fechaN })
  return new Map(filas.map((f, i) => [f.id, i + 1]))
}

// Reproductor: tabla tal como estaba al cierre de la fecha elegida.
const fechaVista = ref(null)
const reproduciendo = ref(false)
const maxFechaVista = computed(() => Math.max(1, Number(fecha.value) - 1))
let reproTimer = null
const tablaMostrada = computed(() => {
  const n = Number(fechaVista.value)
  if (!n || n >= Number(fecha.value)) return tabla.value
  const ids = tabla.value.map((r) => r.equipo_id)
  if (!ids.length) return tabla.value
  const fp = Object.fromEntries(tabla.value.map((r) => [r.equipo_id, r.fp ?? 0]))
  return tablaHasta(ids, partidosParaTabla.value, { fairplay: fp, fecha: n })
    .map((f) => ({ ...f, equipo_id: f.id, etiqueta: nombreDe(f.id), escudo: escudoDe(eqPorId(f.id)) }))
})

function irAFecha(n) {
  fechaVista.value = n && n < Number(fecha.value) ? n : null
}
function alternarReproductor() {
  if (reproduciendo.value) {
    clearInterval(reproTimer)
    reproduciendo.value = false
    return
  }
  reproduciendo.value = true
  irAFecha(1)
  reproTimer = setInterval(() => {
    const actual = Number(fechaVista.value) || 1
    if (actual >= Number(fecha.value) - 1 || actual >= FECHA_MAX.value) {
      clearInterval(reproTimer)
      reproduciendo.value = false
      fechaVista.value = null
      return
    }
    irAFecha(actual + 1)
  }, 900)
}
function detenerReproductor() {
  clearInterval(reproTimer)
  reproduciendo.value = false
}
onBeforeUnmount(() => {
  clearInterval(reproTimer)
  clearTimeout(confettiTimer)
})

const movimientoTabla = computed(() => {
  const antes = posicionesHasta(Math.max(0, Number(fecha.value) - 1))
  const out = {}
  for (const r of tabla.value) {
    const previa = antes.get(r.equipo_id)
    const delta = previa ? previa - Number(r.pos) : 0
    out[r.equipo_id] = delta > 0 ? 'sube' : delta < 0 ? 'baja' : 'igual'
  }
  return out
})

// Cierre emocional de la fecha: resultado, rival y movimiento en la tabla.
// Minuto a minuto: mezcla los goles propios y del rival en orden cronológico
// y lleva el marcador parcial para que se lea como una línea de tiempo real.
const cronica = computed(() => {
  const c = miPartidoJugado.value
  if (!c?.detalle) return []
  const d = c.detalle
  const rival = rivalDe(c)
  const goles = [
    ...(d.goleadores ?? []).map((g) => ({ ...g, mio: true })),
    ...(d.goleadoresRival ?? []).map((g) => ({ ...g, mio: false }))
  ].sort((a, b) => a.minuto - b.minuto)
  let mio = 0
  let rivalG = 0
  return goles.map((g) => {
    if (g.mio) mio++
    else rivalG++
    return {
      ...g,
      escudo: g.mio ? escudoDe(yoTe.value) : escudoDe(rival),
      etiqueta: g.mio ? nombreEquipo : (rival?.etiqueta ?? 'Rival'),
      marcador: `${mio}–${rivalG}`
    }
  })
})

const confetti = ref([])
let confettiTimer = null
function lanzarConfeti() {
  const colores = ['#c8102e', '#f2c14e', '#ffffff', '#2e7d4f', '#cbd7c7']
  confetti.value = Array.from({ length: 46 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 1.1,
    dur: 2 + Math.random() * 1.5,
    color: colores[i % colores.length],
    rot: Math.round(Math.random() * 720 - 360)
  }))
  clearTimeout(confettiTimer)
  confettiTimer = setTimeout(() => { confetti.value = [] }, 4200)
}
watch(campeon, (v) => { if (v) lanzarConfeti() })

const resultadoReciente = computed(() => {
  const c = miPartidoJugado.value
  if (!c || !c.jugado) return null
  const gf = misGoles(c)
  const gc = susGoles(c)
  const rival = rivalDe(c)
  return {
    calendario_id: c.id,
    rival: rival?.etiqueta ?? '?',
    escudo: escudoDe(rival),
    gf, gc,
    sigla: gf > gc ? 'G' : gf === gc ? 'E' : 'P',
    ronda: rondaNombre(Number(c.fecha_n), c.fase),
    movimiento: movimientoTabla.value[yoTe.value?.id] ?? 'igual',
    pos: miPos.value
  }
})

// Modelo de goles visible: mismas medias y porcentajes que usa el motor.
const expectativa = computed(() => {
  const c = partidoMio.value
  if (!c) return null
  const mioLocal = ladoMio(c) === 'local'
  const ovrRival = ovrDeTe(rivalDe(c)?.id)
  const medias = mediasGoles(ovrMio.value, ovrRival, props.estilo, 11, props.anchura)
  const p = probabilidades(ovrMio.value, ovrRival, { local: mioLocal })
  return mioLocal
    ? { mio: medias.favor, rival: medias.contra, gana: p.local, empate: p.empate, pierde: p.visita }
    : { mio: medias.contra, rival: medias.favor, gana: p.visita, empate: p.empate, pierde: p.local }
})

// Contexto del rival para la previa: viene de racha + puesto en la tabla.
const estadoRival = computed(() => {
  const c = partidoMio.value || miPartidoJugado.value
  if (!c) return null
  const r = rivalDe(c)
  if (!r) return null
  const fila = tabla.value.find((x) => x.equipo_id === r.id)
  const recientes = racha5(r.id, partidosParaTabla.value).filter(Boolean).slice(-4).reverse().join('')
  return {
    etiqueta: r.etiqueta,
    puesto: fila ? `${fila.pos}°` : '—',
    puntos: fila ? `${fila.pts} pts` : '',
    racha: recientes || '—'
  }
})

// ---- Estadísticas del torneo (datos del calendario, nunca inventados) ----
const misPartidos = computed(() => calendario.value.filter((c) => c.jugado && esMio(c)))

const goleadoresTorneo = computed(() => {
  const out = new Map()
  for (const c of calendario.value) {
    if (!c.jugado || !c.detalle) continue
    const lados = [
      { id: c.local_id, goles: c.detalle.goleadores ?? [] },
      { id: c.visita_id, goles: c.detalle.goleadoresRival ?? [] }
    ]
    for (const lado of lados) {
      for (const g of lado.goles) {
        const key = `${lado.id}:${g.jugador}`
        if (!out.has(key)) out.set(key, {
          jugador: g.jugador, goles: 0, equipo_id: lado.id,
          etiqueta: nombreDe(lado.id), escudo: escudoDe(eqPorId(lado.id))
        })
        out.get(key).goles++
      }
    }
  }
  return [...out.values()]
    .sort((a, b) => b.goles - a.goles || a.jugador.localeCompare(b.jugador))
    .slice(0, 6)
})

const bestiaNegra = computed(() => {
  const map = new Map()
  for (const c of misPartidos.value) {
    const r = rivalDe(c)
    if (!r) continue
    if (!map.has(r.id)) map.set(r.id, { id: r.id, etiqueta: r.etiqueta, escudo: escudoDe(r), pj: 0, g: 0, e: 0, p: 0 })
    const f = map.get(r.id)
    const gf = misGoles(c)
    const gc = susGoles(c)
    f.pj++
    if (gf > gc) f.g++
    else if (gf === gc) f.e++
    else f.p++
  }
  const filas = [...map.values()].filter((r) => r.pj >= 2)
  return filas.length
    ? filas.sort((a, b) => (b.g / b.pj) - (a.g / a.pj) || b.g - a.g)[0]
    : null
})

const usosRivales = computed(() => {
  const usos = leerUsosRivales()
  const porId = new Map(todasTemporadas.value.map((t) => [Number(t.id), t]))
  return Object.entries(usos).map(([k, n]) => ({
    id: k, n,
    etiqueta: porId.get(Number(k))?.etiqueta
      ?? equipos.value.find((e) => String(e.id) === String(k))?.etiqueta
      ?? `Rival ${k}`
  })).filter((r) => r.n > 0)
})
const rivalesMas = computed(() => [...usosRivales.value].sort((a, b) => b.n - a.n).slice(0, 5))
const rivalesMenos = computed(() => [...usosRivales.value].sort((a, b) => a.n - b.n).slice(0, 5))

const historialRival = computed(() => {
  if (!rivalSeleccionado.value) return []
  const id = Number(rivalSeleccionado.value)
  return calendario.value
    .filter((c) => c.jugado && (Number(c.local_id) === id || Number(c.visita_id) === id))
    .map((c) => {
      const local = Number(c.local_id) === id
      const gf = local ? c.gf : c.gc
      const gc = local ? c.gc : c.gf
      return {
        fecha_n: c.fecha_n,
        etiqueta: local ? nombreDe(c.visita_id) : nombreDe(c.local_id),
        gf, gc,
        sigla: gf > gc ? 'G' : gf === gc ? 'E' : 'P',
        mio: esMio(c)
      }
    })
    .sort((a, b) => Number(a.fecha_n) - Number(b.fecha_n))
})

// Evolución de puntos del usuario, fecha por fecha (para el sparkline).
const sparkPuntos = computed(() => {
  const total = Number(fecha.value) || 0
  const out = []
  let pts = 0
  for (let f = 1; f <= total; f++) {
    for (const c of calendario.value) {
      if (!c.jugado || Number(c.fecha_n) !== f || !esMio(c)) continue
      const gf = misGoles(c)
      const gc = susGoles(c)
      pts += gf > gc ? 3 : gf === gc ? 1 : 0
    }
    out.push(pts)
  }
  return out
})
const sparkPath = computed(() => {
  const p = sparkPuntos.value
  if (p.length < 2) return ''
  const max = Math.max(...p, 1)
  return p.map((v, i) => `${i ? 'L' : 'M'}${(i / (p.length - 1) * 100).toFixed(1)},${(28 - v / max * 26).toFixed(1)}`).join(' ')
})

// Duelo contra la mejor temporada anterior del mismo formato (api/ranking.php).
const dueloTemporadas = computed(() => {
  const formato = esPremier.value ? 'premier' : 'liga30'
  const previo = rankingPrevio.value
    .filter((r) => r.formato === formato && Number(r.id) !== Number(props.partidaId))
    .sort((a, b) => (b.campeon - a.campeon) || (b.jugados - a.jugados) || (b.gf - a.gf))[0]
  if (!previo) return null
  const gf = misPartidos.value.reduce((s, c) => s + misGoles(c), 0)
  const gc = misPartidos.value.reduce((s, c) => s + susGoles(c), 0)
  const n = misPartidos.value.length
  return {
    anterior: { ...previo, promedio: previo.jugados ? (previo.gf / previo.jugados).toFixed(1) : '0.0' },
    actual: {
      jugados: n, gf, gc, campeon: campeon.value,
      promedio: n ? (gf / n).toFixed(1) : '0.0'
    }
  }
})

// "Tu plantel mezcla N épocas": conteo real de temporadas distintas del XI + banco.
const epocasMias = computed(() => {
  const out = new Map()
  for (const j of props.equipo) {
    const k = String(j.anio_orden ?? j.etiqueta ?? '')
    if (!k || out.has(k)) continue
    out.set(k, j.etiqueta ?? k)
  }
  return [...out.entries()]
    .map(([anio, etiqueta]) => ({ anio, etiqueta }))
    .sort((a, b) => String(a.anio).localeCompare(String(b.anio)))
})

const ranking = computed(() => rankingAportes(goleadoresAcum.value))
const mvp = computed(() => (ranking.value.length ? ranking.value[0] : null))
const goleador = computed(() => {
  const rs = [...ranking.value].sort((a, b) => b.g - a.g)
  return rs.length && rs[0].g > 0 ? { jugador: rs[0].jugador, goles: rs[0].g } : null
})
const asistidor = computed(() => {
  const rs = [...ranking.value].sort((a, b) => b.a - a.a)
  return rs.length && rs[0].a > 0 ? { jugador: rs[0].jugador, asistencias: rs[0].a } : null
})

defineExpose({ preparar, restaurar })
</script>

<template>
  <div class="liga">
    <div v-if="!torneoId" class="panel sorteo">
      <h2>{{ TITULO }}</h2>
      <p v-if="esPremier" class="muted">20 equipos · 38 fechas ida/vuelta · tabla + racha · clásico vs Boca cuando toque.</p>
      <p v-else class="muted">30 equipos · 2 zonas de 15 (snake) · 15 fechas + interzonal con clásico vs Boca · top 8 por zona a octavos, cuartos, semis y final.</p>
      <button class="btn primary big" :disabled="preparando" @click="preparar">
        {{ preparando ? 'Sorteando…' : `Sortear ${TITULO}` }}
      </button>
      <p v-if="error" class="error-line">{{ error }}</p>
    </div>

    <div v-else class="torneo-vivo">
      <div class="panel liga-head">
        <div class="liga-head-top">
          <h2>{{ TITULO }}</h2>
          <span class="fecha-badge">{{ finalizado ? 'Terminada' : `Fecha ${fecha} de ${FECHA_MAX}` }}</span>
        </div>
        <div v-if="!finalizado" class="progress-track"><span :style="{ width: (fecha / FECHA_MAX * 100) + '%' }"></span></div>
        <p class="muted small">Vos: {{ miPos }}{{ grupoMio ? ` · Zona ${grupoMio}` : '' }}</p>
        <p v-if="metaClasificacion" class="meta-clasificacion">{{ metaClasificacion }}</p>
      </div>
      <p v-if="error" class="error-line">{{ error }}</p>

      <div class="liga-grid">
      <div ref="tablaPanel" class="panel tabla-panel">
        <div class="tabla-head">
          <h3>{{ esPremier ? 'Tabla completa' : (verGeneral ? 'Tabla general completa' : `Zona ${grupoMio} · tabla completa`) }}{{ finalizado ? ' final' : '' }} · {{ miPos }}</h3>
          <div class="tabla-tools">
            <button v-if="fecha > 1" class="btn ghost small-btn" @click="alternarReproductor">
              {{ reproduciendo ? '⏸ Pausar' : '▶ Reproducir temporada' }}
            </button>
            <label v-if="fecha > 1" class="repro-slider">
              <span>Fecha</span>
              <input type="range" min="1" :max="maxFechaVista"
                     :value="fechaVista || maxFechaVista"
                     @input="detenerReproductor(); irAFecha(Number($event.target.value))" />
              <b>{{ fechaVista || 'actual' }}</b>
            </label>
            <button v-if="fechaVista" class="btn ghost small-btn" @click="detenerReproductor(); fechaVista = null">Volver al presente</button>
            <button v-if="!esPremier" class="btn ghost small-btn" @click="verGeneral = !verGeneral; recargarTabla()">
              {{ verGeneral ? 'Ver mi zona' : 'Ver general' }}
            </button>
          </div>
        </div>
        <div v-if="!tabla.length" class="estado-vacio">
          <span>📋</span><strong>Tabla no disponible</strong>
          <p>Reintentá la carga o volvé a entrar al torneo.</p>
          <button class="btn ghost small-btn" @click="recargarTabla">Reintentar</button>
        </div>
        <div v-else class="tabla-scroll">
          <table class="tabla-liga">
            <thead>
              <tr>
                <th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th>
                <th>GF</th><th>GC</th><th>Dif</th><th>Pts</th><th>Últimos 5</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in tablaMostrada" :key="r.equipo_id"
                  :class="{
                    mio: r.equipo_id === yoTe?.id,
                    clasifica: !esPremier && r.pos <= 8,
                    flashsube: !fechaVista && movimientoTabla[r.equipo_id] === 'sube',
                    flashbaja: !fechaVista && movimientoTabla[r.equipo_id] === 'baja'
                  }">
                <td class="pos-cel">
                  <span class="mov" :class="movimientoTabla[r.equipo_id]" :title="movimientoTabla[r.equipo_id] === 'sube' ? 'Subió' : movimientoTabla[r.equipo_id] === 'baja' ? 'Bajó' : 'Sin cambio'">{{ movimientoTabla[r.equipo_id] === 'sube' ? '↑' : movimientoTabla[r.equipo_id] === 'baja' ? '↓' : '·' }}</span>
                  {{ r.pos }}
                </td>
                <td class="equipo-cel">
                  <img v-if="escudoDe(r)" :src="escudoDe(r)" alt="" class="escudo-chico" loading="lazy" @error="(e) => e.target.remove()" />
                  <span class="ellipsis">{{ r.equipo_id === yoTe?.id ? nombreEquipo : r.etiqueta }}</span>
                </td>
                <td class="num-cel">{{ r.pj }}</td>
                <td class="num-cel">{{ r.pg }}</td>
                <td class="num-cel">{{ r.pe }}</td>
                <td class="num-cel">{{ r.pp }}</td>
                <td class="num-cel">{{ r.gf }}</td>
                <td class="num-cel">{{ r.gc }}</td>
                <td class="num-cel" :class="r.dif > 0 ? 'dif-pos' : r.dif < 0 ? 'dif-neg' : ''">{{ r.dif > 0 ? '+' : '' }}{{ r.dif }}</td>
                <td class="num-cel pts-cel">{{ r.pts }}</td>
                <td class="racha-cel">
                  <span v-for="(r5, i) in (tablaRacha[r.equipo_id] ?? [])" :key="i"
                        class="puntito" :class="{ g: r5 === 'V', e: r5 === 'E', p: r5 === 'D' }"
                        :title="r5 === 'V' ? 'Ganado' : r5 === 'E' ? 'Empatado' : r5 === 'D' ? 'Perdido' : 'Sin jugar'"></span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="leyenda-racha"><span class="puntito g"></span> ganado <span class="puntito e"></span> empate <span class="puntito p"></span> perdido <span class="puntito"></span> sin jugar</p>
        <p v-if="!esPremier" class="muted small">Los 8 primeros de cada zona juegan los octavos.</p>
        <p class="muted small">Desempates: puntos → diferencia → GF → fair play.</p>
      </div>
      <div class="liga-main">
      <div class="modo-sim" role="group" aria-label="Modo de simulación">
        <button type="button" :class="{ on: modoSim === 'manual' }" @click="modoSim = 'manual'">
          Partido a partido
        </button>
        <button type="button" :class="{ on: modoSim === 'auto' }" @click="modoSim = 'auto'">
          Automático <small>menos toques</small>
        </button>
      </div>
      <p class="modo-sim-ayuda">
        {{ modoSim === 'auto'
          ? 'Se juega tu partido y los del resto de la fecha con un solo toque.'
          : 'Primero jugás tu partido y después decidís cuándo simular el resto.' }}
      </p>
      <EstadoSimulacion :jugando="jugando"
                        :titulo="`Simulando fecha ${fecha} de ${FECHA_MAX}`"
                        detalle="Se juegan tu partido y los del resto. El relato se actualiza acá." />
      <div v-if="partidoMio && !finalizado" class="panel previa" :class="{ clasico: esClasico(partidoMio) }">
        <h3>{{ rondaNombre(fecha, partidoMio.fase) }} · previa</h3>
        <p v-if="esClasico(partidoMio)" class="pica">
          ¡EL CLÁSICO! vs Boca · racha {{ rachaClasico.g }}G-{{ rachaClasico.e }}E-{{ rachaClasico.p }}P
        </p>
        <div v-if="expectativa" class="expectativa" role="status">
          <span class="ex-kicker">Pronóstico del partido</span>
          <p class="ex-goles">
            <strong>{{ nombreEquipo }} {{ expectativa.mio.toFixed(2) }} – {{ expectativa.rival.toFixed(2) }} {{ rivalDe(partidoMio)?.etiqueta ?? 'rival' }}</strong>
            <small>Goles esperados: cuántos se espera que marque cada uno.</small>
          </p>
          <div class="ex-barra" aria-hidden="true">
            <span class="g" :style="{ width: expectativa.gana + '%' }"></span>
            <span class="e" :style="{ width: expectativa.empate + '%' }"></span>
            <span class="p" :style="{ width: expectativa.pierde + '%' }"></span>
          </div>
          <p class="ex-prob">
            Posibilidades: <b class="g">ganás {{ expectativa.gana }}%</b> ·
            <b class="e">empate {{ expectativa.empate }}%</b> ·
            <b class="p">perdés {{ expectativa.pierde }}%</b>
          </p>
          <small class="ex-nota">Es una estimación con el mismo motor que juega el partido, no el resultado.</small>
        </div>
        <div v-if="titularesSuspendidos.length" class="previo-alerta">
          <strong>⚠ Titulares suspendidos</strong>
          <span v-for="d in titularesSuspendidos" :key="d.jugador.temporada_jugador_id">
            {{ d.jugador.nombre }} (hasta F{{ d.hasta }})
          </span>
          <small>Se cubren solos con el banco, pero podés elegir el reemplazo en “Cambios”.</small>
        </div>
        <div v-if="titularesEnRiesgo.length" class="previo-alerta riesgo">
          <strong>🟨 Titulares en riesgo</strong>
          <span v-for="d in titularesEnRiesgo" :key="d.jugador.temporada_jugador_id">
            {{ d.jugador.nombre }} ({{ d.amarillas }}/2)
          </span>
          <small>Si ven otra amarilla, se pierden la próxima fecha.</small>
        </div>
        <div class="previo-actions">
          <p v-if="estadoRival" class="rival-form">
            {{ estadoRival.etiqueta }} viene {{ estadoRival.racha }} · {{ estadoRival.puesto }} ({{ estadoRival.puntos }})
          </p>
        </div>
        <div class="ficha">
          <img v-if="escudoDe(rivalDe(partidoMio))" :src="escudoDe(rivalDe(partidoMio))" alt="escudo rival" class="escudo" loading="lazy" @error="(e) => e.target.remove()" />
          <p class="vs"><strong>{{ rivalDe(partidoMio)?.etiqueta ?? '?' }}</strong></p>
          <p class="muted small">{{ rivalDe(partidoMio)?.formacion ?? '' }} · OVR {{ almanaque ? '¿?' : (rivalDe(partidoMio)?.ovr_equipo ?? '?') }}</p>
          <p v-if="textoPrensa(partidoMio)" class="prensa-line">{{ textoPrensa(partidoMio) }}</p>
          <button class="btn ghost small-btn alineacion-toggle" :aria-expanded="alineacionAbierta === 'previa'"
                  @click="alternarAlineacion('previa')">
            {{ alineacionAbierta === 'previa' ? 'Ocultar XV' : 'Ver XV del rival' }}
          </button>
        </div>
        <XvRivalModal v-if="alineacionAbierta === 'previa' && rivalDe(partidoMio)"
                      :temporada="rivalDe(partidoMio)" :almanaque="almanaque"
                      @cerrar="alineacionAbierta = null" />
        <p v-if="aviso" class="muted small">{{ aviso }}</p>
        <button v-if="modoSim === 'manual'" class="btn primary big" :disabled="jugando" @click="jugarMio">
          {{ jugando ? 'Jugando…' : 'Jugar partido' }}
        </button>
        <button v-else class="btn primary big" :disabled="jugando" @click="simularResto">
          {{ jugando ? 'Simulando…' : 'Simular fecha y avanzar' }}
        </button>
      </div>

      <div v-if="resultadoReciente && !partidoMio && !finalizado && !jugando" class="panel resultado-card partido-terminado-banner"
           :class="'res-' + resultadoReciente.sigla.toLowerCase()">
        <p class="terminado-kicker">Partido terminado</p>
        <p class="marcador-texto">{{ nombreEquipo }} {{ resultadoReciente.gf }}–{{ resultadoReciente.gc }} {{ resultadoReciente.rival }}</p>
        <p v-if="textoPrensa(resultadoReciente)" class="prensa-line">{{ textoPrensa(resultadoReciente) }}</p>
        <p v-if="textoTribuna(resultadoReciente)" class="prensa-line">{{ textoTribuna(resultadoReciente) }}</p>
        <div class="resultado-head">
          <div class="resultado-rival">
            <small>{{ resultadoReciente.ronda }}</small>
            <strong>{{ resultadoReciente.rival }}</strong>
          </div>
          <div class="marcador-tablero">
            <img v-if="escudoDe(yoTe)" :src="escudoDe(yoTe)" alt="escudo de River" class="escudo-tablero" @error="(e) => e.target.remove()" />
            <div class="marcador-nums">{{ resultadoReciente.gf }}<span>:</span>{{ resultadoReciente.gc }}</div>
            <img v-if="resultadoReciente.escudo" :src="resultadoReciente.escudo" alt="escudo rival" class="escudo-tablero" @error="(e) => e.target.remove()" />
          </div>
          <span class="resultado-sigla">{{ resultadoReciente.sigla }}</span>
        </div>
        <div class="resultado-datos">
          <span v-if="goleador">Goleador: <strong>{{ goleador.jugador }}</strong> ({{ goleador.goles }})</span>
          <span v-if="mvp">Figura: <strong>{{ mvp.jugador }}</strong></span>
          <span>Tabla: <strong>{{ resultadoReciente.pos }}</strong>
            <em v-if="resultadoReciente.movimiento === 'sube'" class="sube">↑ subiste</em>
            <em v-else-if="resultadoReciente.movimiento === 'baja'" class="baja">↓ bajaste</em>
            <em v-else>= sin cambio</em>
          </span>
        </div>
        <div class="row terminado-acciones">
          <button class="btn primary" :disabled="jugando" @click="simularResto">
            {{ modoSim === 'auto' ? 'Simular fecha y avanzar' : 'Terminar fecha y avanzar' }}
          </button>
          <button class="btn ghost" @click="irATabla">Ver tabla</button>
        </div>
        <div v-if="cronica.length" class="cronica">
          <h4>Minuto a minuto</h4>
          <ol>
            <li v-for="(g, i) in cronica" :key="i">
              <span class="cronica-min">{{ g.minuto }}'</span>
              <img v-if="g.escudo" :src="g.escudo" alt="" class="escudo-cronica" @error="(e) => e.target.remove()" />
              <span class="cronica-jugador">{{ g.jugador }}</span>
              <span class="cronica-eq">{{ g.mio ? nombreEquipo : g.etiqueta }}</span>
              <b class="cronica-marcador">{{ g.marcador }}</b>
            </li>
          </ol>
        </div>
      </div>

      <div v-if="!partidoMio && !finalizado" class="panel">
        <h3 v-if="miPartidoJugado">{{ rondaNombre(fecha, miPartidoJugado.fase) }} · jugado</h3>
        <div v-if="miPartidoJugado" class="mini-previa">
          <img v-if="escudoDe(rivalDe(miPartidoJugado))" :src="escudoDe(rivalDe(miPartidoJugado))" class="escudo" alt="escudo rival" loading="lazy" @error="(e) => e.target.remove()" />
          <p class="vs"><strong>{{ rivalDe(miPartidoJugado)?.etiqueta ?? '?' }}</strong>
            · {{ misGoles(miPartidoJugado) }} – {{ susGoles(miPartidoJugado) }}</p>
          <p v-if="textoPrensa(miPartidoJugado)" class="prensa-line">{{ textoPrensa(miPartidoJugado) }}</p>
          <p v-if="textoTribuna(miPartidoJugado)" class="prensa-line">{{ textoTribuna(miPartidoJugado) }}</p>
          <button class="btn ghost small-btn alineacion-toggle" :aria-expanded="alineacionAbierta === 'jugado'"
                  @click="alternarAlineacion('jugado')">
            {{ alineacionAbierta === 'jugado' ? 'Ocultar XV' : 'Ver XV del rival' }}
          </button>
          <XvRivalModal v-if="alineacionAbierta === 'jugado' && rivalDe(miPartidoJugado)"
                        :temporada="rivalDe(miPartidoJugado)" :almanaque="almanaque"
                        @cerrar="alineacionAbierta = null" />
        </div>
        <p v-else>No tenés partido en la fecha {{ fecha }} (fecha libre). Podés simular el resto.</p>
        <p v-if="aviso" class="muted small">{{ aviso }}</p>
        <button class="btn primary big" :disabled="jugando" @click="simularResto">
          {{ jugando ? 'Simulando…' : 'Simular fecha y avanzar' }}
        </button>
      </div>

      <RelatoEnVivo :lineas="lineas" :jugando="jugando"
                    :titulo="`Minuto a minuto · fecha ${fecha}`" />

      <div v-if="finalizado" class="panel cierre">
        <p class="terminado-kicker">Torneo finalizado</p>
        <h2>{{ campeon ? '🏆 CAMPEÓN' : 'Temporada terminada' }}
          <span v-if="campeon && valla" class="badge goldbg">7A0</span>
        </h2>
        <p class="muted small">Siguiente paso: revisá tu palmarés desde la pantalla principal o empezá una nueva partida.</p>
        <p v-if="aviso" class="muted small">{{ aviso }}</p>
        <p v-if="goleador" class="muted">Goleador: <strong>{{ goleador.jugador }}</strong> ({{ goleador.goles }})</p>
        <p v-if="asistidor" class="muted">Asistidor: <strong>{{ asistidor.jugador }}</strong> ({{ asistidor.asistencias }})</p>
        <p v-if="mvp" class="muted">MVP de la temporada: <strong>{{ mvp.jugador }}</strong> ({{ mvp.g }}G + {{ mvp.a }}A)</p>
        <div v-if="logrosNuevos.length" class="row">
          <span v-for="c in logrosNuevos" :key="c" class="badge goldbg">{{ LOGROS_LABEL[c] ?? c }}</span>
        </div>
        <div class="resumen-final">
          <h4>Resumen final</h4>
          <p><strong>{{ epocasMias.length }}</strong> épocas en el plantel ·
            <strong>{{ sparkPuntos.length }}</strong> fechas ·
            <strong>{{ sparkPuntos.length ? sparkPuntos[sparkPuntos.length - 1] : 0 }}</strong> puntos</p>
          <p v-if="bestiaNegra">Rival favorito: <strong>{{ bestiaNegra.etiqueta }}</strong>
            ({{ bestiaNegra.g }}G–{{ bestiaNegra.e }}E–{{ bestiaNegra.p }}P)</p>
          <svg v-if="sparkPath" class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" role="img"
               :aria-label="`Evolución final de puntos: ${sparkPuntos.join(', ')}`">
            <path :d="sparkPath" fill="none" stroke="#c8102e" stroke-width="2" vector-effect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
      </div><!-- /liga-main -->

      <aside class="liga-side">
      <div v-if="torneoId" class="panel estadisticas">
        <h3>Estadísticas</h3>
        <div class="stats-block">
          <h4>Tu plantel mezcla {{ epocasMias.length }} época{{ epocasMias.length === 1 ? '' : 's' }}</h4>
          <div class="epoca-chips">
            <span v-for="e in epocasMias" :key="e.anio" class="epoca-chip">{{ e.etiqueta }}</span>
          </div>
        </div>
        <div class="stats-block">
          <h4>Tus puntos por fecha</h4>
          <svg v-if="sparkPath" class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" role="img"
               :aria-label="`Evolución de puntos: ${sparkPuntos.join(', ')}`">
            <path :d="sparkPath" fill="none" stroke="#c8102e" stroke-width="2" vector-effect="non-scaling-stroke" />
          </svg>
          <p class="muted small">{{ sparkPuntos.length ? `${sparkPuntos[0]} → ${sparkPuntos[sparkPuntos.length - 1]} pts` : 'Sin fechas jugadas' }}</p>
        </div>
        <div v-if="goleadoresTorneo.length" class="stats-block">
          <h4>Goleadores (tus partidos)</h4>
          <ol class="stats-lista">
            <li v-for="(g, i) in goleadoresTorneo" :key="i">
              <img v-if="g.escudo" :src="g.escudo" alt="" class="escudo-stat" @error="(e) => e.target.remove()" />
              <span>{{ g.jugador }}</span><small>{{ g.etiqueta }}</small><b>{{ g.goles }}</b>
            </li>
          </ol>
        </div>
        <div v-if="bestiaNegra" class="stats-block">
          <h4>Tu bestia negra</h4>
          <p class="bestia">
            <img v-if="bestiaNegra.escudo" :src="bestiaNegra.escudo" alt="" class="escudo-stat" @error="(e) => e.target.remove()" />
            <strong>{{ bestiaNegra.etiqueta }}</strong>
            <span>{{ bestiaNegra.g }}G {{ bestiaNegra.e }}E {{ bestiaNegra.p }}P en {{ bestiaNegra.pj }}</span>
          </p>
        </div>
        <div v-if="dueloTemporadas" class="stats-block">
          <h4>Duelo de temporadas</h4>
          <div class="duelo">
            <div><small>Mejor anterior · {{ dueloTemporadas.anterior.formato }}</small>
              <b>{{ dueloTemporadas.anterior.promedio }} g/partido</b>
              <span>{{ dueloTemporadas.anterior.jugados }} PJ{{ dueloTemporadas.anterior.campeon ? ' · campeón' : '' }}</span></div>
            <em>vs</em>
            <div><small>Esta temporada</small>
              <b>{{ dueloTemporadas.actual.promedio }} g/partido</b>
              <span>{{ dueloTemporadas.actual.jugados }} PJ{{ dueloTemporadas.actual.campeon ? ' · campeón' : '' }}</span></div>
          </div>
        </div>
        <div v-if="usosRivales.length" class="stats-block">
          <h4>Rivales que más cruzaste</h4>
          <div class="rival-chips">
            <button v-for="r in rivalesMas" :key="r.id" class="rival-chip" :class="{ activo: rivalSeleccionado === r.id }"
                    @click="rivalSeleccionado = rivalSeleccionado === r.id ? null : r.id">
              {{ r.etiqueta }} <b>×{{ r.n }}</b>
            </button>
          </div>
          <h4>Rivales que menos cruzaste</h4>
          <div class="rival-chips">
            <button v-for="r in rivalesMenos" :key="r.id" class="rival-chip" :class="{ activo: rivalSeleccionado === r.id }"
                    @click="rivalSeleccionado = rivalSeleccionado === r.id ? null : r.id">
              {{ r.etiqueta }} <b>×{{ r.n }}</b>
            </button>
          </div>
          <div v-if="rivalSeleccionado" class="historial-rival">
            <p class="muted small">Historial en este torneo · {{ usosRivales.find((r) => r.id === rivalSeleccionado)?.etiqueta }}</p>
            <p v-if="!historialRival.length" class="muted small">Todavía no te cruzaste en este torneo.</p>
            <ul v-else>
              <li v-for="(h, i) in historialRival" :key="i">
                <span>F{{ h.fecha_n }}</span><b :class="{ mio: h.mio }">{{ h.etiqueta }}</b>
                <em>{{ h.gf }}–{{ h.gc }}</em><strong :class="'res-' + h.sigla.toLowerCase()">{{ h.sigla }}</strong>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div v-if="cuadro.length" class="panel cuadro">
        <h3>Cuadro de playoffs</h3>
        <div v-for="r in cuadro" :key="r.n" class="ronda-cuadro">
          <b>{{ r.nombre }}</b>
          <div v-for="c in r.partidos" :key="c.id" class="cruce" :class="{ mio: esMio(c) }">
            <span :class="{ gana: ganadorCruce(c) === c.local_id }">{{ nombreDe(c.local_id) }}</span>
            <em>{{ c.jugado ? `${c.gf}–${c.gc}` : 'vs' }}</em>
            <span :class="{ gana: ganadorCruce(c) === c.visita_id }">{{ nombreDe(c.visita_id) }}</span>
          </div>
        </div>
      </div>

      <div v-if="!finalizado && modoSim === 'auto'" class="panel simular-hasta">
        <div class="sim-hasta-head">
          <h3>Simular hasta una fecha</h3>
          <span class="fecha-badge">Fecha {{ fecha }} de {{ FECHA_MAX }}</span>
        </div>
        <p class="muted small">Se juegan tus partidos y los de los demás, fecha por fecha. Podés seguir el relato de cada uno.</p>
        <div class="sim-hasta-control">
          <label for="simHastaN">Fecha destino</label>
          <input id="simHastaN" v-model.number="simHastaN" type="range"
                 :min="fecha + 1" :max="FECHA_MAX" />
          <div class="sim-hasta-num">
            <button type="button" aria-label="Fecha anterior"
                    :disabled="destinoSim <= fecha + 1"
                    @click="simHastaN = destinoSim - 1">−</button>
            <strong>{{ destinoSim }}</strong>
            <button type="button" aria-label="Fecha siguiente"
                    :disabled="destinoSim >= FECHA_MAX"
                    @click="simHastaN = destinoSim + 1">+</button>
          </div>
        </div>
        <div class="sim-hasta-resumen">
          <span><b>{{ fechasASimular }}</b> fecha{{ fechasASimular === 1 ? '' : 's' }}</span>
          <span><b>{{ partidosASimular }}</b> partidos</span>
          <span>Hasta {{ rondaNombre(destinoSim) }}</span>
        </div>
        <div class="row sim-hasta-acciones">
          <button class="btn primary" :disabled="jugando || fecha >= FECHA_MAX" @click="simularHasta">
            Simular hasta la fecha {{ destinoSim }}
          </button>
          <button class="btn ghost" :disabled="jugando || fecha >= FECHA_MAX"
                  @click="simHastaN = fecha + 1; simularHasta()">Solo la próxima</button>
        </div>
      </div>

      <div v-if="disciplina.length" class="panel disciplina-panel">
        <h3>Disciplina</h3>
        <p class="muted small">Cada 2 amarillas (o una roja) se pierde la fecha siguiente. Revisá antes de jugar.</p>
        <ul>
          <li v-for="d in disciplina" :key="d.jugador.temporada_jugador_id"
              :class="{ suspendido: d.suspendido, riesgo: d.enRiesgo }">
            <img v-if="fotoDe(d.jugador)" :src="fotoDe(d.jugador)" :alt="d.jugador.nombre" loading="lazy"
                 @error="(e) => fallbackInicial(e, d.jugador, 'disc-ini')" />
            <span v-else class="disc-ini">{{ d.jugador.nombre.charAt(0) }}</span>
            <span class="disc-nombre">
              <strong>{{ d.jugador.nombre }}</strong>
              <small>{{ d.titular ? 'Titular' : 'Banco' }}</small>
            </span>
            <b class="disc-estado">
              {{ d.suspendido ? `Suspendido · F${d.hasta}` : d.enRiesgo ? `${d.amarillas}/2 · en riesgo` : `${d.amarillas} amarillas` }}
            </b>
          </li>
        </ul>
        <p v-if="titularesEnRiesgo.length" class="disc-aviso">
          Podés preservar a {{ titularesEnRiesgo.map((d) => d.jugador.nombre).join(', ') }} desde “Cambios”.
        </p>
      </div>

      <div v-if="!finalizado && banco.length && once.length" class="panel cambios-panel">
        <div class="cambios-head">
          <h3>Cambios (entre partidos)</h3>
          <p class="muted small">Tocá al titular que sale y al suplente que entra.</p>
        </div>
        <div class="cambios-grid">
          <div class="cambios-col">
            <h4>Sale del XI</h4>
            <button v-for="j in once" :key="j.slot" type="button" class="cambio-card"
                    :class="{ on: swapXI === j.slot }" @click="swapXI = j.slot">
              <img v-if="fotoDe(j)" :src="fotoDe(j)" :alt="j.nombre" loading="lazy"
                   @error="(e) => fallbackInicial(e, j, 'cambio-ini')" />
              <span v-else class="cambio-ini">{{ j.nombre.charAt(0) }}</span>
              <span class="cambio-id">
                <small>{{ j.slot }} · {{ posDe(j.slot) }}</small>
                <strong>{{ j.nombre }}</strong>
              </span>
              <b class="cambio-ovr">{{ j.ovr_final }}</b>
            </button>
          </div>
          <div class="cambios-col">
            <h4>Entra del banco</h4>
            <button v-for="j in banco" :key="j.slot" type="button" class="cambio-card"
                    :class="{ on: swapSUP === j.slot, no: swapXI && !compatible(j, swapXI) }"
                    @click="swapSUP = j.slot">
              <img v-if="fotoDe(j)" :src="fotoDe(j)" :alt="j.nombre" loading="lazy"
                   @error="(e) => fallbackInicial(e, j, 'cambio-ini')" />
              <span v-else class="cambio-ini">{{ j.nombre.charAt(0) }}</span>
              <span class="cambio-id">
                <small>{{ j.slot }} · {{ j.posicion_natural }}</small>
                <strong>{{ j.nombre }}</strong>
                <em v-if="swapXI">{{ compatible(j, swapXI) ? '✓ cubre el puesto' : '✗ no cubre' }}</em>
              </span>
              <b class="cambio-ovr">{{ j.ovr_final }}</b>
            </button>
          </div>
        </div>
        <p v-if="swapMotivo" class="cambio-aviso">{{ swapMotivo }}</p>
        <p v-else class="cambio-listo">Listo: entra <strong>{{ swapSUPJ.nombre }}</strong> por <strong>{{ swapXIJ.nombre }}</strong>.</p>
        <button class="btn primary" :disabled="jugando || !!swapMotivo" @click="intercambiar">Confirmar cambio</button>
        <p v-if="aviso" class="muted small">{{ aviso }}</p>
      </div>
      </aside>
      </div><!-- /liga-grid -->
    </div>
  </div>
  <div v-if="confetti.length" class="confetti" aria-hidden="true">
    <i v-for="p in confetti" :key="p.id" :style="{
      left: p.x + '%', background: p.color, animationDelay: p.delay + 's',
      animationDuration: p.dur + 's', '--rot': p.rot + 'deg'
    }"></i>
  </div>
</template>

<style scoped>
.sorteo { text-align: center; }
.previa { text-align: center; }
.previa.clasico { border: 2px solid #c8102e; }
.pica { color: #c8102e; font-weight: 800; text-transform: uppercase; font-size: 13px; letter-spacing: .06em; }
.ficha { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.escudo { width: 56px; height: 56px; object-fit: contain; }
.vs { font-size: 17px; margin: 4px 0 0; }
.prensa-line { font: 500 11px/1.4 'JetBrains Mono', monospace; color: var(--texto-suave); margin: 6px 0 8px; }
.error-line { color: #c8102e; font-size: 13px; margin: 8px 2px; }
.meta-clasificacion { margin: 6px 0 0; font: 600 11px 'JetBrains Mono', monospace; color: #1b7f3b;
  background: var(--superficie-verde); border-left: 3px solid #1b7f3b; padding: 6px 8px; border-radius: 4px; }
.tabla-panel { grid-column: 1 / -1; }
.tabla-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.tabla-head h3 { margin: 0; }
.tabla-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.repro-slider { display: inline-flex; align-items: center; gap: 7px; font: 600 10px 'JetBrains Mono', monospace;
  text-transform: uppercase; color: var(--texto-tenue); }
.repro-slider input { width: 130px; accent-color: #c8102e; min-height: 20px; }
.repro-slider b { color: #c8102e; min-width: 26px; text-align: right; }
@keyframes flashsube { from { background: var(--superficie-verde); } to { background: transparent; } }
@keyframes flashbaja { from { background: #fadde1; } to { background: transparent; } }
.tabla-liga tr.flashsube td { animation: flashsube 1.1s ease-out; }
.tabla-liga tr.flashbaja td { animation: flashbaja 1.1s ease-out; }
/* Ancho completo, sin scroll vertical: se ven todas las filas de una. */
.tabla-scroll { max-height: none; overflow: visible; margin-top: 8px; border: 1px solid var(--linea); border-radius: 6px; }
.tabla-liga { width: 100%; border-collapse: collapse; font-size: 12px; }
.tabla-liga thead th { background: var(--superficie-media); text-align: left;
  padding: 7px 6px; font: 600 10px 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: .05em;
  color: var(--texto-tenue); border-bottom: 1px solid #ded7c7; }
.tabla-liga th:not(:nth-child(2)), .tabla-liga td:not(:nth-child(2)) { text-align: center; }
.tabla-liga td { padding: 6px; border-bottom: 1px solid var(--linea); white-space: nowrap; }
.tabla-liga tr:last-child td { border-bottom: 0; }
.tabla-liga tr.clasifica td:first-child { box-shadow: inset 3px 0 0 #1b7f3b; }
.tabla-liga tr.mio { background: var(--superficie-roja); }
.tabla-liga tr.mio .equipo-cel { font-weight: 800; color: #c8102e; }
.pos-cel { font-family: 'JetBrains Mono', monospace; }
.mov { display: inline-block; width: 13px; font-weight: 800; }
.mov.sube { color: #1b7f3b; }
.mov.baja { color: #c8102e; }
.mov.igual { color: #c4bcac; }
.equipo-cel { max-width: 150px; }
.escudo-chico { width: 18px; height: 18px; object-fit: contain; vertical-align: middle; margin-right: 4px; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.num-cel { font-family: 'JetBrains Mono', monospace; }
.dif-pos { color: #1b7f3b; }
.dif-neg { color: #c8102e; }
.pts-cel { font-weight: 800; }
.racha-cel { white-space: nowrap; }
.puntito { display: inline-block; width: 9px; height: 9px; margin: 0 1px; border-radius: 50%;
  background: var(--superficie); border: 1px solid #cfc8b8; vertical-align: middle; }
.puntito.g { background: #1b7f3b; border-color: #1b7f3b; }
.puntito.e { background: #e0b122; border-color: #e0b122; }
.puntito.p { background: #c8102e; border-color: #c8102e; }
.leyenda-racha { display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  margin: 7px 0 0; font-size: 10px; color: var(--texto-tenue); }
.alineacion-toggle { margin-top: 4px; }
.terminado-kicker { margin: 0 0 4px; font: 700 11px 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #1b7f3b; }
.marcador-texto { margin: 2px 0 8px; font: 600 15px 'Oswald', sans-serif; color: var(--tinta); }
.terminado-acciones { margin-top: 10px; }
.resultado-card { border-left: 4px solid var(--linea); }
.resultado-card.res-g { border-left-color: #1b7f3b; }
.resultado-card.res-e { border-left-color: #e0b122; }
.resultado-card.res-p { border-left-color: #c8102e; }
.resultado-card.partido-terminado-banner { border-left-color: #1b7f3b; }
.resultado-head { display: flex; align-items: center; gap: 10px; }
.resultado-rival { display: flex; flex-direction: column; text-align: left; flex: 1; min-width: 0; }
.resultado-rival small { font: 600 10px 'Oswald', sans-serif; text-transform: uppercase; color: var(--texto-tenue); }
.resultado-rival strong { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.marcador-tablero { display: flex; align-items: center; gap: 9px; padding: 6px 12px;
  background: var(--negro); border-radius: 6px; box-shadow: inset 0 0 0 1px #3a3f3a; }
.escudo-tablero { width: 30px; height: 30px; object-fit: contain; }
.marcador-nums { font: 600 27px 'Oswald', sans-serif; color: #fff; white-space: nowrap; letter-spacing: .04em; }
.marcador-nums span { color: #7b837a; margin: 0 3px; }
.cronica { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--linea); }
.cronica h4 { margin: 0 0 7px; font: 600 10px 'JetBrains Mono', monospace; text-transform: uppercase;
  letter-spacing: .08em; color: var(--texto-tenue); }
.cronica ol { list-style: none; margin: 0; padding: 0; }
.cronica li { display: flex; align-items: center; gap: 8px; padding: 5px 0;
  border-bottom: 1px dashed #eae5d8; font-size: 12px; }
.cronica li:last-child { border-bottom: 0; }
.cronica-min { min-width: 28px; font: 700 11px 'JetBrains Mono', monospace; color: #c8102e; }
.escudo-cronica { width: 20px; height: 20px; object-fit: contain; }
.cronica-jugador { font-weight: 600; flex: 1; min-width: 0; }
.cronica-eq { color: var(--texto-tenue); font-size: 10px; }
.cronica-marcador { font: 700 12px 'JetBrains Mono', monospace; color: var(--tinta); }
.confetti { position: fixed; inset: 0; z-index: 60; pointer-events: none; overflow: hidden; }
.confetti i { position: absolute; top: -16px; width: 9px; height: 15px; opacity: 0; border-radius: 2px;
  animation-name: caerConfeti; animation-timing-function: linear; animation-fill-mode: forwards; }
@keyframes caerConfeti { 0% { transform: translateY(-10px) rotate(0); opacity: 1; }
  100% { transform: translateY(105vh) rotate(var(--rot)); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .confetti { display: none; } }
.resultado-sigla { display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%; color: #fff; background: var(--linea-fuerte); font-weight: 800; }
.res-g .resultado-sigla { background: #1b7f3b; }
.res-e .resultado-sigla { background: #e0b122; }
.res-p .resultado-sigla { background: #c8102e; }
.resultado-datos { display: flex; flex-wrap: wrap; gap: 5px 14px; margin-top: 10px;
  padding-top: 9px; border-top: 1px solid var(--linea); font-size: 12px; color: var(--texto-suave); }
.resultado-datos em { font-style: normal; font-weight: 700; }
.resultado-datos .sube { color: #1b7f3b; }
.resultado-datos .baja { color: #c8102e; }
.cuadro .ronda-cuadro { margin-bottom: 10px; }
.cuadro .ronda-cuadro > b { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--texto-tenue); }
.cuadro .cruce { display: grid; grid-template-columns: 1fr auto 1fr; gap: 4px; align-items: center;
  font-size: 12px; padding: 3px 5px; border-radius: 5px; }
.cuadro .cruce.mio { background: var(--superficie-roja); outline: 1px solid #c8102e; }
.cuadro .cruce span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cuadro .cruce span:last-child { text-align: right; }
.cuadro .cruce .gana { font-weight: 800; color: #1b7f3b; }
.cuadro .cruce em { font-style: normal; font-family: 'JetBrains Mono', monospace; }
.liga-head-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.liga-head h2 { margin: 0; font: 600 20px 'Oswald', sans-serif; text-transform: uppercase; }
.fecha-badge { background: var(--negro); color: #fff; border-radius: 12px; padding: 3px 12px; font: 600 11px 'JetBrains Mono', monospace; white-space: nowrap; }
.progress-track { height: 5px; margin-top: 10px; background: var(--superficie-media); border-radius: 3px; overflow: hidden; }
.progress-track span { display: block; height: 100%; background: #c8102e; transition: width .4s ease; }
.liga-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; margin-top: 14px; align-items: start; }
.liga-main, .liga-side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.previo-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin: 8px 0; }
.rival-form { margin: 0; font: 600 10px 'JetBrains Mono', monospace; color: #6f776d; }
.pica-cuota { font-weight: 500; opacity: .85; }
.previa.clasico { border-color: #c8102e; box-shadow: inset 0 0 0 1px #c8102e; }
.previa.clasico .pica { font-size: 14px; }
@media (max-width: 900px) { .liga-grid { grid-template-columns: 1fr; } }
/* En pantallas chicas la tabla ancha se desplaza horizontalmente, pero sin
   cortar filas: el scroll es solo lateral. */
@media (max-width: 760px) {
  .tabla-scroll { overflow-x: auto; }
  .tabla-liga { min-width: 620px; }
}
.num { width: 80px; padding: 6px 8px; border: 1px solid #b8ab8f; border-radius: 4px; font-size: 16px; }
select { padding: 8px; border: 1px solid #b8ab8f; border-radius: 4px; font-size: 13px; max-width: 220px; }
.badge { background: #c8102e; color: #fff; border-radius: 6px; padding: 0 6px; font-size: 12px; margin-left: 6px; }
.badge.goldbg { background: linear-gradient(180deg, #d4af37, #a8842c); }
/* Estadísticas */
.estadisticas h4, .resumen-final h4 { margin: 0 0 6px; font: 600 10px 'JetBrains Mono', monospace;
  text-transform: uppercase; letter-spacing: .06em; color: var(--texto-tenue); }
.stats-block { padding: 9px 0; border-bottom: 1px dashed #e4ddcf; }
.stats-block:last-child { border-bottom: 0; padding-bottom: 0; }
.epoca-chips, .rival-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.epoca-chip { padding: 3px 7px; background: var(--superficie-baja); border: 1px solid var(--linea); border-radius: 999px;
  font-size: 10px; color: #6f776d; }
.spark { display: block; width: 100%; height: 34px; margin: 3px 0; }
.stats-lista { list-style: none; margin: 0; padding: 0; }
.stats-lista li { display: flex; align-items: center; gap: 7px; padding: 3px 0; font-size: 11px; }
.stats-lista li span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stats-lista li small { color: var(--texto-tenue); font-size: 9px; max-width: 90px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stats-lista li b { min-width: 16px; text-align: right; color: #c8102e; }
.escudo-stat { width: 19px; height: 19px; object-fit: contain; flex: none; }
.bestia { display: flex; align-items: center; gap: 7px; margin: 0; font-size: 11px; }
.bestia strong { flex: 1; min-width: 0; }
.bestia span { color: var(--texto-tenue); font: 600 10px 'JetBrains Mono', monospace; }
.duelo { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; }
.duelo > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.duelo small, .duelo span { color: var(--texto-tenue); font-size: 9px; }
.duelo b { font-size: 12px; }
.duelo em { color: var(--texto-tenue); font: 600 10px 'JetBrains Mono', monospace; font-style: normal; }
.rival-chip { padding: 3px 7px; border: 1px solid var(--linea); border-radius: 999px; background: transparent;
  color: var(--texto-suave); font-size: 10px; cursor: pointer; }
.rival-chip b { color: #c8102e; }
.rival-chip.activo { background: #c8102e; border-color: #c8102e; color: #fff; }
.rival-chip.activo b { color: #fff0c5; }
.historial-rival { margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--linea); }
.historial-rival ul { list-style: none; margin: 6px 0 0; padding: 0; }
.historial-rival li { display: flex; align-items: center; gap: 7px; padding: 3px 0; font-size: 10px; }
.historial-rival li > span { color: var(--texto-tenue); font: 600 10px 'JetBrains Mono', monospace; min-width: 22px; }
.historial-rival li > b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.historial-rival li > b.mio { color: #c8102e; }
.historial-rival li > em { font-style: normal; font-family: 'JetBrains Mono', monospace; }
.historial-rival li > strong { min-width: 14px; text-align: center; }
.historial-rival .res-g { color: #1b7f3b; }
.historial-rival .res-e { color: #a8842c; }
.historial-rival .res-p { color: #c8102e; }
.resumen-final { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--linea); }
.resumen-final p { margin: 2px 0; font-size: 12px; color: var(--texto-suave); }

/* Simulación: modo 7A1 (partido a partido / automático) */
.modo-sim { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--linea);
  border-radius: 999px; background: var(--superficie-baja); }
.modo-sim button { display: inline-flex; align-items: center; gap: 5px; padding: 8px 14px;
  border: 0; border-radius: 999px; background: transparent; color: var(--texto-suave);
  font: 600 11px var(--texto); cursor: pointer; }
.modo-sim button.on { background: #c8102e; color: #fff; }
.modo-sim button small { font-size: 9px; opacity: .8; }
.modo-sim-ayuda { margin: 8px 0 12px; font-size: 11px; color: var(--texto-suave); }

/* Pronóstico legible */
.expectativa { text-align: left; background: var(--superficie-baja); border: 1px solid var(--linea);
  border-radius: 6px; padding: 10px 12px; margin: 10px 0; }
.expectativa .ex-kicker { display: block; color: #c8102e; font: 700 9px var(--label);
  letter-spacing: .1em; text-transform: uppercase; margin-bottom: 5px; }
.expectativa .ex-goles { margin: 0 0 6px; }
.expectativa .ex-goles strong { display: block; font-size: 14px; }
.expectativa .ex-goles small { display: block; font-size: 10px; color: var(--texto-tenue); margin-top: 2px; }
.ex-barra { display: flex; height: 7px; border-radius: 999px; overflow: hidden; background: #e2d9c6; margin: 8px 0; }
.ex-barra .g { background: #1b7f3b; }
.ex-barra .e { background: #d3a92c; }
.ex-barra .p { background: #c8102e; }
.expectativa .ex-prob { margin: 0; font-size: 11px; }
.expectativa .ex-prob .g { color: #1b7f3b; }
.expectativa .ex-prob .e { color: #a8842c; }
.expectativa .ex-prob .p { color: #c8102e; }
.expectativa .ex-nota { display: block; margin-top: 6px; font-size: 10px; color: var(--texto-tenue); }

/* Avisos de disciplina en la previa */
.previo-alerta { display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 6px 10px; margin: 8px 0; padding: 8px 10px; border-radius: 5px;
  background: var(--superficie-roja); border-left: 3px solid #c8102e; font-size: 11px; }
.previo-alerta.riesgo { background: var(--superficie-dorada); border-left-color: #d3a92c; }
.previo-alerta small { flex-basis: 100%; color: var(--texto-suave); }

/* Simular hasta una fecha */
.simular-hasta .sim-hasta-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.simular-hasta h3 { margin: 0; }
.sim-hasta-control { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
.sim-hasta-control label { font: 600 10px var(--label); text-transform: uppercase; color: var(--texto-suave); }
.sim-hasta-control input[type="range"] { flex: 1; min-width: 90px; accent-color: #c8102e; }
.sim-hasta-num { display: flex; align-items: center; gap: 8px; }
.sim-hasta-num button { width: 28px; height: 28px; border: 1px solid var(--linea); border-radius: 4px;
  background: var(--superficie); cursor: pointer; font-size: 15px; line-height: 1; }
.sim-hasta-num button:disabled { opacity: .4; cursor: not-allowed; }
.sim-hasta-num strong { min-width: 20px; text-align: center; font-size: 15px; }
.sim-hasta-resumen { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 8px 0;
  border-top: 1px solid var(--linea); border-bottom: 1px solid var(--linea); font-size: 11px; color: var(--texto-suave); }
.sim-hasta-resumen b { color: #c8102e; }
.sim-hasta-acciones { margin-top: 10px; }

/* Cambios visuales */
.cambios-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.cambios-head h3 { margin: 0; }
.cambios-head p { margin: 0; }
.cambios-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
.cambios-col h4 { margin: 0 0 6px; font: 700 9px var(--label); text-transform: uppercase; letter-spacing: .08em; color: var(--texto-suave); }
.cambio-card { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 7px; margin-bottom: 5px;
  border: 1px solid var(--linea); border-radius: 5px; background: var(--superficie); text-align: left; cursor: pointer; }
.cambio-card.on { border-color: #c8102e; background: var(--superficie-roja); box-shadow: inset 3px 0 #c8102e; }
.cambio-card.no { opacity: .55; }
.cambio-card img, .cambio-ini { width: 30px; height: 30px; flex: none; border-radius: 50%; object-fit: cover; }
.cambio-ini { display: grid; place-items: center; background: var(--superficie-media); font-weight: 800; }
.cambio-id { display: flex; flex-direction: column; min-width: 0; }
.cambio-id small { color: var(--texto-tenue); font: 600 9px 'JetBrains Mono', monospace; }
.cambio-id strong { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cambio-id em { font-size: 9px; font-style: normal; color: #1b7f3b; }
.cambio-card.no .cambio-id em { color: #c8102e; }
.cambio-ovr { margin-left: auto; color: #c8102e; font-size: 12px; }
.cambio-aviso { font-size: 11px; color: #c8102e; margin: 6px 0; }
.cambio-listo { font-size: 11px; color: #1b7f3b; margin: 6px 0; }

/* Disciplina */
.disciplina-panel ul { list-style: none; margin: 8px 0; padding: 0; }
.disciplina-panel li { display: flex; align-items: center; gap: 7px; padding: 5px 0;
  border-bottom: 1px solid var(--linea); font-size: 11px; }
.disciplina-panel li img, .disc-ini { width: 26px; height: 26px; flex: none; border-radius: 50%; object-fit: cover; }
.disc-ini { display: grid; place-items: center; background: var(--superficie-media); font-weight: 800; }
.disc-nombre { display: flex; flex-direction: column; min-width: 0; }
.disc-nombre strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.disc-nombre small { color: var(--texto-tenue); font-size: 9px; }
.disc-estado { margin-left: auto; color: #a8842c; font-size: 10px; white-space: nowrap; }
.disciplina-panel li.riesgo .disc-estado { color: #a8842c; }
.disciplina-panel li.suspendido .disc-estado { color: #c8102e; }
.disc-aviso { font-size: 10px; color: var(--texto-suave); }

@media (max-width: 720px) {
  .cambios-grid { grid-template-columns: 1fr; }
  .modo-sim { width: 100%; }
  .modo-sim button { flex: 1; justify-content: center; }
}
</style>
