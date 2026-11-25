<script setup>
import { computed, nextTick, ref } from 'vue'
import {
  obtenerRivales, obtenerJugadores, crearTorneo, obtenerTorneo,
  actualizarTorneo, agregarCalendario, jugarPartidoCalendario,
  obtenerTabla, sancionar, obtenerSanciones, desbloquearLogro,
  intercambiarJugadores, cargarEquipo
} from '../services/api.js'
import { usePrensa } from '../services/prensa.js'
import {
  simularTorneo, mediasGoles, simularTanda, relato,
  promedioOvr, sinergias, elegirGoleadores, elegirGolesConAsistencias, mvpAportes
} from '../game/formations.js'
import { sortearConGarantia, armarGrupos, mezclar } from '../game/sorteo_rivales.js'
import { fixtureIda, crucesMundial, onceRival, simularPartidoLiga, probabilidades } from '../game/ligas.js'
import { registrarTitulo, resumenPalmares } from '../game/palmares.js'
import { logrosDeTorneo } from '../game/logros.js'
import { sonidoGol, sonidoCampeon, sonidoError, sonidoSilbato } from '../game/sound.js'
import { escudoDe } from '../game/fotos.js'
import { suspensionPorAmarilla } from '../game/sanciones.js'
import { leerUsosRivales, registrarRivales } from '../game/variedad.js'
import { golesParaCalendario } from '../game/resultado_calendario.js'
import { enLotes } from '../game/concurrencia.js'
import CanchaXI from './CanchaXI.vue'
import XvRivalModal from './XvRivalModal.vue'
import RelatoEnVivo from './RelatoEnVivo.vue'
import EstadoSimulacion from './EstadoSimulacion.vue'

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
  todas: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['fin', 'equipo'])
const { para: prensaPara, texto: textoPrensa, tribuna: textoTribuna } = usePrensa()

const once = computed(() => props.equipo.filter((j) => !String(j.slot).startsWith('SUP')))
// Misma forma { slot, pos, jugador } que devuelve onceRival(): así la cancha
// del usuario y la de los rivales salen idénticas.
const onceMio = computed(() => once.value.map((j) => ({
  slot: j.slot,
  pos: props.formaciones[props.formacion]?.[j.slot] ?? j.posicion_natural,
  jugador: j
})))
const ovrMio = computed(() => {
  if (!once.value.length) return 84
  return promedioOvr(once.value) + sinergias(once.value).bonus
})

const torneoId = ref(null)
const equipos = ref([])
const calendario = ref([])
const fecha = ref(0)
const jugando = ref(false)
const preparando = ref(false)
const lineas = ref([])
const sorteoAnim = ref([])
// El sorteo se arma y se muestra, pero no se guarda hasta que el usuario
// aprieta "Continuar": así tiene tiempo de ver los 8 grupos.
const sorteoPendiente = ref(null)
const finalizado = ref(false)
const campeon = ref(false)
const valla = ref(false)
const figuras = ref({})
const sanciones = ref([])
const goleadoresAcum = ref([])
const aviso = ref('')
const error = ref('')
// Igual que en 7A1: partido a partido o automático (un toque por fecha).
const modoSim = ref('auto')
const alineacionPreviaAbierta = ref(false)
const alineacionJugadoAbierta = ref(false)
const LOGROS_LABEL = {
  primer_campeon: 'Primer campeón',
  siete_cero: '7A0 perfecto',
  campeon_debil: 'Campeón con equipo humilde',
  campeon_almanaque: 'Campeón a ciegas',
  goleada: 'Goleada (4+)',
  valla_grupo: 'Grupos sin goles',
  asistencia: 'Primer pase gol',
  hat_trick: 'Hat-trick',
  diez_goles: '10 goles en un torneo',
  campeon_invicto: 'Campeón invicto',
  veterano: 'Veterano (5 torneos)',
  cinco_goles_un_jugador: '5 goles de un jugador',
  cinco_asistencias: '5 pases gol',
  torneo_perfecto: 'Torneo perfecto',
  valla_total: 'Valla total'
}
const logrosNuevos = ref([])

const eqMapa = computed(() => {
  const mapa = new Map()
  for (const e of equipos.value) mapa.set(e.id, e)
  return mapa
})
const eqPorId = (id) => eqMapa.value.get(id)
const ovrDeTe = (teId) => {
  const e = eqPorId(teId)
  if (!e) return 84
  return e.es_usuario ? Math.round(ovrMio.value * 10) / 10 : (e.ovr_equipo ?? 84)
}
const ladoMio = (c) => eqPorId(c.local_id)?.es_usuario ? 'local' : 'visita'
const rivalDe = (c) => eqPorId(ladoMio(c) === 'local' ? c.visita_id : c.local_id)
const esMio = (c) => !!eqPorId(c.local_id)?.es_usuario || !!eqPorId(c.visita_id)?.es_usuario
const misGoles = (c) => ladoMio(c) === 'local' ? c.gf : c.gc
const susGoles = (c) => ladoMio(c) === 'local' ? c.gc : c.gf
const ganeYo = (c) => c.jugado && esMio(c) && misGoles(c) > susGoles(c)
const grupoMio = computed(() => equipos.value.find((e) => e.es_usuario)?.zona ?? null)
const rondaNombre = (n) => n <= 3
  ? `Grupo ${grupoMio.value ?? ''} · Fecha ${n}`
  : ['Octavos de final', 'Cuartos de final', 'Semifinal', 'Final · Madrid'][n - 4]
const partidoMio = computed(() => calendario.value.find((c) => !c.jugado && c.fecha_n === fecha.value && esMio(c)))
const miPartidoJugado = computed(() => calendario.value.find((c) => c.jugado && c.fecha_n === fecha.value && esMio(c)))
const tablaGrupo = ref([])

// UI: una sola alineación de grupo desplegada a la vez. Los planteles se
// cachean por temporada; el usuario (sin temporada_id) nunca dispara la API.
const alineacionGrupoAbierta = ref(null)
const plantelesGrupo = ref({})
const cargandoAlineacion = ref(null)

function esEquipoUsuario(fila) {
  return !!fila?.es_usuario || fila?.temporada_id === null || fila?.temporada_id === undefined
}

function mapaEquipoGrupo(formacion) {
  // onceRival espera slot → código de posición (formaciones.php), no coordenadas.
  return props.todas[formacion] ?? props.formaciones[formacion] ?? {}
}


function onceEquipoGrupo(fila) {
  if (esEquipoUsuario(fila) || fila.temporada_id == null) return onceMio.value
  const plantel = plantelesGrupo.value[fila.temporada_id] ?? []
  return onceRival(plantel, mapaEquipoGrupo(fila.formacion))
}

async function alternarAlineacionGrupo(fila) {
  const key = fila.equipo_id
  if (alineacionGrupoAbierta.value === key) {
    alineacionGrupoAbierta.value = null
    return
  }
  alineacionGrupoAbierta.value = key
  if (esEquipoUsuario(fila) || fila.temporada_id == null) return
  if (plantelesGrupo.value[fila.temporada_id]) return
  cargandoAlineacion.value = key
  try {
    plantelesGrupo.value[fila.temporada_id] = await obtenerJugadores(fila.temporada_id)
  } catch {
    plantelesGrupo.value[fila.temporada_id] = []
  } finally {
    cargandoAlineacion.value = null
  }
}

// Misma expectativa que en Ligas: goles esperados y 1X2 del motor, visible
// antes de jugar cada partido de Copa.
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

const partidoTerminado = computed(() => {
  const c = miPartidoJugado.value
  if (!c || jugando.value || finalizado.value || partidoMio.value) return null
  const r = rivalDe(c)
  return {
    calendario_id: c.id,
    escudo: escudoDe(r),
    rival: r?.etiqueta ?? 'Rival',
    gf: misGoles(c),
    gc: susGoles(c)
  }
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

async function preparar() {
  // Mientras se anima o queda un sorteo esperando el "Continuar", torneoId
  // sigue en null: sin este guard se podían mezclar dos sorteos.
  if (preparando.value || torneoId.value || sorteoPendiente.value) return
  preparando.value = true
  error.value = ''
  aviso.value = ''
  sorteoPendiente.value = null
  try {
    const rivales = await obtenerRivales()
    if (rivales.length < 31) throw new Error('Faltan rivales en la base (se necesitan 31)')
    const userEntry = {
      temporada_id: null, etiqueta: props.nombreEquipo,
      ovr_equipo: Math.round(ovrMio.value), formacion: props.formacion
    }
    const usos = leerUsosRivales()
    const sorteados = sortearConGarantia(rivales, 31, (r) => String(r.etiqueta).startsWith('Boca'), { usos, maxPorClub: 3 })
    const grupos = armarGrupos(mezclar([userEntry, ...sorteados]))
    const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    sorteoAnim.value = []
    for (let g = 0; g < 8; g++) {
      await sleep(420)
      sorteoAnim.value.push({ letra: letras[g], equipos: grupos[g] })
    }
    const cal = []
    grupos.forEach((grupo) => {
      fixtureIda(grupo).forEach((fechaJ, j) => {
        for (const p of fechaJ) {
          const lado = (e) => e.temporada_id === null || e.temporada_id === undefined
            ? { marca: 'usuario' } : { temp: e.temporada_id }
          const L = lado(p.local)
          const V = lado(p.visita)
          cal.push({
            fecha_n: j + 1, fase: 'grupo',
            ...(L.marca ? { local: 'usuario' } : { local_temp: L.temp }),
            ...(V.marca ? { visita: 'usuario' } : { visita_temp: V.temp })
          })
        }
      })
    })
    const participantes = grupos.flatMap((grupo, g) => grupo.map((e) => ({
      temporada_id: e.temporada_id ?? null,
      zona: letras[g],
      es_usuario: e.temporada_id === null || e.temporada_id === undefined
    })))
    // Queda a la espera del botón: recién ahí se crea el torneo.
    sorteoPendiente.value = { cal, participantes, sorteados }
  } catch (e) {
    error.value = e.message
  } finally {
    preparando.value = false
  }
}

async function confirmarSorteo() {
  const pendiente = sorteoPendiente.value
  if (!pendiente || preparando.value || torneoId.value) return
  preparando.value = true
  error.value = ''
  try {
    const res = await crearTorneo(props.partidaId, 'copa', pendiente.participantes, pendiente.cal)
    torneoId.value = res.id
    if (res.ya_existia) aviso.value = 'Ya había un Mundial guardado: continuás donde lo dejaste.'
    else registrarRivales(pendiente.sorteados)
    await actualizarTorneo(res.id, { fecha_actual: 1, estado: 'curso' })
    await recargar()
    sorteoPendiente.value = null
  } catch (e) {
    error.value = e.message
  } finally {
    preparando.value = false
  }
}

async function recargar() {
  if (!torneoId.value) return
  const t = await obtenerTorneo({ torneoId: torneoId.value })
  equipos.value = t.equipos
  calendario.value = t.calendario
  fecha.value = Number(t.fecha_actual) || 1
  sanciones.value = await obtenerSanciones(torneoId.value).catch(() => [])
  if (grupoMio.value) {
    tablaGrupo.value = await obtenerTabla(torneoId.value, grupoMio.value).catch(() => [])
  }
  goleadoresAcum.value = []
  for (const c of t.calendario) {
    if (c.jugado && esMio(c) && c.detalle?.goleadores) {
      goleadoresAcum.value.push(...c.detalle.goleadores)
    }
  }
  const jugadoMio = t.calendario.find((c) => c.jugado && c.fecha_n === fecha.value && esMio(c))
  if (jugadoMio) await verFigurasRival(jugadoMio)
  if (t.estado === 'finalizado') {
    finalizado.value = true
    const mios = t.calendario.filter((c) => c.jugado && esMio(c))
    // El campeón se decide por el resultado de la final (incluida la tanda),
    // nunca por el simple hecho de haber llegado a la fecha 7.
    const final = t.calendario.find((c) => /final/i.test(c.fase) && c.jugado && esMio(c))
    campeon.value = !!final && (final.detalle?.avanzo_usuario ?? ganeYo(final))
    valla.value = campeon.value && mios.length >= 7 && mios.every((c) => susGoles(c) === 0)
    // Torneos cerrados antes del fix podían guardar campeón = 1 aunque se
    // perdiera la final: se corrige al cargar para no repetir el error.
    if (t.campeon !== null && t.campeon !== undefined &&
        Number(t.campeon) !== Number(campeon.value)) {
      await actualizarTorneo(torneoId.value, {
        campeon: campeon.value, valla: valla.value
      }).catch(() => {})
    }
  }
}

async function restaurar(id) {
  torneoId.value = id
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
  return sanciones.value.filter((s) => s.suspendido_hasta_fecha >= fecha.value)
    .map((s) => s.temporada_jugador_id)
}

// Arma el partido del usuario con el detalle completo. Lo usan tanto
// "Jugar partido" como "Simular resto": así la simulación también guarda
// goleadores, asistencias, tarjetas y el ganador de la tanda.
async function prepararPartidoMio(c) {
  await cubrirSuspendidos()
  await verFigurasRival(c)
  const rival = rivalDe(c)
  const t = simularTorneo(once.value, [{
    etiqueta: rival?.etiqueta ?? '?',
    ovr_equipo: rival?.ovr_equipo ?? 84,
    formacion: rival?.formacion ?? ''
  }], props.estilo, props.capitan, Math.min(fecha.value - 1, 6), props.anchura)
  const p = { ...t.partidos[0], ronda: rondaNombre(fecha.value), rival: rival?.etiqueta ?? '?' }
  p.calendario_id = c.id // misma clave que la previa: árbitro y cronista coinciden
  // En grupos no se elimina por puntos: la tabla completa de los 8 grupos
  // decide en cerrarGrupos(). Acá solo se registra el resultado.
  if (fecha.value <= 3) p.avanzo = true
  p.goleadores = elegirGolesConAsistencias(once.value, p.favor, props.capitan?.temporada_jugador_id)
  const xiRival = onceRivalDe(c).map((o) => o.jugador).filter(Boolean)
  p.goleadoresRival = elegirGoleadores(xiRival, p.contra)
  const detalle = {
    goleadores: p.goleadores, tanda: p.tanda, avanzo_usuario: p.avanzo,
    goleadoresRival: p.goleadoresRival,
    ...(p.tanda
      ? {
          ganador: ladoMio(c) === 'local'
            ? (p.tanda.ganador ? c.local_id : c.visita_id)
            : (p.tanda.ganador ? c.visita_id : c.local_id)
        }
      : {})
  }
  return { p, detalle }
}

async function jugarMio() {
  const c = partidoMio.value
  if (jugando.value || !c || finalizado.value) return
  jugando.value = true
  error.value = ''
  try {
    const { p, detalle } = await prepararPartidoMio(c)
    lineas.value = []
    sonidoSilbato()
    const soloMios = new Set((p.goleadores ?? []).map((g) => g.jugador))
    for (const l of relato(p, props.nombreEquipo, prensaPara(p))) {
      lineas.value.push(l)
      if (l.includes('¡GOL') && soloMios.size && [...soloMios].some((n) => l.includes(n))) sonidoGol()
      await sleep(120)
    }
    if (p.tanda) await sleep(160)
    const { gf, gc } = golesParaCalendario(ladoMio(c), p.favor, p.contra)
    await jugarPartidoCalendario(c.id, gf, gc, detalle)
    await sortearTarjetas()
    await recargar()
    if (!p.avanzo) return terminar(false)
    if (fecha.value === 7) return terminar(true)
    sonidoCampeon()
  } catch (e) {
    error.value = e.message
  } finally {
    jugando.value = false
  }
}

async function simularResto() {
  if (jugando.value || finalizado.value) return
  jugando.value = true
  error.value = ''
  try {
    const resto = calendario.value.filter((c) => !c.jugado && c.fecha_n === fecha.value)
    const simulacionDe = async (c) => {
      if (esMio(c)) {
        const { p, detalle } = await prepararPartidoMio(c)
        // Al jugar dentro de un lote, el relato también tiene que verse.
        lineas.value = relato(p, props.nombreEquipo, prensaPara(p))
        const { gf, gc } = golesParaCalendario(ladoMio(c), p.favor, p.contra)
        return jugarPartidoCalendario(c.id, gf, gc, detalle)
      }
      const { favor, contra } = simularPartidoLiga(ovrDeTe(c.local_id), ovrDeTe(c.visita_id))
      let ganador = favor === contra ? null : favor > contra ? c.local_id : c.visita_id
      let tanda = null
      if (favor === contra && c.fase !== 'grupo') {
        tanda = simularTanda(ovrDeTe(c.local_id), ovrDeTe(c.visita_id))
        ganador = tanda.ganador ? c.local_id : c.visita_id
      }
      // El empate se conserva en el marcador; la tanda se guarda aparte.
      return jugarPartidoCalendario(c.id, favor, contra, tanda ? { tanda, ganador } : null)
    }
    await enLotes(resto, 5, simulacionDe)
    await sortearTarjetas()
    await recargar()
    if (fecha.value === 3) {
      const ok = await cerrarGrupos()
      if (!ok) return terminar(false)
    } else if (fecha.value >= 4 && fecha.value < 7) {
      await armarSiguienteRonda()
    }
    const sig = fecha.value + 1
    if (sig > 7) {
      // Llegar a la fecha 7 no significa ser campeón: hay que ganar la final.
      const finalMio = calendario.value.find((c) => c.fecha_n === 7 &&
        /final/i.test(c.fase) && c.jugado && esMio(c))
      const ganeFinal = !!finalMio && (finalMio.detalle?.avanzo_usuario ?? ganeYo(finalMio))
      return terminar(ganeFinal)
    }
    fecha.value = sig
    await actualizarTorneo(torneoId.value, { fecha_actual: sig })
    await recargar()
  } catch (e) {
    error.value = e.message
  } finally {
    jugando.value = false
  }
}

async function cerrarGrupos() {
  const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  const grupos = {}
  for (const z of letras) {
    const tabla = await obtenerTabla(torneoId.value, z)
    grupos[z] = [tabla[0]?.equipo_id, tabla[1]?.equipo_id]
  }
  const yo = equipos.value.find((e) => e.es_usuario)
  if (!yo || !grupos[grupoMio.value]?.includes(yo.id)) return false
  const pares = crucesMundial(Object.fromEntries(
    letras.map((z) => [z, grupos[z].map((te) => ({ te }))])))
  await agregarCalendario(torneoId.value, pares.map(([a, b]) => ({
    fecha_n: 4, fase: 'octavos', local_eq: a.te, visita_eq: b.te
  })))
  await recargar()
  return true
}

async function armarSiguienteRonda() {
  const jug = calendario.value.filter((c) => c.jugado && c.fecha_n === fecha.value)
  const ganadores = jug.map((c) => {
    if (c.gf !== c.gc) return c.gf > c.gc ? c.local_id : c.visita_id
    return c.detalle?.ganador ?? (Math.random() < 0.5 ? c.local_id : c.visita_id)
  })
  const fases = ['cuartos', 'semi', 'final']
  const faseSig = fases[fecha.value - 4] ?? 'final'
  const pares = []
  for (let i = 0; i < ganadores.length; i += 2) {
    if (ganadores[i + 1] !== undefined) pares.push([ganadores[i], ganadores[i + 1]])
  }
  if (!pares.length) return
  await agregarCalendario(torneoId.value, pares.map(([a, b]) => ({
    fecha_n: fecha.value + 1, fase: faseSig, local_eq: a, visita_eq: b
  })))
  await recargar()
}

async function terminar(esCampeon) {
  finalizado.value = true
  // Doble chequeo: aunque el llamador venga de "simular resto", solo es
  // campeón quien ganó su final (o la tanda), no quien llegó a la fecha 7.
  const finalMio = calendario.value.find((c) => c.fecha_n === 7 &&
    /final/i.test(c.fase) && c.jugado && esMio(c))
  const campeonReal = !!esCampeon && !!finalMio &&
    (finalMio.detalle?.avanzo_usuario ?? ganeYo(finalMio))
  campeon.value = campeonReal
  const mios = calendario.value.filter((c) => c.jugado && esMio(c))
  valla.value = campeonReal && mios.every((c) => susGoles(c) === 0)
  await actualizarTorneo(torneoId.value, {
    estado: 'finalizado', campeon: campeonReal, valla: valla.value
  }).catch(() => {})
  registrarTitulo({
    formato: 'copa', campeon: campeonReal, valla: valla.value,
    mvp: mvpAportes(goleadoresAcum.value)?.jugador ?? null
  })

  const cods = []
  if (campeonReal) {
    cods.push('primer_campeon')
    if (valla.value) cods.push('siete_cero')
    if (promedioOvr(props.equipo) < 82) cods.push('campeon_debil')
    if (props.almanaque) cods.push('campeon_almanaque')
  }
  if (mios.some((c) => misGoles(c) - susGoles(c) >= 4)) cods.push('goleada')
  const grupos = mios.filter((c) => c.fase === 'grupo')
  if (grupos.length >= 3 && grupos.every((c) => susGoles(c) === 0)) cods.push('valla_grupo')
  cods.push(...logrosDeTorneo({
    campeon: campeonReal,
    partidos: mios.map((c) => ({ gf: misGoles(c), gc: susGoles(c), detalle: c.detalle }))
  }))
  if (resumenPalmares().total >= 5) cods.push('veterano')

  if (campeonReal) sonidoCampeon()
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
  emit('fin', { campeon: campeonReal, valla: valla.value, amistoso: false })
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

const goleador = computed(() => {
  if (!goleadoresAcum.value.length) return null
  const cuenta = {}
  for (const g of goleadoresAcum.value) cuenta[g.jugador] = (cuenta[g.jugador] ?? 0) + 1
  const [jugador, goles] = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0]
  return { jugador, goles }
})

defineExpose({ preparar, restaurar })
</script>

<template>
  <div class="mundial">
    <div v-if="!torneoId" class="panel sorteo">
      <h2>Mundial</h2>
      <p class="muted">31 rivales de los 79 por bombos, 8 grupos × 4, top 2 a octavos cruzados. Final en Madrid.</p>
      <button class="btn primary big" :disabled="preparando || !!sorteoPendiente" @click="preparar">
        {{ preparando ? 'Sorteando…' : sorteoPendiente ? 'Sorteo listo' : 'Sortear grupos' }}
      </button>
      <p v-if="error" class="error-line">{{ error }}</p>
      <div v-if="sorteoAnim.length" class="grupos">
        <div v-for="g in sorteoAnim" :key="g.letra" class="grupo">
          <strong>Grupo {{ g.letra }}</strong>
          <span v-for="e in g.equipos" :key="e.temporada_id ?? 'yo'" class="grupo-eq">
            <img v-if="escudoDe(e)" :src="escudoDe(e)" alt="" class="escudo-grupo" loading="lazy" @error="(ev) => ev.target.remove()" />
            <span>{{ e.temporada_id == null ? nombreEquipo : e.etiqueta }}</span>
          </span>
        </div>
      </div>
      <div v-if="sorteoPendiente" class="confirmar-sorteo">
        <p class="muted small">Revisá los grupos con calma. Recién guardamos el torneo cuando aprietes continuar.</p>
        <button class="btn primary big" type="button" :disabled="preparando" @click="confirmarSorteo">
          {{ preparando ? 'Guardando torneo…' : 'Ya vi los grupos · continuar' }}
        </button>
      </div>
    </div>

    <div v-else class="torneo-vivo">
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
          ? 'Se juega tu partido y el resto de la fecha con un solo toque.'
          : 'Primero jugás tu partido y después decidís cuándo simular el resto.' }}
      </p>
      <EstadoSimulacion :jugando="jugando"
                        :titulo="`Simulando fecha ${fecha} · ${rondaNombre(fecha)}`"
                        detalle="Se juegan tu partido y los del resto. El relato se actualiza acá." />
      <div v-if="partidoMio && !finalizado" class="panel previa">
        <h3>{{ rondaNombre(fecha) }} · previa</h3>
        <img v-if="escudoDe(rivalDe(partidoMio))" :src="escudoDe(rivalDe(partidoMio))" alt="escudo rival" class="escudo" loading="lazy" @error="(e) => e.target.remove()" />
        <p class="vs"><strong>{{ rivalDe(partidoMio)?.etiqueta ?? '?' }}</strong></p>
        <p class="muted small">{{ rivalDe(partidoMio)?.formacion ?? '' }} · OVR {{ almanaque ? '¿?' : (rivalDe(partidoMio)?.ovr_equipo ?? '?') }}</p>
        <p v-if="textoPrensa(partidoMio)" class="prensa-line">{{ textoPrensa(partidoMio) }}</p>
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
        <button class="btn ghost small-btn alineacion-toggle" type="button"
                :aria-expanded="alineacionPreviaAbierta" @click="alineacionPreviaAbierta = !alineacionPreviaAbierta">
          {{ alineacionPreviaAbierta ? 'Ocultar XV' : 'Ver XV del rival' }}
        </button>
        <XvRivalModal v-if="alineacionPreviaAbierta && rivalDe(partidoMio)"
                      :temporada="rivalDe(partidoMio)" :almanaque="almanaque"
                      @cerrar="alineacionPreviaAbierta = false" />
        <p v-if="aviso" class="muted small">{{ aviso }}</p>
        <button v-if="modoSim === 'manual'" class="btn primary big" :disabled="jugando" @click="jugarMio">
          {{ jugando ? 'Jugando…' : 'Jugar partido' }}
        </button>
        <button v-else class="btn primary big" :disabled="jugando" @click="simularResto">
          {{ jugando ? 'Simulando…' : 'Simular fecha y avanzar' }}
        </button>
      </div>

      <div v-if="!partidoMio && !finalizado" class="panel" :class="{ 'partido-terminado': partidoTerminado }">
        <template v-if="partidoTerminado">
          <p class="terminado-kicker">Partido terminado</p>
          <h3>{{ rondaNombre(fecha) }} · resultado final</h3>
          <div class="terminado-marcador">
            <img v-if="partidoTerminado.escudo" :src="partidoTerminado.escudo" alt="escudo rival" class="escudo" loading="lazy" @error="(e) => e.target.remove()" />
            <strong>{{ nombreEquipo }} {{ partidoTerminado.gf }}–{{ partidoTerminado.gc }} {{ partidoTerminado.rival }}</strong>
          </div>
          <p v-if="textoPrensa(partidoTerminado)" class="prensa-line">{{ textoPrensa(partidoTerminado) }}</p>
          <p v-if="textoTribuna(partidoTerminado)" class="prensa-line">{{ textoTribuna(partidoTerminado) }}</p>
        </template>
        <h3 v-else-if="miPartidoJugado">{{ rondaNombre(fecha) }} · jugado</h3>
        <div v-if="miPartidoJugado" class="mini-previa">
          <img v-if="!partidoTerminado && escudoDe(rivalDe(miPartidoJugado))" :src="escudoDe(rivalDe(miPartidoJugado))" class="escudo" alt="escudo rival" loading="lazy" @error="(e) => e.target.remove()" />
          <p v-if="!partidoTerminado" class="vs"><strong>{{ rivalDe(miPartidoJugado)?.etiqueta ?? '?' }}</strong>
            · {{ misGoles(miPartidoJugado) }} – {{ susGoles(miPartidoJugado) }}</p>
          <p v-if="!partidoTerminado && textoPrensa(miPartidoJugado)" class="prensa-line">{{ textoPrensa(miPartidoJugado) }}</p>
          <p v-if="!partidoTerminado && textoTribuna(miPartidoJugado)" class="prensa-line">{{ textoTribuna(miPartidoJugado) }}</p>
          <button class="btn ghost small-btn alineacion-toggle" type="button"
                  :aria-expanded="alineacionJugadoAbierta" @click="alineacionJugadoAbierta = !alineacionJugadoAbierta">
            {{ alineacionJugadoAbierta ? 'Ocultar XV' : 'Ver XV del rival' }}
          </button>
          <XvRivalModal v-if="alineacionJugadoAbierta && rivalDe(miPartidoJugado)"
                        :temporada="rivalDe(miPartidoJugado)" :almanaque="almanaque"
                        @cerrar="alineacionJugadoAbierta = false" />
        </div>
        <p v-else>Tu partido de la fecha {{ fecha }} ya se jugó. Falta simular el resto de la fecha.</p>
        <p v-if="aviso" class="muted small">{{ aviso }}</p>
        <button class="btn primary big" :disabled="jugando" @click="simularResto">
          {{ jugando ? 'Simulando…' : 'Simular fecha y avanzar' }}
        </button>
        <p v-if="partidoTerminado" class="muted small">Simulá el resto de la fecha para avanzar.</p>
      </div>

      <div v-if="tablaGrupo.length && (fecha <= 3 || finalizado)" class="panel grupo-tabla">
        <h3>Grupo {{ grupoMio }}{{ finalizado ? ' · final' : '' }}</h3>
        <div class="grupo-filas">
          <div v-for="r in tablaGrupo" :key="r.equipo_id" class="grupo-fila"
               :class="{ mio: r.equipo_id === equipos.find((e) => e.es_usuario)?.id }">
            <div class="grupo-fila-principal">
              <span class="grupo-pos">{{ r.pos }}</span>
              <img v-if="escudoDe(r)" :src="escudoDe(r)" alt="" class="escudo-grupo" loading="lazy" @error="(e) => e.target.remove()" />
              <span class="grupo-nombre">{{ r.equipo_id === equipos.find((e) => e.es_usuario)?.id ? nombreEquipo : r.etiqueta }}</span>
              <span class="grupo-stats">PJ {{ r.pj }} · {{ r.pts }} pts ({{ r.pg }}-{{ r.pe }}-{{ r.pp }}) · DIF {{ r.dif > 0 ? '+' : '' }}{{ r.dif }}</span>
              <button class="btn ghost small-btn" :aria-expanded="alineacionGrupoAbierta === r.equipo_id"
                      @click="alternarAlineacionGrupo(r)">
                {{ alineacionGrupoAbierta === r.equipo_id ? 'Ocultar alineación' : 'Ver alineación' }}
              </button>
            </div>
            <div v-if="alineacionGrupoAbierta === r.equipo_id" class="grupo-xi">
              <p v-if="r.temporada_id == null" class="muted small">Tu equipo no tiene temporada_id: tu alineación se edita en la pantalla principal.</p>
              <template v-else>
                <p v-if="cargandoAlineacion === r.equipo_id" class="muted small">Cargando alineación…</p>
                <template v-else>
                  <CanchaXI :titulo="r.equipo_id === equipos.find((e) => e.es_usuario)?.id ? nombreEquipo : r.etiqueta"
                            :escudo="escudoDe(r)"
                            :formacion="r.formacion ?? eqPorId(r.equipo_id)?.formacion ?? props.formacion"
                            :once="onceEquipoGrupo(r)" :almanaque="almanaque" compacto />
                </template>
              </template>
            </div>
          </div>
        </div>
      </div>

      <RelatoEnVivo :lineas="lineas" :jugando="jugando"
                    :titulo="`Minuto a minuto · ${rondaNombre(fecha)}`" />

      <div v-if="finalizado" class="panel cierre">
        <p class="terminado-kicker">Torneo finalizado</p>
        <h2>{{ campeon ? '🏆 CAMPEÓN DEL MUNDO · MADRID' : 'Eliminado' }}
          <span v-if="campeon && valla" class="badge goldbg">7A0</span>
        </h2>
        <p class="muted small">Siguiente paso: revisá tu palmarés desde la pantalla principal o empezá otra partida.</p>
        <p v-if="aviso" class="muted small">{{ aviso }}</p>
        <p v-if="goleador" class="muted">Balón del Mundial: <strong>{{ goleador.jugador }}</strong> ({{ goleador.goles }})</p>
        <div v-if="logrosNuevos.length" class="row">
          <span v-for="c in logrosNuevos" :key="c" class="badge goldbg">{{ LOGROS_LABEL[c] ?? c }}</span>
        </div>
      </div>
      <p v-if="error" class="error-line">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.sorteo { text-align: center; }
.grupos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; text-align: left; }
.grupo { background: var(--superficie-baja); border: 1px solid var(--linea); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; font-size: 13px; animation: entrar .3s ease-out; }
.grupo strong { color: #c8102e; font-size: 12px; }
.confirmar-sorteo { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--linea); }
.confirmar-sorteo p { margin: 0 0 10px; }
@keyframes entrar { from { transform: scale(.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.previa { text-align: center; }
.escudo { width: 56px; height: 56px; object-fit: contain; }
.vs { font-size: 17px; }
.prensa-line { font: 500 11px/1.4 'JetBrains Mono', monospace; color: var(--texto-suave); margin: 6px 0 8px; }
/* Simulación con dos velocidades, como en 7A1. */
.modo-sim { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--linea);
  border-radius: 999px; background: var(--superficie-baja); }
.modo-sim button { display: inline-flex; align-items: center; gap: 5px; padding: 8px 14px;
  border: 0; border-radius: 999px; background: transparent; color: var(--texto-suave);
  font: 600 11px var(--texto); cursor: pointer; }
.modo-sim button.on { background: #c8102e; color: #fff; }
.modo-sim button small { font-size: 9px; opacity: .8; }
.modo-sim-ayuda { margin: 8px 0 12px; font-size: 11px; color: var(--texto-suave); }
.alineacion-toggle { margin: 2px 0 4px; }

/* Pronóstico en texto claro, con barra de probabilidades. */
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
.error-line { color: #c8102e; font-size: 13px; }
.terminado-kicker { margin: 0 0 4px; font: 700 11px 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #1b7f3b; }
.partido-terminado { border-left: 4px solid #1b7f3b; text-align: left; }
.terminado-marcador { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;
  background: var(--negro); color: #fff; border-radius: 8px; padding: 8px 12px; margin: 8px 0; }
.terminado-marcador .escudo { width: 34px; height: 34px; }
.terminado-marcador strong { font: 600 16px 'Oswald', sans-serif; }
.escudo-grupo { width: 20px; height: 20px; object-fit: contain; flex: 0 0 auto; }
.grupo-eq { display: inline-flex; align-items: center; gap: 5px; }
.grupo-filas { display: flex; flex-direction: column; gap: 6px; }
.grupo-fila { border: 1px solid var(--linea); border-radius: 8px; background: var(--superficie-baja); padding: 7px 9px; }
.grupo-fila.mio { border-color: #c8102e; background: var(--superficie-roja); }
.grupo-fila-principal { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.grupo-pos { font: 700 12px 'JetBrains Mono', monospace; color: var(--texto-tenue); min-width: 16px; }
.grupo-nombre { font-weight: 700; font-size: 13px; flex: 1 1 90px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.grupo-stats { font: 600 11px 'JetBrains Mono', monospace; color: var(--texto-suave); }
.grupo-xi { margin-top: 8px; }
@media (max-width: 720px) {
  .grupos { grid-template-columns: repeat(2, 1fr); }
  .modo-sim { width: 100%; }
  .modo-sim button { flex: 1; justify-content: center; }
}
</style>
