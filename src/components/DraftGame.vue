<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  obtenerSorteo,
  obtenerJugadores,
  obtenerTemporadas,
  obtenerFormaciones,
  obtenerPartida,
  obtenerHistorial,
  obtenerResultados,
  obtenerTorneo,
  crearPartida,
  guardarJugador,
  quitarJugador,
  intercambiarJugadores,
  cargarEquipo,
  setearDorsal,
  asignarDorsales,
  desbloquearLogro,
  guardarEnRanking
} from '../services/api.js'
import { usuario } from '../services/auth.js'
import { promedioOvr } from '../game/formations.js'
import { PITCH_COORDS, ATAQUE_POS, DEFENSA_POS, promedioLinea, coordConTactica } from '../game/pitch.js'
import { setSonido, sonidoConfirmar, sonidoError } from '../game/sound.js'
import TorneoSection from './TorneoSection.vue'
import MundialSection from './MundialSection.vue'
import LigaSection from './LigaSection.vue'
import LogrosPanel from './LogrosPanel.vue'
import RivalesPanel from './RivalesPanel.vue'
import ResumenPartida from './ResumenPartida.vue'
import { fotoDe, esFotoEpoca, anioFotoDe, fallbackInicial, escudoMio, escudoMioUrl, elegirEscudoMio, escudoEpocaDe } from '../game/fotos.js'
import { modoDePartida } from '../game/partida.js'

const PASES_POR_FORMATO = { copa: 3, premier: 5, liga30: 5 }
const BANCO_POR_FORMATO = { copa: 5, premier: 8, liga30: 8 }

const DADOS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
const NOMBRE_FIJO = 'River Plate'
const ANCHOS = [
  { valor: 'estrecho', etiqueta: 'Estrecho', tip: 'Líneas juntas: cerrás espacios y concedés menos goles.' },
  { valor: 'equilibrado', etiqueta: 'Equilibrado', tip: 'Distancias parejas entre líneas. Punto de partida neutro.' },
  { valor: 'amplio', etiqueta: 'Amplio', tip: 'Abrís el juego: generás más ocasiones, pero dejás más huecos.' }
]
const TIP_ESTILO = {
  ofensivo: 'Adelantás el bloque: más goles a favor y más riesgo atrás.',
  equilibrado: 'Mantenés las distancias. Arrancás parejo.',
  defensivo: 'Replegás el equipo: concedés menos y generás menos.'
}
const TIP_FORMATO = {
  copa: '32 equipos, grupos y cuadro eliminatorio. Siete fechas.',
  premier: '20 equipos, ida y vuelta. Treinta y ocho fechas.',
  liga30: '30 equipos, zonas, interzonal y playoffs.'
}
function tipFormacion(nombre) {
  const Lineas = ['en defensa', 'en el medio', 'de enganche', 'arriba']
  const partes = String(nombre).split('-').map(Number)
  if (partes.length < 3 || partes.some((n) => !Number.isFinite(n))) return 'Reparto de jugadores por línea.'
  return partes.map((n, i) => `${n} ${Lineas[i] ?? 'arriba'}`).join(' · ')
}
const emit = defineEmits(['estado', 'ir-rivales', 'ir-historial'])
// El banco es solo de jugadores de campo: el arco se cubre con el XI.
const LINEAS = {
  Defensa: ['LD', 'DFC', 'LI'],
  Medio: ['MD', 'MI', 'MC', 'MCD', 'MCO'],
  Ataque: ['ED', 'EI', 'DC']
}
const LINEA_ORDEN = { ARQ: 0, LD: 1, DFC: 1, LI: 1, MD: 2, MC: 2, MCD: 2, MCO: 2, MI: 2, ED: 3, EI: 3, DC: 3 }
const LINEA_NOMBRE = { 0: 'Arco', 1: 'Defensa', 2: 'Medio', 3: 'Ataque' }
// Nombre visible del puesto para los huecos de la cancha (el código sigue
// siendo la fuente de verdad; esto es solo la etiqueta editorial).
const POS_NOMBRE = {
  ARQ: 'Arquero', LD: 'Lateral', LI: 'Lateral', DFC: 'Central',
  MD: 'Volante', MI: 'Volante', MC: 'Volante', MCD: 'Pivote', MCO: 'Enganche',
  ED: 'Extremo', EI: 'Extremo', DC: 'Delantero'
}
const buscarMazo = ref('')
const filtroPos = ref('')
const plantelFiltrado = computed(() => {
  const q = buscarMazo.value.trim().toLocaleLowerCase('es')
  const pos = filtroPos.value
  return plantel.value.filter((j) => {
    if (pos && j.posicion_natural !== pos && !secundarias(j).includes(pos)) return false
    return !q || j.nombre.toLocaleLowerCase('es').includes(q)
  })
})
const plantelOrdenado = computed(() => [...plantelFiltrado.value].sort((a, b) =>
  (LINEA_ORDEN[a.posicion_natural] ?? 9) - (LINEA_ORDEN[b.posicion_natural] ?? 9)
  || (almanaque.value
    ? String(a.nombre).localeCompare(String(b.nombre), 'es')
    : b.ovr_final - a.ovr_final)
))

const plantelLista = computed(() => {
  const out = []
  let head = null
  for (const j of plantelOrdenado.value) {
    const linea = LINEA_ORDEN[j.posicion_natural] ?? 9
    if (!head || head.linea !== linea) {
      head = { header: LINEA_NOMBRE[linea] ?? 'Otros', linea, count: 0 }
      out.push(head)
    }
    head.count++
    out.push({ jugador: j })
  }
  return out
})

// ---- Estado ----
const partidaId = ref(null)
const nombreEquipo = ref(NOMBRE_FIJO)
const formacion = ref('4-4-2')
const estilo = ref('equilibrado')
const anchura = ref('equilibrado')
const almanaque = ref(false)
const modo = ref('normal')
const formato = ref('copa')
const catalogo = ref({ formaciones: {}, todas: {}, estilos: [] })
const sorteo = ref(null)
const plantel = ref([])
const seleccionado = ref(null)
const equipo = ref([])
const slotActivo = ref('ARQ')
// Al tocar un jugador propio mostramos nombre + año del plantel (útil en celular,
// donde el tooltip del ratón no existe).
const jugadorInfo = ref(null)
const capitanId = ref(null)
// Errores de cierre del draft: se muestran junto al botón, no al pie de la página.
const errorCierre = ref('')
const resaltarCierre = ref('')
function falloCierre(texto, que) {
  errorCierre.value = texto
  resaltarCierre.value = que
}
function limpiarCierre() {
  errorCierre.value = ''
  resaltarCierre.value = ''
}
const draftCerrado = ref(false)
const mostrarTorneo = ref(false)
const error = ref('')
const cargando = ref(false)
const confirmarReinicio = ref(false)
const dadoFace = ref('🎲')
const cartasFlip = ref([])
const historial = ref([])
const historialPagina = ref(0)
// El inicio es la versión resumida: pocas partidas y detalle compacto.
// El historial completo y detallado vive en "Tus drafts".
const HISTORIAL_INICIO = 3
const historialVisibles = computed(() => historial.value.slice(
  historialPagina.value * HISTORIAL_INICIO,
  (historialPagina.value + 1) * HISTORIAL_INICIO))
const historialPaginas = computed(() => Math.max(1, Math.ceil(historial.value.length / HISTORIAL_INICIO)))
watch(historial, () => { historialPagina.value = 0 })
// "Últimas partidas" despliega un resumen en el lugar; ya no abre la partida.
const resumenAbierto = ref(null)
function alternarResumen(id) {
  resumenAbierto.value = resumenAbierto.value === id ? null : id
}

// Celular: el workspace se muestra de a un paso (nada de una columna infinita)
// y los paneles secundarios quedan detrás de "Más info".
// "Armar" junta el mazo y la cancha: elegís jugador y tocás su slot sin cambiar
// de pestaña (nada de idas y vueltas por cada uno de los 11).
const PASOS_MOBILE = [
  { id: 'armar', num: '1', label: 'Armar' },
  { id: 'equipo', num: '2', label: 'Mi equipo' }
]
const pasoMobile = ref('armar')
const infoAbierta = ref(false)
const escudosAbiertos = ref(false)
function abrirInfoSiCorresponde() {
  if (['#historial', '#legado', '#rivales'].includes(window.location.hash)) {
    infoAbierta.value = true
  }
}

// Catálogo de River por año: de acá salen los 9 escudos elegibles y el
// escudo histórico del plantel que salió en el sorteo.
const temporadasRiver = ref([])
const escudosRiver = computed(() => {
  const mapa = new Map()
  for (const t of temporadasRiver.value) {
    const url = escudoEpocaDe(t)
    if (!url) continue
    const actual = mapa.get(url) ?? { url, min: t.anio_orden, max: t.anio_orden }
    actual.min = Math.min(actual.min, t.anio_orden ?? actual.min)
    actual.max = Math.max(actual.max, t.anio_orden ?? actual.max)
    mapa.set(url, actual)
  }
  return [...mapa.values()]
    .sort((a, b) => a.min - b.min)
    .map((e) => ({ ...e, label: e.min === e.max ? String(e.min) : `${e.min}–${e.max}` }))
})
const escudoMioLabel = computed(() =>
  escudosRiver.value.find((e) => e.url === escudoMioUrl.value)?.label ?? 'Actual')
const escudoSorteo = computed(() => {
  if (!sorteo.value) return null
  const t = temporadasRiver.value.find((x) =>
    x.anio_orden === sorteo.value.anio_orden || x.etiqueta === sorteo.value.etiqueta)
  return escudoEpocaDe(t ?? sorteo.value)
})
const sonidoOn = ref(true)
const keepersPick = ref([])
const torneoFin = ref(null)
const ultimoPick = ref(null)
const guardadoOk = ref('')
const tipActivo = ref('')
const tipPos = ref({ top: 0, left: 0, arriba: true })
let ultimoEsTouch = false
function tipDe(e) { return e.currentTarget?.getAttribute('data-tip') ?? '' }
// El globo se ancla al botón, no a una esquina: se ve siempre, también en móvil.
function posarTip(e) {
  const r = e.currentTarget?.getBoundingClientRect?.()
  if (!r) return
  const centro = r.left + r.width / 2
  const margen = 128
  const izq = Math.min(Math.max(centro, margen), window.innerWidth - margen)
  const arriba = r.top > 150
  tipPos.value = { top: arriba ? r.top - 10 : r.bottom + 10, left: izq, arriba }
}
function alEntrarTip(e) {
  if (e.pointerType === 'touch') return
  ultimoEsTouch = false
  const t = tipDe(e)
  if (!t) return
  posarTip(e)
  tipActivo.value = t
}
function alSalirTip(e) { if (e.pointerType !== 'touch') tipActivo.value = '' }
function alTocarTip(e) {
  if (e.pointerType !== 'touch') return
  ultimoEsTouch = true
  const t = tipDe(e)
  if (tipActivo.value === t) { tipActivo.value = ''; return }
  posarTip(e)
  tipActivo.value = t
}
function alFocoTip(e) {
  if (ultimoEsTouch) return
  const t = tipDe(e)
  if (!t) return
  posarTip(e)
  tipActivo.value = t
}
function alDesenfocarTip() { tipActivo.value = '' }
// Sin velo: se cierra al salir del botón, al tocar fuera o al scrollear.
function cerrarTipFuera(e) {
  if (tipActivo.value && !e.target.closest?.('[data-tip], .tip-globo')) tipActivo.value = ''
}
function cerrarTipScroll() { tipActivo.value = '' }
const tipHandlers = {
  onPointerenter: alEntrarTip, onPointerleave: alSalirTip, onPointerdown: alTocarTip,
  onFocus: alFocoTip, onBlur: alDesenfocarTip
}
let guardadoTimer = null
const editDorsal = ref(null)
const dorsalInput = ref('')
// "Dorsales auto" queda en verde después de aplicarse, como el capitán.
const dorsalesAutoOn = ref(false)
const rerollKey = computed(() => `reroll_${partidaId.value}`)
const rerollUsado = ref(false)
const plantelAporta = computed(() => {
  if (!sorteo.value || esFaseBanco.value) return true
  return plantel.value.some((j) => slotsCompatibles(j).length > 0)
})
const puedeReroll = computed(() => !!sorteo.value && !plantelAporta.value && !rerollUsado.value && !draftCerrado.value)
const vistaCancha = ref('XI')

const torneoRef = ref(null)

const slots = computed(() => {
  const mapa = catalogo.value.formaciones[formacion.value] ?? {}
  return Object.entries(mapa).map(([slot, pos]) => ({ slot, pos }))
})
const tieneCatalogo = computed(() => Object.keys(catalogo.value.formaciones ?? {}).length > 0)
const ovrPromedio = computed(() => promedioOvr(once.value))
const ovrVisible = computed(() => (almanaque.value ? '¿?' : ovrPromedio.value))
const estadoMarcador = computed(() => {
  if (almanaque.value) return 'De memoria'
  if (draftCerrado.value) return 'Cerrado'
  if (plantelListo.value) return 'Plantel listo'
  if (equipo.value.length) return 'En formación'
  return 'Sin definir'
})
const ataque = computed(() => promedioLinea(equipo.value, ATAQUE_POS, posDe))
const defensa = computed(() => promedioLinea(equipo.value, DEFENSA_POS, posDe))
const medio = computed(() => promedioLinea(equipo.value, LINEAS.Medio, posDe))
const equipoPorSlot = computed(() => {
  const mapa = {}
  for (const j of equipo.value) mapa[j.slot] = j
  return mapa
})
const equipoIds = computed(() => new Set(equipo.value.map((j) => j.temporada_jugador_id)))
// Se bloquea solo la fila exacta (jugador + año). La misma persona en otro
// plantel histórico se puede elegir: son dos versiones distintas del jugador.
function yaElegidoHay(j) {
  if (!j?.temporada_jugador_id || !equipoIds.value.has(j.temporada_jugador_id)) return ''
  const enBanco = equipo.value.some((x) => x.temporada_jugador_id === j.temporada_jugador_id &&
    String(x.slot).startsWith('SUP'))
  return enBanco ? 'ya está en tu banco' : 'ya está en tu XI'
}
const capitan = computed(() => equipo.value.find((j) => j.temporada_jugador_id === capitanId.value) ?? null)
// Checklist para ver de un vistazo qué falta antes de cerrar el draft.
const checklistCierre = computed(() => [
  { clave: 'xi', texto: 'XI completo', ok: xiCompleto.value },
  { clave: 'dorsal', texto: 'Dorsales', ok: once.value.every((j) => dorsalDe(j) !== null) },
  { clave: 'capitan', texto: capitan.value ? `Capitán: ${capitan.value.nombre}` : 'Capitán', ok: !!capitan.value },
  { clave: 'banco', texto: 'Banco 3 líneas', ok: !lineasFaltantes().length }
])
// El capitán sugerido sale del XI por jerarquía: MVP, estrella y después OVR.
const capitanSugerido = computed(() => [...once.value].sort((a, b) =>
  Number(!!b.es_mvp) - Number(!!a.es_mvp) ||
  Number(!!b.es_estrella) - Number(!!a.es_estrella) ||
  (Number(b.ovr_final) || 0) - (Number(a.ovr_final) || 0))[0] ?? null)
function elegirCapitanSugerido() {
  const jugador = capitanSugerido.value
  if (!jugador) return
  if (capitanId.value !== jugador.temporada_jugador_id) toggleCapitan(jugador.temporada_jugador_id)
}
// Un solo estado: si ya hay capitán, el botón lo muestra aplicado y permite
// cambiarlo; si no, ofrece el sugerido. Nunca las dos cosas a la vez.
function accionCapitan() {
  if (capitan.value) toggleCapitan(capitan.value.temporada_jugador_id)
  else elegirCapitanSugerido()
}
const completo = computed(() => slots.value.length > 0 && equipo.value.length >= slots.value.length)
const BANCO_COPA = 5
const maxPases = computed(() => PASES_POR_FORMATO[formato.value] ?? 3)
const bancoTope = computed(() => BANCO_POR_FORMATO[formato.value] ?? BANCO_COPA)
const once = computed(() => equipo.value.filter((j) => !String(j.slot).startsWith('SUP')))
const suplentes = computed(() => equipo.value.filter((j) => String(j.slot).startsWith('SUP')))
const xiCompleto = computed(() => slots.value.length > 0 && once.value.length >= slots.value.length)
const bancoCompleto = computed(() => suplentes.value.length >= bancoTope.value)
const esFaseBanco = computed(() => xiCompleto.value && !bancoCompleto.value)
const plantelListo = computed(() => xiCompleto.value && bancoCompleto.value)
const totalPlantel = computed(() => slots.value.length + bancoTope.value)
const pasesKey = computed(() => `pases_${partidaId.value}`)
const pasesUsados = ref(0)
const pasesRestantes = computed(() => Math.max(0, maxPases.value - pasesUsados.value))
const paso = computed(() => {
  if (plantelListo.value) return 4
  if (seleccionado.value) return 3
  if (sorteo.value) return 2
  return 1
})
const draftEstado = computed(() => {
  if (plantelListo.value) return draftCerrado.value ? 'cerrado · a jugar' : 'completo'
  if (draftCerrado.value) return 'cerrado'
  if (seleccionado.value) return 'eligiendo'
  if (sorteo.value) return 'sorteado'
  return partidaId.value ? 'sorteando' : 'nuevo'
})

// El topbar refleja el draft real sin que App.vue tenga que conocer la lógica.
watch([paso, equipo, partidaId, nombreEquipo, ovrVisible, almanaque, plantelListo, draftCerrado], () => {
  emit('estado', {
    partida: !!partidaId.value,
    partidaId: partidaId.value,
    paso: paso.value,
    estado: draftEstado.value,
    nombre: nombreEquipo.value,
    ovr: ovrVisible.value,
    almanaque: almanaque.value,
    jugadores: equipo.value.length,
    total: totalPlantel.value,
    listo: plantelListo.value
  })
}, { immediate: true })

const pasosDraft = computed(() => ['Config', 'Draft', 'Banco', 'Cierre'])

// La próxima acción concreta, en vez de una checklist estática.
const siguientePaso = computed(() => {
  if (!partidaId.value) return 'Elegí formación y estilo, después creá la partida.'
  if (draftCerrado.value) return 'Todo listo: andá a tu torneo.'
  if (plantelListo.value) {
    if (!capitan.value) return 'Elegí al capitán tocando © en tu marcador.'
    if (once.value.some((j) => dorsalDe(j) === null)) return 'Completá los dorsales del XI.'
    return 'Todo listo: tocá “Salir a jugar”.'
  }
  if (esFaseBanco.value) {
    const faltan = lineasFaltantes()
    return faltan.length
      ? `Falta un suplente de ${faltan.join(', ')} para el banco.`
      : 'Completá el banco con los suplentes que faltan.'
  }
  if (seleccionado.value) {
    const libres = slotsCompatibles(seleccionado.value)
    return libres.length
      ? `${seleccionado.value.nombre} → tocá ${libres.join(' o ')}.`
      : `${seleccionado.value.nombre} no cubre ningún slot libre de tu formación.`
  }
  if (sorteo.value) return 'Tocá un jugador del mazo y después su slot en la cancha.'
  return 'Tirá el sorteo para conocer a tus jugadores.'
})

function irAConfig() {
  pasoMobile.value = 'armar'
  document.getElementById('configuracion')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  document.querySelector('#configuracion .choice-row button')?.focus({ preventScroll: true })
}

function irADraft() {
  pasoMobile.value = 'armar'
  document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' })
}

function esMobile() {
  return window.matchMedia('(max-width: 720px)').matches
}
// En celular el armado se auto-guía: elegís en el mazo → baja a la cancha →
// tocás el slot → vuelve al mazo. Sin pestañas extras ni idas y vueltas.
function irASeccion(id) {
  if (!esMobile()) return
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
// Etiqueta del año del plantel del que salió cada jugador.
function anioDe(j) {
  return j?.etiqueta || (j?.anio_orden ? `River ${j.anio_orden}` : '')
}
// Escudo histórico de River del año del que salió el jugador. Se muestra junto
// al nombre (con el año) y es distinto del escudo elegido por el usuario.
function escudoAnioDe(j) {
  if (!j) return null
  if (j.escudo_epoca) return j.escudo_epoca
  const anio = Number(j.anio_orden ?? j.foto_anio)
  if (!anio) return null
  const t = temporadasRiver.value.find((x) => Number(x.anio_orden) === anio)
  return t ? escudoEpocaDe(t) : null
}
function anioNumeroDe(j) {
  return Number(j?.anio_orden ?? j?.foto_anio) || ''
}
function verJugador(j) {
  if (!j) return
  jugadorInfo.value = { nombre: j.nombre, anio: anioDe(j) || 'temporada desconocida' }
}
function tituloSlot(j, slot) {
  if (!j) return `${slot} · vacío`
  const dorsal = dorsalDe(j)
  const ovr = almanaque.value ? '¿?' : (j.ovr_final ?? '?')
  const anio = anioDe(j)
  return `${j.nombre}${anio ? ' · ' + anio : ''} · OVR ${ovr} · ${dorsal !== null ? 'dorsal ' + dorsal : 'sin dorsal'} · ${slot}`
}
// ref (no computed): un computed sin dependencias reactivas se congela y la
// carrera queda desactualizada tras guardar keepers o iniciar la fecha siguiente.
function leerCarrera() {
  try {
    return JSON.parse(localStorage.getItem('carrera') ?? 'null')
  } catch {
    return null
  }
}
const carrera = ref(leerCarrera())
function guardarCarrera(datos) {
  localStorage.setItem('carrera', JSON.stringify(datos))
  carrera.value = datos
}

function coord(slot) {
  return coordConTactica(PITCH_COORDS[formacion.value]?.[slot], estilo.value, anchura.value)
}
function secundarias(j) {
  return (j.posiciones_secundarias || '').split(',').map((s) => s.trim()).filter(Boolean)
}
function posDe(slot) {
  return catalogo.value.formaciones[formacion.value]?.[slot]
}
function esCompatible(jugador, slot) {
  const pos = posDe(slot)
  if (!pos || !jugador) return false
  return jugador.posicion_natural === pos || secundarias(jugador).includes(pos)
}
function slotsCompatibles(jugador) {
  return slots.value.filter((s) => !equipoPorSlot.value[s.slot] && esCompatible(jugador, s.slot)).map((s) => s.slot)
}
// El mazo y la bandeja fija preguntan por los mismos jugador/slot en el mismo
// render. Un mapa por id evita recorrer la formación dos veces por candidato.
const slotsLibresPorJugador = computed(() => {
  const mapa = new Map()
  for (const j of plantel.value) mapa.set(j.temporada_jugador_id, slotsCompatibles(j))
  if (seleccionado.value) {
    mapa.set(seleccionado.value.temporada_jugador_id, slotsCompatibles(seleccionado.value))
  }
  return mapa
})
function slotsDe(jugador) {
  if (!jugador) return []
  return slotsLibresPorJugador.value.get(jugador.temporada_jugador_id) ?? slotsCompatibles(jugador)
}
const slotsDelSeleccionado = computed(() => slotsDe(seleccionado.value))
// El titular más flojo entre los que comparten posición natural o secundaria.
// Es contra quien conviene comparar a un suplente que pide minutos.
function titularMasFlojoPara(j) {
  if (!j) return null
  const compatibles = once.value.filter((t) => esCompatible(j, t.slot))
  if (!compatibles.length) return null
  return compatibles.reduce((peor, t) =>
    (Number(t.ovr_final) || 0) < (Number(peor.ovr_final) || 0) ? t : peor)
}
function mejoraDe(j) {
  if (!partidaId.value || almanaque.value || draftCerrado.value || cargando.value) return null
  const titular = titularMasFlojoPara(j)
  if (!titular) return null
  const ovrJ = Number(j.ovr_final)
  const ovrT = Number(titular.ovr_final)
  if (!Number.isFinite(ovrJ) || !Number.isFinite(ovrT)) return null
  return ovrJ > ovrT ? titular : null
}
// El template consultaba mejoraDe() hasta 4 veces por suplente; cada llamada
// recorría el once. Se calcula una vez por jugador cuando cambia el equipo.
const mejorasPorSuplente = computed(() => {
  const mapa = new Map()
  for (const j of suplentes.value) mapa.set(j.temporada_jugador_id, mejoraDe(j))
  return mapa
})
function mejoraDeSuplente(j) {
  return mejorasPorSuplente.value.get(j.temporada_jugador_id) ?? null
}
async function subirSuplente(j) {
  const titular = mejoraDe(j)
  if (!titular || !puedeArrastrar.value) return
  await swapSlots(j.slot, titular.slot)
  vistaCancha.value = 'XI'
}
function marca(j) {
  if (j.es_mvp) return '⭐ MVP'
  if (j.es_estrella) return '★'
  return ''
}
function bloqueado(j) {
  if (!j) return true
  if (esFaseBanco.value && j.posicion_natural === 'ARQ') return true
  if (!sorteo.value) return false
  return motivoBloqueo(j) !== ''
}
function motivoBloqueo(j) {
  if (!j) return ''
  const repetido = yaElegidoHay(j)
  if (repetido) return repetido
  // El arquero se muestra bloqueado cuando se está armando el banco.
  if (esFaseBanco.value && j.posicion_natural === 'ARQ') return 'arquero: solo en el XI'
  const libres = slotsCompatibles(j)
  // En el draft el bloqueo es del candidato, no del jugador ya puesto en la
  // cancha: si todos sus puestos compatibles están ocupados, avisarlo acá.
  if (sorteo.value && !esFaseBanco.value && libres.length === 0) {
    return cubreAlgunSlot(j) ? 'sin puesto libre' : 'no cubre tu formación'
  }
  if (libres.length === 0 && !cubreAlgunSlot(j)) return 'no cubre tu formación'
  const tope = topeBanco(j.posicion_natural)
  if (cuentaPuestoBanco(j.posicion_natural) >= tope) return `tope: ${tope} ${j.posicion_natural}`
  if (sorteo.value && esFaseBanco.value) {
    const faltan = lineasFaltantes()
    if (faltan.length) {
      const codes = [j.posicion_natural, ...secundarias(j)]
      const sirve = faltan.some((l) => codes.some((c) => LINEAS[l].includes(c)))
      if (!sirve) return `falta cubrir: ${faltan.join(', ')}`
    }
  }
  return ''
}
function cubreAlgunSlot(jugador) {
  if (!jugador) return false
  return slots.value.some((s) => esCompatible(jugador, s.slot))
}
// El banco es solo de campo: hasta 2 por puesto natural (el arquero se
// descarta antes). Es la misma regla que validan guardar_jugador.php e
// intercambiar.php.
function topeBanco(pos) {
  return 2
}
function cuentaPuestoBanco(pos) {
  return suplentes.value.filter((j) => j.posicion_natural === pos).length
}
function motivoBanco(j) {
  if (!j) return 'Jugador inválido'
  if (j.posicion_natural === 'ARQ') return 'arquero: solo en el XI'
  if (!cubreAlgunSlot(j)) return 'no cubre tu formación'
  const tope = topeBanco(j.posicion_natural)
  if (cuentaPuestoBanco(j.posicion_natural) >= tope) {
    return `tope: ${tope} ${j.posicion_natural} en el banco`
  }
  return ''
}
function lineasFaltantes() {
  const codes = (j) => [j.posicion_natural, ...secundarias(j)]
  return Object.entries(LINEAS)
    .filter(([, arr]) => !suplentes.value.some((j) => codes(j).some((c) => arr.includes(c))))
    .map(([nombre]) => nombre)
}
function codigosSinRelevo() {
  // El arco no necesita relevo: el banco es solo de jugadores de campo.
  const codes = [...new Set(slots.value.map((s) => s.pos))].filter((p) => p !== 'ARQ')
  return codes.filter((pos) => !suplentes.value.some(
    (j) => j.posicion_natural === pos || secundarias(j).includes(pos)))
}
function insignia(filas) {
  if (!filas?.length) return null
  const last = filas[filas.length - 1]
  if (filas.length === 7 && last.ronda === 'Final' && filas.every((f) => f.avanzo)) {
    return filas.every((f) => f.goles_contra === 0) ? '7A0' : 'C'
  }
  return 'E'
}
// El historial ya trae los partidos: la insignia se calcula sin botón
// "ver torneo" ni una llamada extra por partida.
function insigniaDe(h) {
  const b = insignia((h.partidos ?? []).map((p) => ({
    ronda: p.fase, avanzo: true, goles_favor: p.gf, goles_contra: p.gc
  })))
  return b === 'C' || b === '7A0' ? b : null
}
// Una sesión sin resultados es una partida empezada y no terminada: sirve both
// para marcarla en el inicio y para no presentarla como un torneo jugado.
function sinTerminar(h) {
  return !Array.isArray(h?.partidos) || h.partidos.length === 0
}

async function comenzarPartida() {
  try {
    error.value = ''
    let nombre = NOMBRE_FIJO
    let nCarrera = 1
    if (modo.value === 'carrera') {
      const c = carrera.value
      nCarrera = c ? c.n + 1 : 1
      nombre = `${nombre.replace(/ · T\d+$/, '')} · T${nCarrera}`
      guardarCarrera({ nombre: nombre.replace(/ · T\d+$/, ''), n: nCarrera, keepers: [] })
      keepersPick.value = []
    }
    const partida = await crearPartida(
      nombre, formacion.value, estilo.value,
      formato.value === 'copa' ? 'copa' : 'liga', formato.value)
    partidaId.value = Number(partida.id)
    pasoMobile.value = 'armar'
    escudosAbiertos.value = false
    nombreEquipo.value = nombre
    for (const [k, v] of [
      ['partidaId', String(partidaId.value)], ['nombreEquipo', nombre],
      ['formacion', formacion.value], ['estilo', estilo.value],
      ['almanaque', almanaque.value ? '1' : '0'], ['modo', modo.value],
      ['anchura', anchura.value],
      ['formato', formato.value]]) {
      localStorage.setItem(k, v)
    }
    pasesUsados.value = 0
    rerollUsado.value = false
    capitanId.value = null
    draftCerrado.value = false
    mostrarTorneo.value = false
    torneoFin.value = null
    equipo.value = []
    sorteo.value = null
    cartasFlip.value = []
    plantel.value = []
    seleccionado.value = null
    try {
      const r = await desbloquearLogro(partidaId.value, 'primer_partido')
      if (r?.nuevo) window.dispatchEvent(new CustomEvent('3a1:logro', { detail: 'primer_partido' }))
    } catch { /* tabla puede no existir */ }
    const c = carrera.value
    if (modo.value === 'carrera' && c?.keepers?.length) {
      const libres = () => slots.value.map((s) => s.slot).filter(
        (sl) => !equipo.value.some((j) => j.slot === sl)
      )
      let ok = 0
      const perdidos = []
      for (const k of c.keepers) {
        const intentos = [k.slot, ...libres().filter((sl) => sl !== k.slot)]
        let entro = false
        for (const sl of intentos) {
          if (!sl || equipo.value.some((j) => j.slot === sl)) continue
          try {
            await guardarJugador(partidaId.value, k.tj, sl)
            entro = true
            ok++
            break
          } catch (e) {
            if (!String(e.message ?? '').includes('no puede jugar') && !String(e.message ?? '').includes('no existe')) break
          }
        }
        if (!entro) perdidos.push(k.tj)
        equipo.value = await cargarEquipo(partidaId.value)
      }
      equipo.value = await cargarEquipo(partidaId.value)
      guardarCarrera({ nombre: c.nombre, n: c.n, keepers: [] })
      if (perdidos.length) {
        error.value = `Conservaron ${ok}/5: ${perdidos.length} no entran en ${formacion.value} y se pierden`
      }
    }
    refrescarPaneles()
  } catch (e) {
    error.value = e.message
  }
}

async function nuevaPartida() {
  for (const k of ['partidaId', 'nombreEquipo', 'formacion', 'estilo', 'anchura', 'almanaque', 'modo', 'formato']) {
    localStorage.removeItem(k)
  }
  if (partidaId.value) {
    localStorage.removeItem(`pases_${partidaId.value}`)
    localStorage.removeItem(`reroll_${partidaId.value}`)
    localStorage.removeItem(`cap_${partidaId.value}`)
    localStorage.removeItem(`cerrado_${partidaId.value}`)
  }
  partidaId.value = null
  torneoFin.value = null
  equipo.value = []
  sorteo.value = null
  cartasFlip.value = []
  plantel.value = []
  seleccionado.value = null
  slotActivo.value = 'ARQ'
  capitanId.value = null
  draftCerrado.value = false
  mostrarTorneo.value = false
  pasesUsados.value = 0
  rerollUsado.value = false
  keepersPick.value = []
  ultimoPick.value = null
  editDorsal.value = null
  dorsalInput.value = ''
  vistaCancha.value = 'XI'
  confirmarReinicio.value = false
  error.value = ''
  dadoFace.value = '🎲'
}

async function cargarPartida(id) {
  try {
    error.value = ''
    const p = await obtenerPartida(id)
    partidaId.value = Number(p.id)
    // Partidas viejas guardaron "Tu River Plate": hoy el equipo es siempre
    // "River Plate" y el escudo elegido es el que identifica al usuario.
    nombreEquipo.value = String(p.nombre_equipo || NOMBRE_FIJO).replace(/^Tu\s+(?=River\b)/i, '')
    formacion.value = p.formacion
    estilo.value = p.estilo ?? 'equilibrado'
    formato.value = p.formato ?? 'copa'
    modo.value = modoDePartida(p.nombre_equipo)
    localStorage.setItem('partidaId', String(partidaId.value))
    localStorage.setItem('nombreEquipo', nombreEquipo.value)
    localStorage.setItem('formacion', p.formacion)
    localStorage.setItem('estilo', estilo.value)
    localStorage.setItem('formato', formato.value)
    localStorage.setItem('modo', modo.value)
    equipo.value = await cargarEquipo(partidaId.value)
    dorsalesAutoOn.value = false
    pasesUsados.value = Number(localStorage.getItem(`pases_${partidaId.value}`) ?? 0)
    rerollUsado.value = localStorage.getItem(`reroll_${partidaId.value}`) === '1'
    capitanId.value = Number(localStorage.getItem(`cap_${partidaId.value}`) ?? 0) || null
    draftCerrado.value = localStorage.getItem(`cerrado_${partidaId.value}`) === '1'
    sorteo.value = null
    cartasFlip.value = []
    plantel.value = []
    seleccionado.value = null
    mostrarTorneo.value = false
    torneoFin.value = null
    refrescarPaneles()
    if (equipo.value.length >= slots.value.length && slots.value.length > 0) {
      if (formato.value !== 'copa') {
        try {
          const t = await obtenerTorneo({ partidaId: partidaId.value })
          if (t?.id) {
            mostrarTorneo.value = true
            await nextTick()
            await ligaRef.value?.restaurar(t.id)
          }
        } catch { /* sin liga todavía */ }
      } else if (esLegado.value) {
        // Solo partidas históricas del antiguo desafío diario: se pueden abrir,
        // pero no se pueden crear nuevas ni aparecen en el historial.
        try {
          const rows = (await obtenerResultados(partidaId.value)).filter((r) => !r.amistoso)
          if (rows.length) {
            mostrarTorneo.value = true
            await nextTick()
            await torneoRef.value?.restaurar(rows)
          }
        } catch { /* sin torneo legacy todavía */ }
      } else {
        try {
          const t = await obtenerTorneo({ partidaId: partidaId.value })
          if (t?.id) {
            mostrarTorneo.value = true
            await nextTick()
            await mundialRef.value?.restaurar(t.id)
          }
        } catch { /* sin mundial todavía */ }
      }
    }
  } catch (e) {
    error.value = e.message
  }
}

let dadoTimer = null
async function tirar({ scroll = false } = {}) {
  if (!partidaId.value || sorteo.value || draftCerrado.value || plantelListo.value) return
  try {
    cargando.value = true
    error.value = ''
    cartasFlip.value = Array.from({ length: 5 }, () => ({ abierta: false }))
    let reveladas = 0
    dadoTimer = setInterval(() => {
      dadoFace.value = DADOS[Math.floor(Math.random() * DADOS.length)]
      if (reveladas < cartasFlip.value.length) cartasFlip.value[reveladas++].abierta = true
    }, 140)
    const s = await obtenerSorteo(partidaId.value, true)
    // El mazo tarda 5 × 140ms en revelarse: esperamos a que termine el flip.
    await new Promise((r) => setTimeout(r, 760))
    sorteo.value = s
    seleccionado.value = null
    jugadorInfo.value = null
    ultimoPick.value = null
    plantel.value = (await obtenerJugadores(s.temporada_id)).filter(
      (j) => !equipoIds.value.has(j.temporada_jugador_id)
    )
    if (scroll) {
      await nextTick()
      irASeccion('mazo')
    }
  } catch (e) {
    error.value = e.message
  } finally {
    clearInterval(dadoTimer)
    dadoFace.value = '🎲'
    cargando.value = false
  }
}

async function pasar() {
  // Si el plantel sorteado no aporta a las posiciones que faltan, pasar es
  // gratis siempre (no solo cuando se agotaron los pases): el usuario no debe
  // pagar con un pase por un año que el sorteo le dio y no sirve.
  const rescate = !!sorteo.value && !plantelAporta.value
  const pases = pasesRestantes.value
  if (pases <= 0 && !rescate) {
    error.value = 'No quedan pases en esta partida'
    return
  }
  error.value = ''
  if (!rescate) {
    pasesUsados.value++
    localStorage.setItem(pasesKey.value, String(pasesUsados.value))
  }
  sorteo.value = null
  cartasFlip.value = []
  plantel.value = []
  seleccionado.value = null
  // "Pasar" debe dejar un plantel nuevo listo para elegir, no un hueco vacío.
  await tirar({ scroll: true })
  if (rescate && pases === 0 && sorteo.value) {
    error.value = 'No quedan pases: este plantel es gratis, elegí un jugador.'
  }
}

async function clickJugador(j) {
  if (sorteo.value) {
    const motivo = motivoBloqueo(j)
    if (motivo) {
      error.value = `${j.nombre}: ${motivo}`
      sonidoError()
      return
    }
  }
  verJugador(j)
  seleccionado.value = seleccionado.value?.temporada_jugador_id === j.temporada_jugador_id ? null : j
  if (esFaseBanco.value && seleccionado.value) {
    await confirmar(seleccionado.value, null)
    return
  }
  if (seleccionado.value) {
    // En celular mostramos la cancha justo después de elegir, para que el
    // siguiente toque sea directamente el slot (sin búsqueda ni scroll manual).
    await nextTick()
    irASeccion('pitch')
  }
}

function clickSlot(slot) {
  slotActivo.value = slot
  if (equipoPorSlot.value[slot]) verJugador(equipoPorSlot.value[slot])
  if (esFaseBanco.value) return
  if (!sorteo.value || !seleccionado.value) return
  if (equipoPorSlot.value[slot]) {
    error.value = `${slot} ya lo ocupa ${equipoPorSlot.value[slot].nombre}. Ese puesto se libera con el intercambio XI↔banco.`
    sonidoError()
    return
  }
  if (!esCompatible(seleccionado.value, slot)) {
    error.value = `${seleccionado.value.nombre} no puede jugar en ${slot}`
    sonidoError()
    return
  }
  error.value = ''
  confirmar(seleccionado.value, slot)
}

function chipElegir(j, slot) {
  if (!sorteo.value || bloqueado(j)) return
  seleccionado.value = j
  slotActivo.value = slot
  if (equipoPorSlot.value[slot] || !esCompatible(j, slot)) return
  error.value = ''
  confirmar(j, slot)
}
// En celular, la barra inferior permite mandar al banco sin volver al mazo.
function mandarAlBanco(j) {
  if (!j || !esFaseBanco.value || bloqueado(j)) return
  seleccionado.value = j
  confirmar(j, null)
}

function proximoSupLibre() {
  for (let n = 1; n <= bancoTope.value; n++) {
    if (!equipoPorSlot.value[`SUP${n}`]) return `SUP${n}`
  }
  return null
}

const arrastre = ref(null)
const destinoDrop = ref(null)
const puedeArrastrar = computed(() => !!partidaId.value && !draftCerrado.value && !cargando.value)
function dragCandidato(e, j) {
  if (!puedeArrastrar.value || bloqueado(j)) return
  arrastre.value = { kind: 'cand', tj: j.temporada_jugador_id }
}
function dragFicha(e, slot) {
  if (!puedeArrastrar.value || !equipoPorSlot.value[slot]) return
  arrastre.value = { kind: 'slot', slot }
}
function finArrastre() {
  arrastre.value = null
  destinoDrop.value = null
}
function esXI(slot) {
  return !String(slot).startsWith('SUP')
}
function puedeSoltar(dest) {
    const a = arrastre.value
    if (!a || !puedeArrastrar.value) return false
    if (a.kind === 'cand') {
      if (!sorteo.value || !esXI(dest) || equipoPorSlot.value[dest]) return false
      const j = plantel.value.find((x) => x.temporada_jugador_id === a.tj)
      return !!j && esCompatible(j, dest)
    }
    if (a.slot === dest) return false
    const ja = equipoPorSlot.value[a.slot]
    const jb = equipoPorSlot.value[dest]
    if (!ja) return false
    if (esXI(a.slot) && esXI(dest)) {
      return !!jb && esCompatible(jb, a.slot) && esCompatible(ja, dest)
    }
    if (esXI(a.slot) && !esXI(dest)) return !!jb && esCompatible(jb, a.slot)
    if (!esXI(a.slot) && esXI(dest)) {
      if (!equipoPorSlot.value[dest]) return esCompatible(ja, dest)
      const jb = equipoPorSlot.value[dest]
      return !!jb && esCompatible(ja, dest)
    }
    return false
  }
function sobreSlot(e, dest) {
  if (puedeSoltar(dest)) {
    e.preventDefault()
    destinoDrop.value = dest
  }
}
function salirSlot(slot) {
  if (destinoDrop.value === slot) destinoDrop.value = null
}
async function soltarEnSup(e, supSlot) {
  const a = arrastre.value
  finArrastre()
  if (!a || a.kind !== 'slot' || a.slot === supSlot) return
  if (!esXI(a.slot) || esXI(supSlot)) return
  await swapSlots(a.slot, supSlot)
}
const destinoBanco = ref(false)
function sobreBanco(e) {
  const a = arrastre.value
  if (a && a.kind === 'slot' && esXI(a.slot) && proximoSupLibre()) {
    e.preventDefault()
    destinoBanco.value = true
  }
}
async function soltarEnBanco() {
  const a = arrastre.value
  destinoBanco.value = false
  finArrastre()
  if (!a || a.kind !== 'slot' || !esXI(a.slot)) return
  await moverAlBanco(a.slot)
}
async function soltarEnSlot(e, dest) {
  const a = arrastre.value
  finArrastre()
  if (!a) return
  if (a.kind === 'cand') {
    const j = plantel.value.find((x) => x.temporada_jugador_id === a.tj)
    if (!j || equipoPorSlot.value[dest] || !esCompatible(j, dest)) return
    seleccionado.value = j
    slotActivo.value = dest
    await confirmar(j, dest)
    return
  }
  await swapSlots(a.slot, dest)
}
async function swapSlots(slotA, slotB) {
  const ja = equipoPorSlot.value[slotA]
  const jb = equipoPorSlot.value[slotB]
  if (!ja || !jb || slotA === slotB) return
  if (!esXI(slotA) && !esXI(slotB)) return
  try {
    cargando.value = true
    error.value = ''
    // Intercambio atómico: el backend valida posición, cobertura del banco y tope.
    await intercambiarJugadores(partidaId.value, slotA, slotB)
    equipo.value = await cargarEquipo(partidaId.value)
    ultimoPick.value = esXI(slotB) ? slotB : slotA
    sonidoConfirmar()
  } catch (e) {
    error.value = e.message
    equipo.value = await cargarEquipo(partidaId.value).catch(() => equipo.value)
    sonidoError()
  } finally {
    cargando.value = false
  }
}
async function moverAlBanco(slotXI) {
  const j = equipoPorSlot.value[slotXI]
  const sup = proximoSupLibre()
  if (!j || !esXI(slotXI) || !sup) return
  const motivo = motivoBanco(j)
  if (motivo) {
    error.value = `${j.nombre}: ${motivo}`
    sonidoError()
    return
  }
  let quito = false
  let guardado = false
  try {
    cargando.value = true
    error.value = ''
    await quitarJugador(partidaId.value, slotXI)
    quito = true
    await guardarJugador(partidaId.value, j.temporada_jugador_id, sup)
    guardado = true
    equipo.value = await cargarEquipo(partidaId.value)
    sonidoConfirmar()
  } catch (e) {
    // Si el backend rechazó el pase al banco, devolvemos al jugador a su
    // puesto para no dejar el XI incompleto. La validación previa debería
    // evitarlo, pero la compensación cubre una carrera o un cambio de regla.
    if (quito && !guardado) {
      await guardarJugador(partidaId.value, j.temporada_jugador_id, slotXI).catch(() => {})
    }
    error.value = e.message
    equipo.value = await cargarEquipo(partidaId.value).catch(() => equipo.value)
  } finally {
    cargando.value = false
  }
}

async function reroll() {
  if (!puedeReroll.value) return
  rerollUsado.value = true
  localStorage.setItem(rerollKey.value, '1')
  sorteo.value = null
  cartasFlip.value = []
  plantel.value = []
  seleccionado.value = null
  error.value = ''
  // El resorteo es gratis pero igual tira el dado y revela el mazo solo.
  await tirar({ scroll: true })
}

async function confirmar(jugador, slotFijo) {
  if (!jugador || cargando.value) return
  try {
    cargando.value = true
    error.value = ''
    const slot = slotFijo ?? proximoSupLibre()
    if (!slot) {
      error.value = 'No hay lugar en el banco'
      return
    }
    await guardarJugador(partidaId.value, jugador.temporada_jugador_id, slot)
    equipo.value = await cargarEquipo(partidaId.value)
    ultimoPick.value = slot
    guardadoOk.value = `${jugador.nombre} · ${slot} ✓`
    clearTimeout(guardadoTimer)
    guardadoTimer = setTimeout(() => { guardadoOk.value = '' }, 2200)
    sonidoConfirmar()
    sorteo.value = null
    cartasFlip.value = []
    plantel.value = []
    seleccionado.value = null
    // El mazo se cierra al confirmar: llevamos al botón "Tirar" para seguir.
    await nextTick()
    irASeccion('tirar')
  } catch (e) {
    error.value = e.message
    await nextTick()
    document.querySelector('.error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } finally {
    cargando.value = false
  }
}

function toggleCapitan(tjId) {
  capitanId.value = capitanId.value === tjId ? null : tjId
  localStorage.setItem(`cap_${partidaId.value}`, String(capitanId.value ?? 0))
  if (resaltarCierre.value === 'capitan') limpiarCierre()
}

function dorsalDe(j) {
  return j?.dorsal_elegido ?? j?.dorsal ?? null
}
function abrirDorsal(slot) {
  editDorsal.value = slot
  dorsalInput.value = dorsalDe(equipoPorSlot.value[slot]) ?? ''
}
function cerrarDorsal() {
  editDorsal.value = null
  dorsalInput.value = ''
}
async function guardarDorsal(slot) {
  const n = Number(dorsalInput.value)
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    error.value = 'El dorsal debe estar entre 1 y 99'
    return
  }
  if (equipo.value.some((j) => j.slot !== slot && dorsalDe(j) === n)) {
    error.value = `El ${n} ya está en uso en tu equipo`
    return
  }
  try {
    error.value = ''
    await setearDorsal(partidaId.value, slot, n)
    equipo.value = await cargarEquipo(partidaId.value)
    dorsalesAutoOn.value = false
    cerrarDorsal()
    if (resaltarCierre.value === 'dorsal') limpiarCierre()
  } catch (e) {
    error.value = e.message
  }
}
async function limpiarDorsal(slot) {
  try {
    error.value = ''
    await setearDorsal(partidaId.value, slot, null)
    equipo.value = await cargarEquipo(partidaId.value)
    dorsalesAutoOn.value = false
    cerrarDorsal()
  } catch (e) {
    error.value = e.message
  }
}
async function dorsalesAuto() {
  try {
    error.value = ''
    // Un solo POST: el servidor asigna todos los dorsales en una transacción.
    // Antes se hacía un POST por jugador y un fallo aislado dejaba el XI a medias.
    await asignarDorsales(partidaId.value, 'xi')
    equipo.value = await cargarEquipo(partidaId.value)
    const sinDorsal = once.value.filter((j) => dorsalDe(j) === null)
    if (sinDorsal.length) {
      throw new Error(`No se pudieron asignar: ${sinDorsal.map((j) => j.slot).join(', ')}`)
    }
    dorsalesAutoOn.value = true
    if (resaltarCierre.value === 'dorsal') limpiarCierre()
  } catch (e) {
    error.value = e.message
    dorsalesAutoOn.value = false
  }
}

async function cerrarDraft() {
  error.value = ''
  if (!capitan.value) {
    falloCierre('Elegí al capitán tocando © en tu marcador', 'capitan')
    return
  }
  const sinDorsal = once.value.filter((j) => dorsalDe(j) === null)
  if (sinDorsal.length) {
    falloCierre(`Faltan dorsales en el XI: ${sinDorsal.map((j) => j.slot).join(', ')} (tocá # para elegir)`, 'dorsal')
    return
  }
  const faltan = lineasFaltantes()
  if (faltan.length) {
    falloCierre(`El banco no cubre: ${faltan.join(', ')} (llevá al menos un suplente de cada línea)`, 'banco')
    return
  }
  limpiarCierre()
  draftCerrado.value = true
  localStorage.setItem(`cerrado_${partidaId.value}`, '1')
}

const mundialRef = ref(null)
const ligaRef = ref(null)
// Partidas históricas del desafío diario: siguen siendo legibles, pero el
// modo ya no se puede crear ni se muestra en el historial.
const esLegado = computed(() => String(nombreEquipo.value ?? '').startsWith('Diario '))
const mostrarMundial = computed(() => !esLegado.value && formato.value === 'copa')
const mostrarLiga = computed(() => !esLegado.value && formato.value !== 'copa')
const nombreFormato = computed(() => formato.value === 'premier' ? 'Premier' : formato.value === 'liga30' ? 'Argentina' : 'Mundial')
// Resumen de un vistazo de lo elegido, antes de crear la partida.
const resumenConfig = computed(() => [
  modo.value === 'carrera' ? 'Carrera' : 'Normal',
  nombreFormato.value,
  formacion.value,
  `Mentalidad ${estilo.value.charAt(0).toUpperCase() + estilo.value.slice(1)}`,
  `Planteo ${ANCHOS.find((a) => a.valor === anchura.value)?.etiqueta ?? anchura.value}`,
  `Escudo ${escudoMioLabel.value}`,
  almanaque.value ? 'De Memoria' : 'Clásico'
].filter(Boolean).join(' · '))
async function jugarTorneo() {
  mostrarTorneo.value = true
  await nextTick()
  try {
    if (mostrarMundial.value || mostrarLiga.value) {
      await nextTick()
    } else {
      await torneoRef.value?.preparar()
    }
  } catch (e) {
    error.value = e.message
  }
  document.getElementById('torneo-wrap')?.scrollIntoView({ behavior: 'smooth' })
}

// El final de cada torneo dispara el guardado en la base compartida. Recién
// mostramos éxito cuando el servidor responde 201; si falla, se avisa el error.
async function subirARanking(res) {
  if (!partidaId.value || res?.amistoso) return
  if (!usuario.value) {
    window.dispatchEvent(new CustomEvent('3a1:guardado', {
      detail: { mensaje: 'Ingresá para sumar esta partida al ranking.' }
    }))
    return
  }
  try {
    const guardado = await guardarEnRanking(partidaId.value, 3)
    window.dispatchEvent(new CustomEvent('3a1:guardado', {
      detail: { mensaje: `${guardado.puntos} puntos guardados para ${usuario.value.alias}.` }
    }))
  } catch (error) {
    window.dispatchEvent(new CustomEvent('3a1:guardado', {
      detail: { mensaje: `No se pudo guardar: ${error.message}` }
    }))
  }
}

function onFinMundial(res) {
  torneoFin.value = res
  refrescarPaneles()
  subirARanking(res)
  if (modo.value === 'carrera' && !res.amistoso) {
    keepersPick.value = []
  }
}

function onEquipoMundial(eq) {
  equipo.value = eq
}

function onFinLiga(res) {
  torneoFin.value = res
  refrescarPaneles()
  subirARanking(res)
  if (modo.value === 'carrera' && !res.amistoso) {
    keepersPick.value = []
  }
}

function onEquipoLiga(eq) {
  equipo.value = eq
}

function onFinTorneo(res) {
  torneoFin.value = res
  refrescarPaneles()
  subirARanking(res)
  if (modo.value === 'carrera' && !res.amistoso) {
    keepersPick.value = []
  }
}

function guardarKeepers() {
  if (keepersPick.value.length !== 5) {
    error.value = 'Elegí 5 para conservar'
    return
  }
  const c = carrera.value ?? { nombre: nombreEquipo.value.replace(/ · T\d+$/, ''), n: 1 }
  guardarCarrera({
    nombre: c.nombre,
    n: c.n,
    keepers: keepersPick.value.map((id) => {
      const j = equipo.value.find((x) => x.temporada_jugador_id === id)
      return { tj: id, slot: j.slot }
    })
  })
  error.value = ''
}

async function reintentar() {
  error.value = ''
  if (!partidaId.value) return
  try {
    cargando.value = true
    equipo.value = await cargarEquipo(partidaId.value)
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

// ---- Paneles siempre visibles ----
// El historial cambia al terminar un partido; el catálogo de rivales y las
// temporadas de River son estáticos. Cargarlos también después de cada pick
// era 3 peticiones por elección sin ningún cambio en pantalla.
let historialEnVuelo = null
async function refrescarHistorial() {
  if (historialEnVuelo) return historialEnVuelo
  historialEnVuelo = (async () => {
    try {
      const todo = await obtenerHistorial(200)
      // Se muestran todas las sesiones, incluso las abandonadas: las que no
      // tienen ningún resultado jugado se marcan como "Sin terminar".
      historial.value = Array.isArray(todo) ? todo.slice(0, 20) : []
    } catch { /*noop*/ }
  })()
  try {
    await historialEnVuelo
  } finally {
    historialEnVuelo = null
  }
}

let catalogoPanelesCargado = false
async function cargarCatalogoPaneles() {
  if (catalogoPanelesCargado) return
  try {
    // obtenerRivales() ya filtra el resultado de obtenerTemporadas(); pedirlo
    // aparte era un segundo HTTP idéntico. Ambos están cacheados en api.js.
    const todas = await obtenerTemporadas()
    const filas = Array.isArray(todas) ? todas : []
    temporadasRiver.value = filas.filter((t) => t.es_river)
    catalogoPanelesCargado = true
  } catch { /*noop*/ }
}

async function refrescarPaneles() {
  await Promise.all([refrescarHistorial(), cargarCatalogoPaneles()])
}

function toggleSonido() {
  sonidoOn.value = !sonidoOn.value
  setSonido(sonidoOn.value)
  localStorage.setItem('sonido', sonidoOn.value ? '1' : '0')
}

function irATorneo() {
  mostrarTorneo.value = true
  document.getElementById('torneo-wrap')?.scrollIntoView({ behavior: 'smooth' })
}

function atajosTeclado(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === 'Escape' && confirmarReinicio.value) {
    confirmarReinicio.value = false
    return
  }
  if (e.target?.matches?.('input, textarea, select, button')) return
  if (e.key === 'Escape' && seleccionado.value) {
    seleccionado.value = null
    return
  }
  if ((e.key === 't' || e.key === 'T') && partidaId.value &&
      !sorteo.value && !cargando.value && !draftCerrado.value && !plantelListo.value) {
    e.preventDefault()
    tirar()
  }
}
onMounted(() => {
  window.addEventListener('keydown', atajosTeclado)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', atajosTeclado)
  document.removeEventListener('pointerdown', cerrarTipFuera)
  window.removeEventListener('scroll', cerrarTipScroll, true)
  window.removeEventListener('resize', cerrarTipScroll)
  window.removeEventListener('hashchange', abrirInfoSiCorresponde)
})

onMounted(async () => {
  document.addEventListener('pointerdown', cerrarTipFuera)
  window.addEventListener('scroll', cerrarTipScroll, true)
  window.addEventListener('resize', cerrarTipScroll)
  window.addEventListener('hashchange', abrirInfoSiCorresponde)
  abrirInfoSiCorresponde()
  sonidoOn.value = localStorage.getItem('sonido') !== '0'
  setSonido(sonidoOn.value)
  try {
    catalogo.value = await obtenerFormaciones()
  } catch {
    error.value = 'No se pudo cargar el catálogo. Revisá la conexión con el servicio de datos.'
    return
  }
  nombreEquipo.value = NOMBRE_FIJO
  formacion.value = localStorage.getItem('formacion') || '4-4-2'
  estilo.value = localStorage.getItem('estilo') || 'equilibrado'
  anchura.value = localStorage.getItem('anchura') || 'equilibrado'
  almanaque.value = localStorage.getItem('almanaque') === '1'
  modo.value = localStorage.getItem('modo') || 'normal'
  formato.value = localStorage.getItem('formato') || 'copa'
  const guardada = Number(localStorage.getItem('partidaId'))
  // cargarPartida() ya refresca el historial; hacerlo acá también duplicaba
  // el pedido en cada F5 con partida guardada.
  if (guardada) {
    await cargarPartida(guardada)
  } else {
    await refrescarPaneles()
  }
})
</script>

<template>
  <section class="draft">
    <section class="intro-panel">
      <div class="hero-grid">
        <div class="hero-copy">
          <div class="eyebrow">{{ partidaId ? nombreEquipo : 'Nueva partida' }}</div>
          <h1>Armá tu 11 <em>histórico de River.</em></h1>
          <p class="hero-lead">Elegí una idea de juego, sorteá planteles de época y armá el XI que va a defender tu camiseta en el Monumental.</p>
        </div>
        <div class="hero-side">
          <span class="season-chip"><i aria-hidden="true"></i> Archivo histórico · 3A1</span>
          <div class="intro-stat">
            <div class="intro-stat-text">
              <strong>{{ equipo.length }}<span>/{{ totalPlantel || 11 }}</span></strong>
              <small>Jugadores elegidos</small>
            </div>
            <img :src="escudoMio()" alt="" class="intro-crest" loading="lazy" @error="(e) => e.target.remove()" />
          </div>
        </div>
      </div>
      <div class="rail-row">
        <ol class="rail-draft">
          <li v-for="(nombrePaso, i) in pasosDraft" :key="nombrePaso"
              :class="{ activo: paso === i + 1, hecho: paso > i + 1 }">
            <span class="rail-dot">{{ paso > i + 1 ? '✓' : i + 1 }}</span>
            <span>{{ nombrePaso }}</span>
          </li>
        </ol>
        <p class="next-step"><span>Siguiente paso</span>{{ siguientePaso }}</p>
      </div>
      <div v-if="partidaId" class="continuar-card">
        <div class="continuar-texto">
          <small>Continuar donde lo dejaste</small>
          <strong>{{ nombreEquipo }}</strong>
          <span class="muted small">{{ nombreFormato }} · {{ draftEstado }}</span>
        </div>
        <button class="btn primary" @click="draftCerrado ? irATorneo() : irADraft()">
          {{ draftCerrado ? 'Ir a mi torneo →' : 'Seguir armando →' }}
        </button>
      </div>
    </section>

    <div v-if="tieneCatalogo" class="mobile-steps" role="tablist" aria-label="Pasos del draft">
      <button v-for="p in PASOS_MOBILE" :key="p.id" type="button" role="tab"
              :aria-selected="pasoMobile === p.id" :class="{ on: pasoMobile === p.id }"
              @click="pasoMobile = p.id">
        <span class="paso-num">{{ p.num }}</span>{{ p.label }}
      </button>
    </div>

    <div v-if="tieneCatalogo" id="workspace" class="workspace" :class="'paso-' + pasoMobile">
      <!-- Izquierda: planteo + sorteo -->
      <aside class="setup-column">
        <section id="configuracion" class="card setup-card">
          <div class="card-heading"><div><h2>Tu planteo</h2></div>
            <button v-if="!partidaId" class="live-pill live-pill-button" type="button" @click="irAConfig" title="Ir a la configuración">
              <span aria-hidden="true">⚙</span> Configuración
            </button>
            <span v-else class="live-pill">{{ nombreEquipo }}</span>
          </div>
          <template v-if="!partidaId">
            <p class="card-description">Definí cómo querés jugar antes de empezar el sorteo. Tu equipo es siempre <strong>River Plate</strong>.</p>
            <!-- El escudo es la primera decisión: queda fijo para toda la partida. -->
            <div class="control-group escudo-elegir">
              <label>Escudo de River Plate <span class="muted small">· lo primero que elegís</span></label>
              <button class="escudo-cambiar" type="button" :aria-expanded="escudosAbiertos"
                      @click="escudosAbiertos = !escudosAbiertos">
                <img :src="escudoMioUrl" alt="escudo actual" />
                <span>Escudo actual · {{ escudosAbiertos ? 'ocultar opciones' : 'cambiar' }}</span>
                <b aria-hidden="true">{{ escudosAbiertos ? '▴' : '▾' }}</b>
              </button>
              <div class="escudos-grid" :class="{ abierta: escudosAbiertos }">
                <button v-for="e in escudosRiver" :key="e.url" type="button" class="escudo-opcion"
                        :class="{ selected: escudoMioUrl === e.url }"
                        :title="`Escudo ${e.label}`" :aria-label="`Elegir escudo ${e.label}`"
                        :aria-pressed="escudoMioUrl === e.url" @click="elegirEscudoMio(e.url)">
                  <img :src="e.url" :alt="e.label" loading="lazy" />
                  <span>{{ e.label }}</span>
                </button>
              </div>
            </div>
            <div class="control-group">
              <label>Modo de partida</label>
              <div class="choice-row mode-row">
                <button :class="{ selected: modo === 'normal' }" v-bind="tipHandlers" data-tip="Una partida, una competencia. Empezás de cero." @click="modo = 'normal'">Normal</button>
                <button :class="{ selected: modo === 'carrera' }" v-bind="tipHandlers" data-tip="Encadenás torneos: al terminar conservás cinco jugadores." @click="modo = 'carrera'">Carrera</button>
              </div>
            </div>
            <div class="control-group">
              <label>Formato</label>
              <div class="choice-row mode-row">
                <button :class="{ selected: formato === 'copa' }" v-bind="tipHandlers" :data-tip="TIP_FORMATO.copa" @click="formato = 'copa'">Mundial</button>
                <button :class="{ selected: formato === 'premier' }" v-bind="tipHandlers" :data-tip="TIP_FORMATO.premier" @click="formato = 'premier'">Premier</button>
                <button :class="{ selected: formato === 'liga30' }" v-bind="tipHandlers" :data-tip="TIP_FORMATO.liga30" @click="formato = 'liga30'">Argentina</button>
              </div>
            </div>
            <div class="control-group">
              <label>Formación</label>
              <div class="choice-grid formations">
                <button v-for="(_, nombre) in catalogo.formaciones" :key="nombre" :class="{ selected: formacion === nombre }" v-bind="tipHandlers" :data-tip="tipFormacion(nombre)" @click="formacion = nombre">{{ nombre }}</button>
              </div>
            </div>
            <div class="control-group">
              <label>Mentalidad</label>
              <div class="choice-row">
                <button v-for="e in catalogo.estilos" :key="e" :class="{ selected: estilo === e }" v-bind="tipHandlers" :data-tip="TIP_ESTILO[e] ?? 'Elegí cómo planteás el partido.'" @click="estilo = e">{{ e }}</button>
              </div>
            </div>
            <div class="control-group">
              <label>Planteo</label>
              <div class="choice-row">
                <button v-for="a in ANCHOS" :key="a.valor" :class="{ selected: anchura === a.valor }"
                        v-bind="tipHandlers" :data-tip="a.tip" @click="anchura = a.valor">{{ a.etiqueta }}</button>
              </div>
            </div>
            <div class="control-group">
              <label>Modo · dificultad</label>
              <div class="choice-row mode-row">
                <button :class="{ selected: !almanaque }" v-bind="tipHandlers" data-tip="Ves el OVR de todos los jugadores." @click="almanaque = false">Clásico</button>
                <button :class="{ selected: almanaque }" v-bind="tipHandlers" data-tip="Jugás a ciegas: sin OVR ni promedios." @click="almanaque = true">De Memoria</button>
              </div>
            </div>
            <p class="config-resumen" aria-label="Resumen de la configuración">{{ resumenConfig }}</p>
            <div class="config-actions">
              <button class="primary-button" @click="comenzarPartida">Crear partida <span>→</span></button>
            </div>
          </template>
          <template v-else>
            <div class="equipo-identidad">
              <img :src="escudoMioUrl" alt="Escudo de River Plate" />
              <div>
                <strong>River Plate</strong>
                <span>{{ formacion }} · {{ estilo }} · {{ anchura }}{{ almanaque ? ' · de memoria' : '' }} · {{ nombreFormato }}</span>
              </div>
            </div>
            <p class="card-description">Una tirada, un jugador. Cada decisión es definitiva.</p>
            <p class="muted small">Para cambiar de formato (Mundial / Premier / Argentina), tocá “Nueva partida”.</p>
            <div v-if="sorteo" class="sorteo-box">
              <span class="eyebrow">Plantel sorteado</span>
              <div class="sorteo-head">
                <img v-if="escudoSorteo" :src="escudoSorteo" alt="escudo de época del plantel sorteado"
                     class="sorteo-escudo" loading="lazy" @error="(e) => e.target.remove()" />
                <div>
                  <strong>{{ sorteo.club }} {{ sorteo.anio_orden }}</strong>
                  <span class="muted small">{{ sorteo.etiqueta }} · {{ sorteo.formacion }}</span>
                </div>
              </div>
            </div>
            <p v-else class="muted small">Tirá para sortear un plantel histórico de River. Pases: {{ pasesRestantes }}/{{ maxPases }}.</p>
            <template v-if="sorteo">
              <div id="mazo" class="control-group">
                <label>Plantel · elegí un jugador</label>
                <div v-if="sorteo && !cargando" class="mazo-filtros">
                  <input v-model="buscarMazo" type="search" placeholder="Buscar jugador…" aria-label="Buscar en el mazo" />
                  <select v-model="filtroPos" aria-label="Filtrar mazo por posición">
                    <option value="">Todas</option>
                    <option v-for="p in [...new Set(Object.values(LINEAS).flat())]" :key="p" :value="p">{{ p }}</option>
                  </select>
                </div>
                <ul v-if="cargando" class="candidatos">
                  <li v-for="n in 5" :key="n" class="skel"><span></span></li>
                </ul>
                <ul v-else-if="plantel.length && plantelFiltrado.length" class="candidatos">
                  <template v-for="(item, idx) in plantelLista" :key="item.header ?? item.jugador.temporada_jugador_id">
                    <li v-if="item.header" class="grupo-head"><span>{{ item.header }} · {{ item.count }}</span></li>
                    <li v-else
                        :class="{ sel: seleccionado?.temporada_jugador_id === item.jugador.temporada_jugador_id, blocked: bloqueado(item.jugador) }"
                        :style="{ animationDelay: Math.min(idx * 40, 400) + 'ms' }"
                        draggable="true"
                        @dragstart="dragCandidato($event, item.jugador)"
                        @click="clickJugador(item.jugador)">
                      <img v-if="fotoDe(item.jugador)" :src="fotoDe(item.jugador)" :alt="item.jugador.nombre" class="foto" loading="lazy" @error="(e) => fallbackInicial(e, item.jugador, 'foto inicial')" />
                      <span v-else class="foto inicial">{{ item.jugador.nombre.charAt(0) }}</span>
                      <div class="cand-main">
                        <div class="cand-top">
                          <strong :class="{ gold: item.jugador.es_mvp, silver: !item.jugador.es_mvp && item.jugador.es_estrella }">{{ item.jugador.nombre }}</strong>
                          <span class="badge" :class="{ goldbg: item.jugador.es_mvp, silverbg: !item.jugador.es_mvp && item.jugador.es_estrella }" v-if="marca(item.jugador)">{{ marca(item.jugador) }}</span>
                          <span v-if="esFotoEpoca(item.jugador)" class="epoca" :title="item.jugador.foto_fuente ?? ''">📷 {{ anioFotoDe(item.jugador, item.jugador.anio_orden) }}</span>
                        </div>
                        <div class="muted small">
                          {{ item.jugador.posicion_natural }}<span v-if="secundarias(item.jugador).length"> · {{ secundarias(item.jugador).join(', ') }}</span><span v-if="anioDe(item.jugador)"> · {{ anioDe(item.jugador) }}</span>
                        </div>
                        <div v-if="bloqueado(item.jugador)" class="motivo">{{ motivoBloqueo(item.jugador) }}</div>
                        <div v-else-if="!esFaseBanco && slotsDe(item.jugador).length" class="chips">
                          <button v-for="sl in slotsDe(item.jugador)" :key="sl" class="chip" @click.stop="chipElegir(item.jugador, sl)" @mousedown.stop>{{ sl }}</button>
                        </div>
                        <div v-else-if="esFaseBanco" class="chips">
                          <button class="chip banco" @click.stop="clickJugador(item.jugador)">Al banco →</button>
                        </div>
                      </div>
                      <div v-if="!almanaque" class="cand-ovr" :title="`OVR ${item.jugador.ovr_final}`"><strong>{{ item.jugador.ovr_final }}</strong><small>OVR</small></div>
                    </li>
                  </template>
                </ul>
                <p v-else-if="plantel.length" class="muted small">Ningún jugador coincide con el filtro.</p>
                <p v-else class="muted small">Nada útil acá. Tocá “Pasar”.</p>
              </div>
            </template>
          </template>
        </section>

        <section v-if="partidaId && !plantelListo" id="tirar" class="card draw-card">
          <div class="draw-icon">0{{ paso }}</div>
          <div v-if="cargando && cartasFlip.length" class="mazo-flip" aria-hidden="true">
            <div v-for="(carta, i) in cartasFlip" :key="i" class="carta-flip" :class="{ abierta: carta.abierta }" :style="{ '--i': i }">
              <div class="cara dorso">3A1</div>
              <div class="cara frente">⚽</div>
            </div>
          </div>
          <button v-if="partidaId" class="primary-button" :class="{ rolling: cargando }" :disabled="cargando || !!sorteo || draftCerrado" @click="tirar({ scroll: true })">{{ cargando ? dadoFace : 'Tirar' }} <span>🎲</span></button>
          <button v-if="sorteo" class="ghost-button" :disabled="cargando || (pasesRestantes <= 0 && plantelAporta)" @click="pasar">Pasar {{ plantelAporta ? '(' + pasesRestantes + ')' : '(gratis)' }}</button>
          <button v-if="puedeReroll" class="ghost-button" :disabled="cargando" @click="reroll" title="El año no aporta a posiciones faltantes: sortear otro gratis">Resortear gratis (1)</button>
          <p v-if="sorteo && !plantelAporta" class="muted small">Este año no aporta a tu XI: “Pasar” es gratis y no consume tus {{ pasesRestantes }} pases.</p>
        </section>

      </aside>

      <!-- Centro: cancha -->
      <section id="pitch" class="pitch-column">
        <div class="section-kicker"><span>02</span><span>Tu cancha</span><span class="line"></span><span class="muted">{{ formacion }} · {{ estilo.toLowerCase() }} · {{ anchura.toLowerCase() }}</span></div>
        <div v-if="suplentes.length" class="tabs">
          <button :class="{ selected: vistaCancha === 'XI' }" @click="vistaCancha = 'XI'">XI ({{ once.length }})</button>
          <button :class="{ selected: vistaCancha === 'Banco' }" @click="vistaCancha = 'Banco'">Banco ({{ suplentes.length }}/{{ bancoTope }})</button>
        </div>
        <p v-if="esFaseBanco && seleccionado" class="pick-hint">
          {{ seleccionado.nombre }}<span v-if="anioDe(seleccionado)" class="muted"> · {{ anioDe(seleccionado) }}</span> → guardando en el banco…
        </p>
        <p v-else-if="seleccionado" class="pick-hint">
          {{ seleccionado.nombre }}<span v-if="anioDe(seleccionado)" class="muted"> · {{ anioDe(seleccionado) }}</span> → tocá un punto <strong class="resaltado">rojo</strong>.
          <span class="muted">Va en: {{ slotsDelSeleccionado.join(', ') || '—' }}</span>
          <span class="muted">Ocupados: {{ slots.filter((s) => equipoPorSlot[s.slot]).map((s) => s.slot).join(', ') || '—' }}</span>
        </p>
        <p v-if="jugadorInfo" class="jugador-info" role="status">👤 {{ jugadorInfo.nombre }} · {{ jugadorInfo.anio }}</p>
        <p v-if="guardadoOk" class="guardado-ok">{{ guardadoOk }}</p>
        <div v-if="vistaCancha === 'XI'" class="pitch-wrap">
          <div class="pitch">
            <div class="pitch-line halfway"></div><div class="pitch-line center-circle"></div><div class="pitch-line penalty-top"></div><div class="pitch-line penalty-bottom"></div><div class="pitch-line goal-top"></div><div class="pitch-line goal-bottom"></div>
            <div v-for="s in slots" :key="s.slot"
                 class="player-slot"
                 :class="{
                   filled: equipoPorSlot[s.slot],
                   ocupado: !!sorteo && !!equipoPorSlot[s.slot],
                   sinhueco: !!sorteo && !!seleccionado && !!equipoPorSlot[s.slot] && esCompatible(seleccionado, s.slot) && slotsDelSeleccionado.length === 0,
                   justpicked: ultimoPick === s.slot,
                   soltar: destinoDrop === s.slot,
                   open: sorteo && seleccionado && !equipoPorSlot[s.slot] && esCompatible(seleccionado, s.slot),
                   capitan: capitanId === equipoPorSlot[s.slot]?.temporada_jugador_id,
                   estrella: !!equipoPorSlot[s.slot]?.es_mvp || !!equipoPorSlot[s.slot]?.es_estrella,
                   dorsalpuesto: dorsalDe(equipoPorSlot[s.slot]) !== null
                 }"
                 :style="{ left: coord(s.slot)[0] + '%', top: coord(s.slot)[1] + '%' }"
                 :title="tituloSlot(equipoPorSlot[s.slot], s.slot)"
                 :draggable="!!equipoPorSlot[s.slot] && puedeArrastrar"
                 @dragstart="dragFicha($event, s.slot)"
                 @dragend="finArrastre"
                 @dragover="sobreSlot($event, s.slot)"
                 @dragleave="salirSlot(s.slot)"
                 @drop="soltarEnSlot($event, s.slot)"
                 @click="clickSlot(s.slot)">
              <template v-if="equipoPorSlot[s.slot]">
                <img v-if="fotoDe(equipoPorSlot[s.slot])" :src="fotoDe(equipoPorSlot[s.slot])"
                     :alt="equipoPorSlot[s.slot].nombre" class="foto-slot" loading="lazy"
                     @error="(e) => fallbackInicial(e, equipoPorSlot[s.slot], 'ini foto-ini')" />
                <span v-else class="ini foto-ini">{{ equipoPorSlot[s.slot].nombre.charAt(0) }}</span>
                <span class="dorsal-slot">{{ dorsalDe(equipoPorSlot[s.slot]) ?? s.pos }}</span>
                <span v-if="!almanaque" class="slot-ovr">{{ equipoPorSlot[s.slot].ovr_final }}</span>
                <small class="tag" :class="{ goldtag: equipoPorSlot[s.slot]?.es_mvp, silvertag: equipoPorSlot[s.slot] && !equipoPorSlot[s.slot].es_mvp && equipoPorSlot[s.slot].es_estrella }">{{ equipoPorSlot[s.slot].nombre }}</small>
                <span v-if="capitanId === equipoPorSlot[s.slot]?.temporada_jugador_id" class="capt">©</span>
              </template>
              <template v-else>
                <span class="slot-pos">{{ s.pos }}</span>
                <small class="slot-rol">{{ POS_NOMBRE[s.pos] ?? 'Jugador' }}</small>
              </template>
            </div>
          </div>
        </div>
        <div v-if="vistaCancha === 'Banco'" class="banco-panel" :class="{ soltar: destinoBanco }"
             @dragover="sobreBanco($event)" @dragleave="destinoBanco = false" @drop="soltarEnBanco">
          <div v-for="j in suplentes" :key="j.temporada_jugador_id" class="banco-card"
               :class="{ soltar: destinoDrop === j.slot, mejora: !!mejoraDeSuplente(j) }"
               :draggable="puedeArrastrar"
               @dragstart="dragFicha($event, j.slot)"
               @dragend="finArrastre"
               @dragover="sobreSlot($event, j.slot)"
               @dragleave="salirSlot(j.slot)"
               @drop="soltarEnSup($event, j.slot)"
               @click="verJugador(j)">
            <strong>{{ j.slot }}</strong>
            <span class="dorsal-mini" :class="{ puesta: dorsalDe(j) !== null }">#{{ dorsalDe(j) ?? '—' }}</span>
            <span>{{ j.posicion_natural }}</span>
            <em :class="{ gold: j.es_mvp, silver: !j.es_mvp && j.es_estrella }">{{ j.nombre }}<img v-if="escudoAnioDe(j)" :src="escudoAnioDe(j)" alt="" class="escudo-anio" loading="lazy" @error="(e) => e.target.remove()" />{{ anioNumeroDe(j) ? ' ' + anioNumeroDe(j) : (anioDe(j) ? ' ' + anioDe(j) : '') }}</em>
            <span class="banco-foto">
              <img v-if="fotoDe(j)" :src="fotoDe(j)" :alt="j.nombre" loading="lazy"
                   @error="(e) => fallbackInicial(e, j, 'ini banco-ini')" />
              <span v-else class="ini banco-ini">{{ j.nombre.charAt(0) }}</span>
            </span>
            <button v-if="mejoraDeSuplente(j)" class="mejor-que" type="button" draggable="false"
                    :disabled="!puedeArrastrar" @mousedown.stop @dragstart.stop.prevent
                    @click.stop="subirSuplente(j)">
              ↑ Mejor que {{ mejoraDeSuplente(j).nombre }} ({{ mejoraDeSuplente(j).ovr_final }}) · cambiar
            </button>
          </div>
          <p v-if="!suplentes.length" class="banco-note">Banco vacío: completá el XI primero.</p>
          <p v-if="suplentes.length && codigosSinRelevo().length" class="banco-note warn">Sin relevo para: {{ codigosSinRelevo().join(', ') }}</p>
          <p class="banco-note">Los cambios se hacen entre partidos, en la sección del torneo.</p>
        </div>
        <div class="pitch-footer"><span class="pitch-equipo"><img :src="escudoMio()" alt="escudo de River Plate" loading="lazy" @error="(e) => e.target.remove()" /> River Plate</span><span>{{ plantelListo ? 'Plantel completo' : draftCerrado ? 'Plantel cerrado' : esFaseBanco ? `Banco ${suplentes.length}/${bancoTope}` : 'Plantel por completar' }}</span><span>{{ equipo.length }} / {{ totalPlantel }}</span></div>
      </section>

      <!-- Derecha: marcador. El resumen del plantel vive acá para que la
           columna izquierda quede corta y ambas columnas queden parejas. -->
      <aside class="score-column">
        <section v-if="!partidaId || plantelListo" class="card resumen-final">
          <div class="resumen-head">
            <div><span class="eyebrow">Plantel completo</span><h2>{{ draftCerrado ? 'Plantel cerrado' : 'Listo para jugar' }}</h2></div>
            <div class="resumen-ovr"><strong>{{ ovrVisible }}</strong><span>OVR</span></div>
          </div>
          <dl class="resumen-datos">
            <div><dt>Formación</dt><dd>{{ formacion }}</dd></div>
            <div><dt>Mentalidad</dt><dd>{{ estilo.charAt(0).toUpperCase() + estilo.slice(1) }}</dd></div>
            <div><dt>Planteo</dt><dd>{{ ANCHOS.find((a) => a.valor === anchura)?.etiqueta ?? anchura }}</dd></div>
            <div><dt>Capitán</dt><dd>{{ capitan?.nombre ?? 'Sin elegir' }}</dd></div>
            <div><dt>Banco</dt><dd>{{ suplentes.length }}/{{ bancoTope }}</dd></div>
          </dl>
          <p class="muted small">{{ draftCerrado ? 'Ya podés jugar tu torneo acá abajo.' : 'Cuando termines, tocá “Salir a jugar” al final de este panel.' }}</p>
        </section>
        <section class="card score-card">
          <div class="card-heading"><div><span class="step-number">03</span><h2>Tu marcador</h2></div><button class="sound-button" aria-label="Sonido" @click="toggleSonido">{{ sonidoOn ? '◒' : '✕' }}</button></div>
          <div class="score-hero">
            <div class="score-main"><strong>{{ ovrVisible }}</strong><span class="score-state" :class="{ ok: plantelListo }">{{ estadoMarcador }}</span></div>
            <p>OVR del equipo</p>
          </div>
          <div class="metric"><span>Ataque</span><b>{{ almanaque ? '—' : ataque }}</b><div class="metric-track"><i :style="{ width: Math.min(100, Math.max(0, (ataque - 60) * 2.5)) + '%' }"></i></div></div>
          <div class="metric"><span>Medio</span><b>{{ almanaque ? '—' : medio }}</b><div class="metric-track"><i :style="{ width: Math.min(100, Math.max(0, (medio - 60) * 2.5)) + '%' }"></i></div></div>
          <div class="metric"><span>Defensa</span><b>{{ almanaque ? '—' : defensa }}</b><div class="metric-track"><i :style="{ width: Math.min(100, Math.max(0, (defensa - 60) * 2.5)) + '%' }"></i></div></div>
          <div class="squad-list">
            <template v-for="(s, i) in slots" :key="s.slot">
              <div class="squad-row" :class="{ active: slotActivo === s.slot, vacio: !equipoPorSlot[s.slot] }" @click="clickSlot(s.slot)">
                <span>{{ String(i + 1).padStart(2, '0') }}</span><b>{{ s.slot }}</b>
                <em v-if="equipoPorSlot[s.slot]" :class="{ gold: equipoPorSlot[s.slot].es_mvp, silver: !equipoPorSlot[s.slot].es_mvp && equipoPorSlot[s.slot].es_estrella }">{{ equipoPorSlot[s.slot].nombre }}<img v-if="escudoAnioDe(equipoPorSlot[s.slot])" :src="escudoAnioDe(equipoPorSlot[s.slot])" alt="" class="escudo-anio" loading="lazy" @error="(e) => e.target.remove()" />{{ anioNumeroDe(equipoPorSlot[s.slot]) ? ' ' + anioNumeroDe(equipoPorSlot[s.slot]) : (anioDe(equipoPorSlot[s.slot]) ? ' ' + anioDe(equipoPorSlot[s.slot]) : '') }}</em>
                <em v-else class="sin-jugador">Sin jugador</em>
                <span class="squad-actions">
                  <button v-if="equipoPorSlot[s.slot]" class="dorsalbtn" title="Elegir dorsal"
                          @click.stop="abrirDorsal(s.slot)">
                    {{ dorsalDe(equipoPorSlot[s.slot]) ?? '#' }}
                  </button>
                  <button v-if="equipoPorSlot[s.slot]" class="captbtn" title="Capitán"
                          :class="{ on: capitanId === equipoPorSlot[s.slot].temporada_jugador_id,
                                     faltacap: resaltarCierre === 'capitan' }"
                          @click.stop="toggleCapitan(equipoPorSlot[s.slot].temporada_jugador_id)">©</button>
                  <span class="squad-state" :class="{ on: !!equipoPorSlot[s.slot] }" aria-hidden="true"></span>
                </span>
              </div>
              <div v-if="editDorsal === s.slot" class="dorsal-edit">
                <span>Dorsal {{ s.slot }}</span>
                <input v-model="dorsalInput" type="number" min="1" max="99" inputmode="numeric" placeholder="1–99"
                       @keyup.enter="guardarDorsal(s.slot)" />
                <button class="btn primary small-btn" @click="guardarDorsal(s.slot)">OK</button>
                <button v-if="dorsalDe(equipoPorSlot[s.slot]) !== null" class="btn ghost small-btn" @click="limpiarDorsal(s.slot)">Quitar</button>
                <button class="btn ghost small-btn" @click="cerrarDorsal">✕</button>
              </div>
            </template>
          </div>
          <button v-if="partidaId && equipo.length" class="ghost-button" :class="{ aplicado: dorsalesAutoOn }" @click="dorsalesAuto">
            {{ dorsalesAutoOn ? `Dorsales auto ✓ (1–${equipo.length})` : `Dorsales auto (1–${equipo.length})` }}
          </button>
          <button v-if="partidaId && (capitan || capitanSugerido)" class="ghost-button capitan-btn"
                  :class="{ aplicado: !!capitan }"
                  :title="capitan ? 'Tocá para quitar el capitán y elegir otro' : 'Elegí al MVP/estrella o, si no hay, al mejor OVR del XI'"
                  @click="accionCapitan">
            {{ capitan ? `Capitán: ${capitan.nombre} ✓ · Cambiar` : `Capitán sugerido: ${capitanSugerido.nombre}` }}
          </button>
          <div v-if="partidaId && equipo.length" class="checklist-cierre" aria-label="Faltan estos pasos para jugar">
            <span v-for="it in checklistCierre" :key="it.clave" :class="{ ok: it.ok }">{{ it.ok ? '✓' : '○' }} {{ it.texto }}</span>
          </div>
          <div v-if="suplentes.length" class="squad-list banco-list">
            <div class="banco-head">Banco · {{ suplentes.length }}/{{ bancoTope }}</div>
            <div v-for="j in suplentes" :key="j.temporada_jugador_id" class="squad-row suplente"
                 :class="{ 'con-mejora': !!mejoraDeSuplente(j) }" @click="verJugador(j)">
              <span>{{ j.slot }}</span><b>{{ j.posicion_natural }}</b>
              <em :class="{ gold: j.es_mvp, silver: !j.es_mvp && j.es_estrella }">{{ j.nombre }}<img v-if="escudoAnioDe(j)" :src="escudoAnioDe(j)" alt="" class="escudo-anio" loading="lazy" @error="(e) => e.target.remove()" />{{ anioNumeroDe(j) ? ' ' + anioNumeroDe(j) : (anioDe(j) ? ' ' + anioDe(j) : '') }}</em>
              <span class="dorsal-mini" :class="{ puesta: dorsalDe(j) !== null }">#{{ dorsalDe(j) ?? '—' }}</span>
              <span class="squad-foto">
                <img v-if="fotoDe(j)" :src="fotoDe(j)" :alt="j.nombre" loading="lazy"
                     @error="(e) => fallbackInicial(e, j, 'ini squad-ini')" />
                <span v-else class="ini squad-ini">{{ j.nombre.charAt(0) }}</span>
              </span>
              <button v-if="mejoraDeSuplente(j)" class="mejor-que" type="button" :disabled="!puedeArrastrar"
                      @click.stop="subirSuplente(j)">
                ↑ Mejor que {{ mejoraDeSuplente(j).nombre }} ({{ mejoraDeSuplente(j).ovr_final }}) · cambiar
              </button>
            </div>
            <p v-if="lineasFaltantes().length" class="muted small">Falta cubrir: {{ lineasFaltantes().join(', ') }}</p>
          </div>
          <button v-if="partidaId && plantelListo && !draftCerrado" class="primary-button" @click="cerrarDraft">Salir a jugar <span>→</span></button>
          <p v-if="errorCierre" class="error-cierre" role="alert">{{ errorCierre }}</p>
          <button v-if="draftCerrado && (mostrarMundial || mostrarLiga)" class="primary-button" @click="jugarTorneo">Jugar {{ nombreFormato }} <span>→</span></button>
          <button v-if="draftCerrado && !mostrarMundial && !mostrarLiga" class="primary-button" @click="jugarTorneo">Jugar torneo <span>→</span></button>
          <button v-if="partidaId" class="nueva-partida" type="button" @click="confirmarReinicio = true">Nueva partida</button>
        </section>
      </aside>
    </div>


    <div v-if="!tieneCatalogo" class="panel">
      <p class="muted">Cargando formaciones…</p>
    </div>

    <!-- Torneo: Mundial 32 (copa) o ligas (premier/liga30) -->
    <div id="torneo-wrap">
    <MundialSection v-if="mostrarTorneo && mostrarMundial && partidaId" ref="mundialRef"
      :equipo="equipo" :estilo="estilo" :anchura="anchura" :capitan="capitan" :partida-id="partidaId"
      :nombre-equipo="nombreEquipo" :formacion="formacion"
      :almanaque="almanaque" :formaciones="catalogo.formaciones" :todas="catalogo.todas"
      @fin="onFinMundial" @equipo="onEquipoMundial" />
    <LigaSection v-if="mostrarTorneo && mostrarLiga && partidaId" ref="ligaRef"
      :equipo="equipo" :estilo="estilo" :anchura="anchura" :capitan="capitan" :partida-id="partidaId"
      :nombre-equipo="nombreEquipo" :formacion="formacion"
      :almanaque="almanaque" :formaciones="catalogo.formaciones" :todas="catalogo.todas"
      :formato="formato"
      @fin="onFinLiga" @equipo="onEquipoLiga" />
    <TorneoSection v-if="mostrarTorneo && !mostrarMundial && !mostrarLiga && partidaId" ref="torneoRef"
      :equipo="equipo" :estilo="estilo" :anchura="anchura" :capitan="capitan" :partida-id="partidaId"
      :almanaque="almanaque" :nombre-equipo="nombreEquipo" :formaciones="catalogo.formaciones" :todas="catalogo.todas"
      @fin="onFinTorneo" />
    </div>

    <!-- Keepers de carrera -->
    <div v-if="torneoFin && modo === 'carrera'" class="panel">
      <h2>Elegí 5 para conservar al próximo torneo</h2>
      <div class="pills">
        <button v-for="j in equipo" :key="j.temporada_jugador_id" class="pill"
                :class="{ on: keepersPick.includes(j.temporada_jugador_id) }"
                @click="keepersPick.includes(j.temporada_jugador_id)
                  ? keepersPick = keepersPick.filter((x) => x !== j.temporada_jugador_id)
                  : keepersPick.length < 5 && keepersPick.push(j.temporada_jugador_id)">
          {{ j.slot }} · {{ j.nombre }}
        </button>
      </div>
      <button class="btn primary" :disabled="keepersPick.length !== 5" @click="guardarKeepers">
        Guardar 5 ({{ keepersPick.length }}/5)
      </button>
    </div>

    <button class="mobile-info-toggle" type="button" :aria-expanded="infoAbierta"
            @click="infoAbierta = !infoAbierta">
      {{ infoAbierta ? 'Ocultar más info' : 'Más info: equipos, partidas y logros' }}
      <span aria-hidden="true">{{ infoAbierta ? '▴' : '▾' }}</span>
    </button>
    <div class="info-extra" :class="{ abierto: infoAbierta }">
    <div class="grid2">
      <RivalesPanel :almanaque="almanaque" compacto @ir-todos="emit('ir-rivales')" />

      <div class="panel" id="legado">
        <h2><span class="h-bar"></span>Últimas partidas</h2>
        <p class="muted small hist-aclaracion">Las partidas que no terminaste aparecen marcadas como “Sin terminar”.</p>
        <ul v-if="historial.length" class="hist">
          <li v-for="h in historialVisibles" :key="h.id" class="hist-card">
            <button class="hist-resumen" type="button" :aria-expanded="resumenAbierto === h.id"
                    @click="alternarResumen(h.id)">
              <span class="chev" aria-hidden="true">{{ resumenAbierto === h.id ? '▾' : '▸' }}</span>
              <span class="hist-resumen-titulo">
                <strong>#{{ h.id }} {{ h.nombre_equipo }}</strong>
                <small>{{ h.formacion }} · {{ h.elegidos }}/11 · {{ resumenAbierto === h.id ? 'ocultar XV' : 'Ver XV' }}</small>
              </span>
              <span v-if="h.ultimo_resultado" class="hist-resumen-score">{{ h.ultimo_resultado }}</span>
              <span v-if="sinTerminar(h)" class="badge sin-terminar">Sin terminar</span>
              <span v-if="insigniaDe(h)" class="badge" :class="{ goldbg: insigniaDe(h) === '7A0' }">
                {{ insigniaDe(h) }}
              </span>
            </button>
            <ResumenPartida v-if="resumenAbierto === h.id" :partida="h" :almanaque="almanaque" resumido />
          </li>
        </ul>
        <button class="link small hist-completo" type="button" @click="emit('ir-historial')">
          Ver historial completo y detallado →
        </button>
        <div v-if="historial.length > HISTORIAL_INICIO" class="hist-pager">
          <button class="pager-btn" type="button" :disabled="historialPagina === 0"
                  aria-label="Partidas anteriores" @click="historialPagina--">
            <span aria-hidden="true">←</span> Anteriores
          </button>
          <span class="pager-label">Página {{ historialPagina + 1 }} de {{ historialPaginas }}</span>
          <button class="pager-btn" type="button" :disabled="historialPagina + 1 >= historialPaginas"
                  aria-label="Partidas siguientes" @click="historialPagina++">
            Siguientes <span aria-hidden="true">→</span>
          </button>
        </div>
        <p v-if="!historial.length" class="muted">Sin partidas todavía.</p>
        <LogrosPanel :partida-id="partidaId" />
      </div>
    </div>

    </div>

    <div v-if="tipActivo" class="tip-globo" :class="{ abajo: !tipPos.arriba }"
         :style="{ top: tipPos.top + 'px', left: tipPos.left + 'px' }" role="tooltip">
      <span class="tip-globo-label">ℹ ¿Qué hace?</span>
      <p>{{ tipActivo }}</p>
    </div>

    <p v-if="error" class="error">{{ error }} <button class="link inv" @click="reintentar">Reintentar</button></p>

    <!-- Celular: barra de elección fija. Evita bajar hasta la cancha para
         confirmar un puesto y desaparece al guardar. -->
    <div v-if="seleccionado && partidaId && !draftCerrado" class="pick-tray" role="status">
      <div class="pick-tray-main">
        <small>Elegido</small>
        <strong>{{ seleccionado.nombre }}</strong>
        <span>{{ anioDe(seleccionado) ?? '' }}</span>
      </div>
      <div v-if="esFaseBanco" class="pick-tray-actions">
        <button class="pick-tray-primary" type="button" @click="mandarAlBanco(seleccionado)">Al banco →</button>
      </div>
      <div v-else-if="slotsDelSeleccionado.length" class="pick-tray-actions">
        <button v-for="sl in slotsDelSeleccionado" :key="sl" class="pick-tray-slot"
                type="button" @click="chipElegir(seleccionado, sl)">{{ sl }}</button>
      </div>
      <div v-else class="pick-tray-actions">
        <span class="pick-tray-empty">Sin puesto libre</span>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="confirmarReinicio" class="reinicio-overlay" role="dialog" aria-modal="true"
           aria-labelledby="reinicio-titulo" @click.self="confirmarReinicio = false">
        <div class="reinicio-modal">
          <span class="eyebrow">Reiniciar</span>
          <h2 id="reinicio-titulo">¿Reiniciar?</h2>
          <p>Se pierde este plantel y volvés a la configuración inicial.</p>
          <div class="reinicio-acciones">
            <button type="button" class="reinicio-cancelar" @click="confirmarReinicio = false">Cancelar</button>
            <button type="button" class="reinicio-confirmar" @click="nuevaPartida">Sí, reiniciar</button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>

/* Globo de ayuda: notificación chica, sin velo ni blur de fondo. */
.tip-globo { position: fixed; z-index: 71; width: 244px; max-width: calc(100vw - 24px);
  padding: 9px 12px; background: var(--superficie-baja); color: var(--tinta);
  border: 1px solid #c8102e; border-radius: 8px;
  box-shadow: 0 14px 34px rgba(0,0,0,.34); --ty: -100%;
  transform: translate(-50%, var(--ty)); will-change: transform, opacity;
  animation: globo-in .16s ease-out; }
.tip-globo.abajo { --ty: 0; }
.tip-globo::after { content: ''; position: absolute; left: 50%; bottom: -7px; width: 12px; height: 12px;
  margin-left: -6px; background: var(--superficie-baja); border-right: 1px solid #c8102e; border-bottom: 1px solid #c8102e;
  transform: rotate(45deg); }
.tip-globo.abajo::after { bottom: auto; top: -7px;
  border: 0; border-left: 1px solid #c8102e; border-top: 1px solid #c8102e; }
.tip-globo-label { display: block; font: 600 10px 'JetBrains Mono', monospace; color: #c8102e; letter-spacing: .02em; }
.tip-globo p { margin: 3px 0 0; font: 400 11px/1.45 'Inter', sans-serif; }
@keyframes globo-in {
  from { opacity: 0; transform: translate(-50%, var(--ty)) scale(.94); }
  to   { opacity: 1; transform: translate(-50%, var(--ty)) scale(1); }
}
.draft { display: flex; flex-direction: column; gap: 0; width: 100%; min-width: 0; }

/* Intro editorial: titular grande + marcador de plantel + riel de pasos. */
.intro-panel { padding: 30px 0 0; }
.eyebrow { font: 600 10px var(--label); letter-spacing: .14em; color: var(--texto-suave); text-transform: uppercase; }
.eyebrow span { color: var(--rojo); margin: 0 6px; }
.hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; align-items: start; }
.hero-copy { max-width: 820px; }
.hero-copy h1 {
  margin: 10px 0 12px;
  color: var(--tinta);
  text-transform: uppercase;
  font: 700 clamp(38px, 4.4vw, 56px)/.98 var(--display);
  letter-spacing: -.025em;
}
.hero-copy h1 em { color: var(--rojo); font-style: normal; }
.hero-lead {
  max-width: 620px;
  margin: 0;
  color: var(--texto-suave);
  font: 400 15px/1.55 var(--texto);
}
.hero-side { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; padding-top: 6px; }
.season-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 9px;
  border: 1px solid var(--linea);
  border-radius: 2px;
  background: var(--nav-fondo);
  color: var(--texto-suave);
  font: 600 9px var(--label);
  letter-spacing: .08em;
  text-transform: uppercase;
  white-space: nowrap;
}
.season-chip i { width: 5px; height: 5px; border-radius: 50%; background: var(--rojo); }
.intro-stat {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 210px;
  padding: 12px 16px;
  background: var(--superficie);
  border: 1px solid var(--linea);
  border-radius: var(--radio);
}
.intro-stat-text { display: flex; flex-direction: column; gap: 1px; }
.intro-stat strong { color: var(--tinta); font: 700 36px/.9 var(--num); letter-spacing: -.02em; }
.intro-stat strong span { color: var(--texto-tenue); font: 500 17px var(--num); }
.intro-stat small { color: var(--texto-suave); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .08em; }
.intro-crest { width: 38px; height: 38px; object-fit: contain; margin-left: auto; }

.rail-row {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 22px;
  padding: 12px 16px;
  background: var(--superficie);
  border: 1px solid var(--linea);
  border-radius: var(--radio);
}
.rail-draft { display: flex; align-items: center; gap: 0; flex: 1; list-style: none; padding: 0; margin: 0; min-width: 0; }
.rail-draft li { display: flex; align-items: center; gap: 7px; flex: 1; color: var(--texto-tenue); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .07em; white-space: nowrap; }
.rail-draft li:not(:last-child):after { content: ''; flex: 1; height: 1px; margin: 0 10px; background: var(--linea); }
.rail-dot { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 1px solid var(--linea-fuerte); border-radius: 50%; font-size: 10px; flex: none; background: var(--superficie); }
.rail-draft li.hecho { color: var(--verde); }
.rail-draft li.hecho .rail-dot { background: var(--verde); border-color: var(--verde); color: #fff; }
.rail-draft li.activo { color: var(--rojo); }
.rail-draft li.activo .rail-dot { background: var(--rojo); border-color: var(--rojo); color: #fff; box-shadow: 0 0 0 3px rgba(200,16,46,.12); }
.next-step { max-width: 300px; margin: 0; font-size: 11px; color: var(--texto-suave); text-align: right; line-height: 1.35; }
.next-step span { display: inline-block; margin-right: 6px; padding: 3px 6px; border-radius: 2px; background: var(--tinta); color: var(--beige-soft); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .07em; }
.continuar-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding: 13px 16px;
  background: var(--superficie);
  border: 1px solid var(--linea);
  border-left: 3px solid var(--rojo);
  border-radius: var(--radio);
}
.continuar-texto { display: flex; flex-direction: column; gap: 1px; }
.continuar-texto small { color: var(--rojo); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .08em; }
.continuar-texto strong { font: 600 17px var(--display); text-transform: uppercase; }
/* workspace: panel izquierdo · cancha · marcador.
   Las tres columnas comparten la misma línea de partida y la misma altura:
   la tarjeta del tirador y el marcador se adaptan al alto de la cancha. */
.workspace {
  display: grid;
  grid-template-columns: minmax(270px, .82fr) minmax(460px, 1.55fr) minmax(320px, 1fr);
  gap: clamp(14px, 1.6vw, 24px);
  align-items: stretch;
  padding: 26px 0 56px;
}
.setup-column, .pitch-column, .score-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.setup-column { gap: 12px; }
.setup-column .setup-card, .score-column .score-card { flex: 1 1 auto; }
.setup-column .draw-card, .setup-column .resumen-final { flex: 0 0 auto; }
.card {
  background: var(--superficie);
  border: 1px solid var(--linea);
  border-radius: var(--radio);
  box-shadow: var(--sombra-dura);
}
.setup-card, .score-card { padding: 20px; }
.card-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-heading > div { display: flex; align-items: center; gap: 10px; }
.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 20px;
  padding: 0 5px;
  border: 1px solid var(--linea-roja);
  border-radius: 2px;
  background: var(--superficie-roja);
  color: var(--rojo);
  font: 600 9px var(--label);
  letter-spacing: .04em;
}
.setup-card h2, .score-card h2, .draw-card h2 { font: 600 21px var(--display); letter-spacing: -.01em; text-transform: uppercase; margin: 0; }
.live-pill { padding: 5px 8px; color: var(--texto-suave); border: 1px solid var(--linea); border-radius: 2px; background: var(--beige-soft); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .05em; }
.live-pill-button { display: inline-flex; align-items: center; gap: 5px; background: var(--superficie); cursor: pointer; min-height: 30px; }
.live-pill-button:hover { border-color: var(--rojo); color: var(--rojo); background: var(--superficie); }
.card-description { margin: 14px 0 16px; color: var(--texto-suave); font-size: 12px; line-height: 1.55; }
.card-description strong { color: var(--tinta); }
.equipo-identidad {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0 12px;
  padding: 9px 11px;
  border: 1px solid var(--linea);
  border-left: 3px solid var(--rojo);
  border-radius: 2px;
  background: var(--beige-soft);
}
.equipo-identidad img { width: 38px; height: 38px; object-fit: contain; flex: none; }
.equipo-identidad div { display: flex; flex-direction: column; min-width: 0; }
.equipo-identidad strong { color: var(--tinta); font: 600 16px var(--display); text-transform: uppercase; letter-spacing: .02em; }
.equipo-identidad span { color: var(--texto-tenue); font: 500 9px var(--label); letter-spacing: .04em; text-transform: uppercase; }
.team-input { width: 100%; border: 1px solid var(--linea-fuerte); border-radius: var(--radio); padding: 9px 12px; font-size: 14px; }
.control-group { padding: 14px 0; border-top: 1px solid var(--linea); }
.control-group:first-of-type { border-top: 0; }
.control-group label { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; color: var(--tinta); font: 600 10px var(--label); text-transform: uppercase; letter-spacing: .08em; }
.control-group label .muted { font-weight: 400; letter-spacing: .02em; text-transform: none; }
.choice-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
.choice-grid.formations { grid-template-columns: repeat(4, minmax(0, 1fr)); }
/* 4-2-3-1, 4-2-2-2 y 4-3-1-2 tienen siete caracteres: sin nowrap el último
   dígito baja solo a un segundo renglón. */
.formations button { text-align: center; padding: 8px 1px; font: 600 11px var(--num);
  letter-spacing: 0; white-space: nowrap; }
.choice-row { display: flex; flex-wrap: wrap; gap: 5px; }
.choice-grid button, .choice-row button {
  position: relative;
  min-width: 0;
  min-height: 40px;
  padding: 7px 10px;
  color: var(--tinta);
  background: var(--superficie);
  border: 1px solid var(--linea-fuerte);
  border-radius: 3px;
  font: 500 12px var(--texto);
  transition: background .15s ease, border-color .15s ease, color .15s ease;
  cursor: pointer;
}
.choice-grid button:hover, .choice-row button:hover { border-color: var(--rojo); color: var(--rojo); background: var(--superficie-roja); }
.choice-grid button.selected, .choice-row button.selected {
  color: #fff;
  background: var(--rojo);
  border: 1px solid var(--rojo-hondo);
  font-weight: 600;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, .16);
}
.mode-row button { flex: 1; }
.config-resumen { margin: 16px 0 0; padding: 10px 0 0; border-top: 1px solid var(--linea);
  color: var(--texto-suave); font: 600 10px var(--label); text-align: center; letter-spacing: .03em; line-height: 1.5; }
.config-actions { position: sticky; bottom: 0; z-index: 3; margin: 10px -20px -20px; padding: 10px 20px 16px;
  background: var(--superficie); border-top: 1px solid var(--linea); }
.setup-card:has(.config-actions) { padding-bottom: 76px; }
/* sorteo + mazo */
.sorteo-box { display: flex; flex-direction: column; gap: 3px; margin: 10px 0; padding: 10px 12px; background: var(--beige-soft); border: 1px solid var(--linea); border-radius: var(--radio); }
.sorteo-box .eyebrow { color: var(--rojo); font-size: 9px; }
.sorteo-box strong { font: 600 17px var(--display); text-transform: uppercase; letter-spacing: .01em; }
.sorteo-head { display: flex; align-items: center; gap: 10px; }
.sorteo-head > div { display: flex; flex-direction: column; }
.sorteo-escudo { width: 38px; height: 38px; object-fit: contain; flex: none; }
.escudos-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.escudo-opcion { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px;
  background: var(--beige-soft); border: 1px solid var(--linea); border-radius: var(--radio); cursor: pointer; }
.escudo-opcion:hover { border-color: var(--rojo); }
.escudo-opcion.selected { border-color: var(--verde); background: var(--superficie-verde); box-shadow: inset 0 0 0 1px var(--verde); }
.escudo-opcion img { width: 34px; height: 34px; object-fit: contain; }
.escudo-opcion span { color: var(--texto-suave); font: 600 9px var(--label); }
.escudo-opcion.selected span { color: var(--verde); }
.candidatos { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 6px; max-height: 460px; overflow-y: auto; }
.candidatos li {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  border: 1px solid var(--linea);
  background: var(--superficie);
  border-radius: var(--radio);
  padding: 8px 10px;
  cursor: pointer;
  font-size: 14px;
  transition: border-color .12s, background .12s, transform .12s;
  animation: slidein .3s ease-out backwards;
}
.candidatos li:hover { border-color: var(--linea-fuerte); background: var(--beige-soft); }
.candidatos li.sel { border-color: var(--rojo); box-shadow: inset 0 0 0 1px var(--rojo); background: var(--superficie-roja); }
.candidatos li.blocked { opacity: .55; cursor: not-allowed; background: var(--superficie-media); }
.candidatos .foto { width: 40px; height: 40px; object-fit: cover; border-radius: 50%; border: 1px solid var(--linea); background: var(--superficie-media); }
.candidatos .foto.inicial { display: inline-flex; align-items: center; justify-content: center; background: var(--negro); color: var(--oro-claro); font: 700 17px var(--display); }
.cand-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cand-top { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.cand-top strong { font: 600 14px var(--texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.epoca { color: var(--texto-suave); font: 600 9px var(--label); border: 1px solid var(--linea); border-radius: 2px; padding: 1px 4px; }
.cand-ovr {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  padding: 4px 5px;
  border: 1px solid var(--linea);
  border-radius: 3px;
  background: var(--beige-soft);
  color: var(--tinta);
  line-height: 1;
}
.cand-ovr strong { font: 700 18px/1 var(--num); }
.cand-ovr small { margin-top: 2px; color: var(--texto-tenue); font: 600 8px var(--label); letter-spacing: .08em; }
.candidatos li.blocked .cand-ovr { opacity: .55; }
.motivo { color: var(--texto-tenue); font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
.candidatos li.grupo-head { background: transparent; border: 0; padding: 9px 2px 0; cursor: default; animation: none; }
.candidatos li.grupo-head span { color: var(--rojo); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .14em; border-bottom: 1px solid var(--linea); display: block; padding-bottom: 4px; }
.candidatos li.skel { pointer-events: none; }
.candidatos li.skel span { display: block; height: 40px; border-radius: 3px; background: linear-gradient(90deg, var(--superficie-media) 25%, var(--superficie-baja) 50%, var(--superficie-media) 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }
@keyframes slidein { from { transform: translateX(-12px); opacity: 0; } to { transform: none; opacity: 1; } }
.badge { background: var(--rojo); color: #fff; border-radius: 2px; padding: 1px 6px; font: 600 10px var(--label); letter-spacing: .05em; text-transform: uppercase; margin-left: 5px; }
.badge.goldbg { background: var(--oro); color: #1a1d1a; }
/* Partida empezada y abandonada: se ve, pero no se presenta como terminada. */
.badge.sin-terminar { background: var(--superficie-media); color: var(--texto-suave); text-transform: none; letter-spacing: 0; }
.badge.silverbg { background: #7e8590; }
.locked { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--texto-tenue); border: 1px solid var(--linea); border-radius: 2px; padding: 1px 5px; margin-left: 5px; }
.gold { color: #8a6a12; }
.silver { color: #5e6670; }
.bar.mini { height: 5px; margin-top: 4px; background: var(--superficie-media); border-radius: 3px; overflow: hidden; }
.fill.mini-fill { display: block; height: 100%; background: var(--rojo); }
.chips { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; margin-top: 2px; }
.chip {
  border: 1px solid var(--verde);
  background: var(--superficie-verde);
  color: var(--verde);
  border-radius: 3px;
  font: 700 11px var(--label);
  letter-spacing: .03em;
  padding: 5px 9px;
  cursor: pointer;
  min-height: 30px;
}
.chip:hover { background: var(--verde); color: #fff; }
.chip.banco { border-color: var(--rojo); background: var(--rojo); color: #fff; }
.chip.banco:hover { background: var(--rojo-vivo); }
/* tarjeta de tirada */
.draw-card { position: relative; display: grid; grid-template-columns: 40px 1fr; gap: 12px; margin-top: 16px; padding: 18px; overflow: hidden; background: var(--beige-soft); border-color: var(--linea); }
.draw-icon { color: var(--rojo); font: 600 11px var(--label); letter-spacing: .06em; }
.draw-card h2 { margin-top: 4px; font-size: 18px; }
.draw-card p { margin-top: 6px; color: var(--texto-suave); font-size: 11px; line-height: 1.5; }
.primary-button {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 9px;
  padding: 12px 14px;
  color: #fff;
  background: var(--rojo);
  border: 0;
  border-radius: 3px;
  font: 600 13px var(--display);
  text-transform: uppercase;
  letter-spacing: .04em;
  transition: background .18s ease, transform .18s ease;
  cursor: pointer;
}
.primary-button:hover:not(:disabled) { background: var(--rojo-vivo); transform: translateY(-1px); }
.primary-button:disabled { opacity: .45; cursor: not-allowed; }
.primary-button span { font-size: 17px; }
.primary-button.rolling { animation: shake .3s infinite; }
@keyframes shake { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-1deg); } 75% { transform: rotate(1deg); } }
/* Mazo animado: cinco cartas que se dan vuelta una por una mientras se sortea. */
.mazo-flip { grid-column: 1 / -1; display: flex; justify-content: center; gap: 7px;
  margin: 10px 0 2px; perspective: 700px; }
.carta-flip { position: relative; width: 36px; height: 50px; transform-style: preserve-3d;
  transition: transform .45s cubic-bezier(.2, .9, .2, 1); }
.carta-flip.abierta { transform: rotateY(180deg); }
.cara { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  backface-visibility: hidden; border-radius: 3px; box-shadow: 0 3px 8px rgba(0,0,0,.15); }
.cara.dorso { background: var(--rojo); border: 1px solid #fff0c5; color: #fff0c5;
  font: 700 10px var(--label); letter-spacing: .08em; }
.cara.frente { background: var(--beige-soft); border: 1px solid var(--oro-claro); color: var(--rojo);
  font-size: 19px; transform: rotateY(180deg); }
@media (prefers-reduced-motion: reduce) { .carta-flip { transition: none; } }
.ghost-button {
  grid-column: 1 / -1;
  padding: 9px 12px;
  background: transparent;
  border: 1px solid var(--tinta);
  border-radius: 3px;
  color: var(--tinta);
  font: 600 11px var(--display);
  text-transform: uppercase;
  letter-spacing: .04em;
  cursor: pointer;
}
.ghost-button:hover { background: var(--invertir-fondo); color: var(--invertir-texto); }
.capitan-btn.aplicado, .ghost-button.aplicado { border-color: var(--verde); color: var(--verde); background: var(--superficie-verde); }
/* Resumen final: reemplaza a "Tirar" cuando el plantel ya está completo. */
.resumen-final { margin-top: 16px; padding: 20px; background: var(--superficie); }
.resumen-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.resumen-final h2 { margin: 4px 0 0; font: 600 21px var(--display); letter-spacing: -.01em; text-transform: uppercase; }
.resumen-ovr { text-align: right; }
.resumen-ovr strong { display: block; color: var(--rojo); font: 700 42px/1 var(--num); }
.score-column .resumen-final { margin-top: 0; padding: 16px 20px; }
.resumen-ovr span { color: var(--texto-tenue); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .1em; }
.resumen-datos { display: flex; flex-direction: column; gap: 7px; margin: 14px 0 0; padding: 12px 0 0; border-top: 1px solid var(--linea); }
.resumen-datos div { display: flex; justify-content: space-between; gap: 12px; }
.resumen-datos dt { color: var(--texto-tenue); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .06em; }
.resumen-datos dd { margin: 0; color: var(--tinta); font: 600 12px var(--texto); text-align: right; }
.resumen-final .muted { margin: 12px 0 0; }
.nueva-partida {
  width: 100%;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--texto-tenue);
  cursor: pointer;
  font: 600 10px var(--label);
  letter-spacing: .06em;
  text-transform: uppercase;
}
.nueva-partida:hover { color: var(--rojo); border-color: var(--linea-roja); background: var(--superficie-roja); }
/* Modal de confirmación de reinicio. */
.reinicio-overlay { position: fixed; inset: 0; z-index: 130; display: flex; align-items: center;
  justify-content: center; padding: 20px; background: rgba(12,14,12,.74); }
.reinicio-modal { width: min(420px, 100%); padding: 24px; background: var(--superficie-baja); border: 1px solid var(--linea);
  border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,.4); }
.reinicio-modal h2 { margin: 6px 0 8px; font: 600 26px 'Oswald', sans-serif; text-transform: uppercase; }
.reinicio-modal p { margin: 0; color: #59645b; font-size: 13px; line-height: 1.5; }
.reinicio-acciones { display: flex; gap: 10px; margin-top: 20px; }
.reinicio-acciones button { flex: 1; min-height: 44px; border-radius: 3px; font: 700 12px var(--texto);
  text-transform: uppercase; cursor: pointer; }
.reinicio-cancelar { border: 1px solid #b8ab8f; background: transparent; color: var(--texto-verde); }
.reinicio-confirmar { border: 1px solid #c8102e; background: #c8102e; color: #fff; }
.reinicio-confirmar:hover { background: #a80d27; }
/* cancha */
.pitch-column { min-width: 0; }
.section-kicker { display: flex; align-items: center; gap: 8px; margin: 0 2px 10px; color: var(--texto-suave); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .09em; }
.section-kicker > span:first-child { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 20px; border: 1px solid var(--linea-roja); border-radius: 2px; background: var(--superficie); color: var(--rojo); }
.section-kicker .line { height: 1px; flex: 1; background: var(--linea); }
.section-kicker .muted { color: var(--texto-tenue); font-size: 9px; }
.pitch-wrap { padding: 8px; background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); box-shadow: var(--sombra-dura); }
.pitch {
  position: relative;
  width: 100%;
  height: clamp(500px, calc(100svh - 280px), 860px);
  overflow: hidden;
  background:
    radial-gradient(120% 60% at 50% 0%, rgba(255, 255, 255, .06), transparent 60%),
    repeating-linear-gradient(0deg, #225e3e 0, #225e3e 10%, #1b4d32 10%, #1b4d32 20%);
  border: 1px solid rgba(255, 255, 255, .3);
  border-radius: 3px;
  box-shadow: inset 0 0 0 3px rgba(0, 0, 0, .08);
}
.pitch:before, .pitch:after { content: ''; position: absolute; left: 4%; right: 4%; border: 1.5px solid rgba(255, 255, 255, .42); }
.pitch:before { top: 4%; bottom: 4%; }
.pitch:after { top: 50%; height: 0; border-width: 1.5px 0 0; }
.pitch-line { position: absolute; z-index: 1; border: 1.5px solid rgba(255, 255, 255, .4); }
.halfway { width: 20%; aspect-ratio: 1; left: 40%; top: 41.5%; border-radius: 50%; }
.halfway::after { content: ''; position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px; border-radius: 50%; background: rgba(255, 255, 255, .7); }
.center-circle { display: none; }
.penalty-top, .penalty-bottom { left: 28%; width: 44%; height: 15%; }
.penalty-top { top: 4%; border-top: 0; }
.penalty-bottom { bottom: 4%; border-bottom: 0; }
.goal-top, .goal-bottom { left: 39%; width: 22%; height: 4%; }
.goal-top { top: 4%; border-top: 0; }
.goal-bottom { bottom: 4%; border-bottom: 0; }
.player-slot {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  margin: -29px 0 0 -29px;
  color: rgba(255, 255, 255, .92);
  border: 1.5px dashed rgba(59, 165, 104, .95);
  border-radius: 50%;
  background: rgba(9, 40, 23, .46);
  font: 600 12px var(--label);
  transition: transform .2s ease, border-color .2s ease, background .2s ease;
  cursor: pointer;
}
.player-slot:hover { border-color: #fff; transform: scale(1.06); }
.player-slot.filled { background: var(--superficie); color: var(--tinta); border-style: solid; border-color: rgba(255, 255, 255, .9); box-shadow: 0 2px 0 rgba(0, 0, 0, .18); }
/* El puesto ocupado no es el bloqueado: el aviso va en el candidato del mazo. */
.player-slot.ocupado { border-color: var(--linea-fuerte); }
.player-slot.sinhueco { border-color: var(--rojo); box-shadow: 0 0 0 3px rgba(200, 16, 46, .22); }
.player-slot.sinhueco::after { content: 'sin lugar'; position: absolute; top: -9px; left: 50%;
  transform: translateX(-50%); z-index: 3; padding: 1px 5px; border-radius: 2px;
  background: var(--rojo); color: #fff; font: 600 8px var(--label); white-space: nowrap; }
.pick-hint .muted { display: inline-block; margin-left: 8px; font-size: 11px; }
.player-slot.open { background: var(--rojo); border-style: solid; border-color: #fff; color: #fff; transform: scale(1.08); animation: pulse 1.2s infinite; }
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(200,16,46,.55); } 50% { box-shadow: 0 0 0 8px rgba(200,16,46,0); } }
.player-slot.justpicked { animation: glow 1.6s ease-out; }
@keyframes glow { 0% { box-shadow: 0 0 0 0 rgba(197,155,39,.9); } 100% { box-shadow: 0 0 0 16px rgba(197,155,39,0); } }
.player-slot .tag { position: absolute; top: 103%; left: 50%; transform: translateX(-50%); white-space: nowrap; background: rgba(12, 20, 15, .86); color: #fff; font: 600 9px var(--texto); border-radius: 2px; padding: 1px 5px; }
.player-slot .tag.goldtag { color: #ffd97a; }
.player-slot .tag.silvertag { color: #d7dce2; }
.player-slot small { margin-top: 2px; color: rgba(255, 255, 255, .62); font-size: 7px; text-transform: uppercase; }
.player-slot .slot-pos { font: 600 12px var(--label); letter-spacing: .02em; }
.player-slot .slot-rol { margin-top: 1px; color: rgba(255, 255, 255, .62); font: 500 7px var(--label); text-transform: uppercase; letter-spacing: .05em; }
.player-slot .capt { position: absolute; bottom: -5px; right: -5px; background: var(--oro); color: #1a1d1a; font-size: 10px; font-weight: 800; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: 1px solid #fff; }
.player-slot.estrella { border-color: var(--oro); box-shadow: 0 0 0 2px rgba(197,155,39,.4); }
.player-slot.capitan { border-color: var(--rojo); box-shadow: 0 0 0 2px rgba(200,16,46,.35); }
.foto-slot { position: absolute; inset: 3px; width: calc(100% - 6px); height: calc(100% - 6px); object-fit: cover; border-radius: 50%; }
.foto-ini { position: absolute; inset: 3px; display: flex; align-items: center; justify-content: center;
  width: calc(100% - 6px); height: calc(100% - 6px); border-radius: 50%;
  background: var(--negro); color: var(--oro-claro); font: 700 18px var(--display); }
.dorsal-slot { position: absolute; z-index: 1; bottom: 0; right: 0; min-width: 17px; height: 17px; padding: 0 3px;
  display: flex; align-items: center; justify-content: center; border-radius: 50%;
  background: var(--negro); color: #fdf9ed; font: 700 9px var(--label); border: 1px solid #fff; }
.player-slot.dorsalpuesto .dorsal-slot { background: var(--verde); }
.slot-ovr { position: absolute; z-index: 3; top: -6px; right: -7px; min-width: 22px; height: 18px; padding: 0 4px;
  display: flex; align-items: center; justify-content: center; border-radius: 2px;
  background: var(--oro); color: #1a1d1a; font: 700 9px var(--label); border: 1px solid #fff; }
.jugador-info { display: inline-block; margin: 0 0 10px; padding: 5px 9px; border-radius: 2px;
  border: 1px solid var(--linea); background: var(--superficie); color: var(--texto-suave);
  font: 600 11px var(--label); }
.guardado-ok { display: inline-block; margin: 0 0 10px; padding: 5px 10px; border-radius: 2px;
  background: var(--superficie-verde); color: var(--verde); font: 600 10px var(--label); animation: slidein .2s ease-out; }
.pitch-footer { display: flex; justify-content: space-between; gap: 8px; padding: 9px 2px 0; color: var(--texto-tenue); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .06em; }
.pitch-footer span:first-child { color: var(--rojo); }
.pitch-footer .pitch-equipo { display: inline-flex; align-items: center; gap: 5px; }
.pitch-equipo img { width: 16px; height: 16px; object-fit: contain; }
.confirm { background: var(--beige-soft); border: 1px solid var(--rojo); border-radius: var(--radio); padding: 10px 12px; margin-bottom: 10px; animation: slidein .2s ease-out; }
.pick-hint { background: var(--superficie); border: 1px solid var(--linea); border-left: 3px solid var(--rojo); border-radius: 2px; padding: 8px 10px; margin: 0 0 10px; font-size: 12px; color: var(--texto-suave); }
.ok { color: var(--verde); }
.resaltado { color: var(--rojo); }
.steps { display: none; }
.segs { display: flex; gap: 3px; justify-content: center; margin: 10px 0 0; }
.segs span { width: 22px; height: 6px; border-radius: 3px; background: var(--linea); }
.segs span.on { background: var(--rojo); }
/* marcador */
.marcador-title, .score-card h2 { font-size: 21px; }
.sound-button { width: 28px; height: 28px; color: var(--texto-suave); background: var(--superficie); border: 1px solid var(--linea); border-radius: 50%; font-size: 13px; cursor: pointer; }
.sound-button:hover { border-color: var(--rojo); color: var(--rojo); }
.score-hero { padding: 20px 0 14px; border-bottom: 1px solid var(--linea); }
.score-main { display: flex; align-items: center; gap: 10px; }
/* Line-height 1 para que el "¿?" de De memoria no se superponga con
   "OVR del equipo" (las tildes de los signos salen del cajón de la línea). */
.score-hero strong { color: var(--tinta); font: 700 68px/1 var(--num); letter-spacing: -.02em; }
.score-state {
  display: inline-flex;
  align-items: center;
  padding: 3px 6px;
  border: 1px solid var(--linea);
  border-radius: 2px;
  background: var(--beige-soft);
  color: var(--texto-tenue);
  font: 600 8px var(--label);
  letter-spacing: .08em;
  text-transform: uppercase;
  white-space: nowrap;
}
.score-state.ok { border-color: var(--superficie-verde); background: var(--superficie-verde); color: var(--verde); }
.score-hero p { margin: 10px 0 0; color: var(--texto-tenue); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .08em; }
.metric { padding: 11px 0 2px; }
.metric > span { color: var(--texto-suave); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .05em; }
.metric b { float: right; color: var(--rojo); font: 600 11px var(--label); }
.metric-track { height: 4px; margin-top: 7px; background: var(--superficie-media); border-radius: 999px; overflow: hidden; }
.metric-track i { display: block; height: 100%; background: var(--rojo); transition: width .5s ease-out; }
.squad-list { margin-top: 14px; }
.squad-row { display: grid; grid-template-columns: 22px 38px minmax(0, 1fr) auto; align-items: center; padding: 8px 2px; border-top: 1px solid var(--linea); color: var(--texto-tenue); font: 500 9px var(--label); cursor: pointer; gap: 7px; }
.squad-row:first-child { border-top: 0; }
.squad-row:hover { background: var(--beige-soft); }
.squad-row.active { background: var(--beige-soft); box-shadow: inset 2px 0 0 var(--rojo); }
.squad-row span:first-child { color: #b0a99a; }
.squad-row b { color: var(--texto-suave); font-weight: 600; letter-spacing: .03em; }
.squad-row em { color: var(--tinta); font-style: normal; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.squad-row em.sin-jugador { color: #a49e91; font-style: italic; }
.squad-row em.gold { color: #8a6a12; font-weight: 700; }
.squad-row em.silver { color: #5e6670; font-weight: 700; }
.squad-row .ovr { color: var(--rojo); font-weight: 600; font-style: normal; }
.squad-actions { display: flex; align-items: center; gap: 4px; }
.squad-state { width: 12px; height: 12px; border: 1px solid var(--linea-fuerte); border-radius: 50%; }
.squad-state.on { background: var(--verde); border-color: var(--verde); box-shadow: inset 0 0 0 2px #fff; }
.captbtn { border: 1px solid var(--linea); background: var(--superficie); border-radius: 50%; width: 21px; height: 21px; font: 600 10px var(--label); cursor: pointer; color: var(--texto-tenue); }
.captbtn.on { background: var(--oro); border-color: var(--oro); color: var(--tinta); }
.captbtn.faltacap, .dorsalbtn.faltacap { outline: 2px solid var(--rojo); outline-offset: 2px; animation: falta-cap 1s ease-in-out infinite alternate; }
@keyframes falta-cap { from { box-shadow: 0 0 0 0 rgba(200,16,46,.45); } to { box-shadow: 0 0 0 6px rgba(200,16,46,0); } }
.banco-list { margin-top: 4px; }
.tabs { display: flex; gap: 4px; margin-bottom: 8px; padding: 3px; background: var(--superficie-media); border-radius: 3px; }
.tabs button { flex: 1; padding: 7px; background: transparent; border: 1px solid transparent; border-radius: 2px; font: 600 10px var(--label); text-transform: uppercase; letter-spacing: .04em; cursor: pointer; color: var(--texto-suave); }
.tabs button.selected { background: var(--rojo); border-color: var(--rojo); color: #fff; }
.banco-panel { display: flex; flex-direction: column; gap: 8px; padding: 14px; background: repeating-linear-gradient(0deg, #225e3e 0, #225e3e 10%, #1b4d32 10%, #1b4d32 20%); border: 1px solid rgba(255, 255, 255, .3); border-radius: 3px; }
.banco-card { display: grid; grid-template-columns: auto auto auto minmax(0, 1fr) 40px; gap: 8px; align-items: center;
  background: var(--superficie); border-radius: 3px; padding: 8px 10px; font-size: 13px; }
.banco-card strong { color: var(--rojo); font: 600 10px var(--label); letter-spacing: .04em; }
.banco-card span { color: var(--texto-suave); font: 500 9px var(--label); }
.banco-card em { font-style: normal; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.banco-card .mejor-que { grid-column: 1 / -1; }
.banco-foto { display: inline-flex; width: 38px; height: 38px; border-radius: 50%; overflow: hidden;
  border: 1px solid var(--linea); background: var(--superficie-media); }
.banco-foto img { width: 100%; height: 100%; object-fit: cover; }
.banco-ini { display: inline-flex; align-items: center; justify-content: center; width: 100%; height: 100%;
  background: var(--negro); color: var(--oro-claro); font: 700 15px var(--display); }
.player-slot.soltar { border-color: #fff; border-style: solid; box-shadow: 0 0 0 4px rgba(59,165,104,.55); transform: scale(1.1); }
.banco-panel.soltar { outline: 3px dashed var(--oro-claro); outline-offset: -6px; }
.banco-card.soltar { border: 2px solid var(--verde); }
.player-slot[draggable="true"], .banco-card[draggable="true"] { cursor: grab; }
.banco-note { color: rgba(255,255,255,.85); font: 500 10px var(--label); margin: 2px 0; }
.banco-note.warn { color: #ffd97a; font-weight: 700; }
.banco-head { color: var(--rojo); font: 600 9px var(--label); text-transform: uppercase; letter-spacing: .12em; padding: 9px 2px 2px; border-top: 1px solid var(--linea); }
.squad-row.suplente { grid-template-columns: 38px 34px minmax(0, 1fr) auto 30px; cursor: default; }
.squad-row.suplente.con-mejora { background: var(--superficie-verde); border-color: var(--superficie-verde); }
.squad-foto { display: inline-flex; width: 28px; height: 28px; border-radius: 50%; overflow: hidden;
  border: 1px solid var(--linea); background: var(--superficie-media); }
.squad-foto img { width: 100%; height: 100%; object-fit: cover; }
.squad-ini { display: inline-flex; align-items: center; justify-content: center; width: 100%; height: 100%;
  background: var(--negro); color: var(--oro-claro); font: 700 11px var(--display); }
.dorsal-mini { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 21px;
  padding: 0 5px; border: 1px dashed var(--linea-fuerte); border-radius: 2px; color: var(--texto-tenue);
  font: 600 9px var(--label); }
.dorsal-mini.puesta { border-style: solid; border-color: #b9c9bb; color: var(--tinta); background: var(--superficie-verde); }
.mejor-que { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between;
  gap: 6px; margin-top: 2px; padding: 5px 8px; border: 1px solid var(--verde); border-radius: 2px;
  background: var(--superficie-verde); color: #14652f; font: 700 10px var(--texto); text-align: left; cursor: pointer; }
.mejor-que:hover:not(:disabled) { background: var(--superficie-verde); }
.mejor-que:disabled { opacity: .55; cursor: not-allowed; }
.dorsalbtn { min-width: 28px; height: 21px; padding: 0 6px; border: 1px solid var(--linea); background: var(--superficie); border-radius: 2px; font: 600 10px var(--label); color: var(--texto-suave); cursor: pointer; }
.dorsalbtn:hover { border-color: var(--rojo); color: var(--rojo); }
.dorsal-edit { display: flex; align-items: center; gap: 6px; padding: 8px 2px; border-top: 1px dashed var(--linea); font-size: 12px; color: var(--texto-suave); }
.dorsal-edit input { width: 64px; padding: 6px 8px; border: 1px solid var(--linea-fuerte); border-radius: 2px; font-size: 16px; }
/* botones legacy (torneo, keepers) */
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.between { justify-content: space-between; }
.center-row { justify-content: center; margin-top: 10px; }
.btn { border: 1px solid var(--linea-fuerte); background: var(--superficie); color: var(--tinta); border-radius: 4px; padding: 8px 14px; cursor: pointer; font-size: 13px; }
.btn.primary { background: #c8102e; border-color: #c8102e; color: #fff; }
.btn.ghost { background: transparent; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn.big { width: 100%; margin-top: 10px; }
.small-btn { font-size: 12px; padding: 6px 10px; }
/* abajo */
.below-grid { padding: 10px 0 60px; }
.section-heading { display: flex; justify-content: space-between; align-items: end; gap: 24px; padding-bottom: 21px; border-bottom: 1px solid #cfcfc4; }
.section-heading h2 { margin-top: 9px; font-size: 28px; }
.text-button { padding: 0; color: #c8102e; background: none; border: 0; font: 10px 'JetBrains Mono', monospace; text-transform: uppercase; cursor: pointer; }
.grid2 { display: grid; grid-template-columns: 1fr 1.4fr; gap: 18px; margin-top: 18px; }
.panel { background: var(--superficie-baja); border: 1px solid var(--linea); border-radius: 4px; padding: 22px; box-shadow: 0 12px 35px rgba(43,48,42,.06); }
.panel h2 { font: 600 22px 'Oswald', sans-serif; text-transform: uppercase; margin: 0 0 8px; display: flex; align-items: center; gap: 8px; }
.h-bar { display: inline-block; width: 5px; height: 20px; background: #c8102e; border-radius: 3px; }
.plain { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 4px; }
.plain.rivals li { display: flex; gap: 8px; align-items: baseline; padding: 7px 10px; background: var(--superficie-baja); border-radius: 8px; }
.rank { background: var(--negro); color: #fff; font-size: 12px; font-weight: 800; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.rank.low { background: #b8ab8f; }
.rivals .ovr { margin-left: auto; color: #c8102e; font-size: 16px; }
.hist { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 10px; }
.hist-aclaracion { margin: 4px 0 0; }
.hist-pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
.pager-btn { min-height: 44px; padding: 0 14px; border: 1px solid var(--linea-fuerte); border-radius: 4px;
  background: var(--superficie-baja); color: var(--tinta); font: 600 11px var(--texto); cursor: pointer; }
.pager-btn:hover:not(:disabled) { background: var(--superficie-media); border-color: var(--rojo); color: var(--rojo); }
.pager-btn:focus-visible { outline: 2px solid var(--rojo); outline-offset: 2px; }
.pager-btn:disabled { opacity: .4; cursor: not-allowed; }
.pager-label { color: var(--texto-suave); font: 600 10px var(--label); letter-spacing: .06em; text-transform: uppercase; }
.hist-card { border: 1px solid var(--linea); background: var(--superficie); border-radius: 8px; padding: 10px 12px; }
.hist-card:hover { border-color: #b8ab8f; }
/* Versión resumida del inicio: una sola fila compacta por partida. */
.hist-resumen { display: flex; align-items: center; gap: 9px; width: 100%; padding: 0;
  border: 0; background: none; text-align: left; cursor: pointer; color: var(--tinta); }
.hist-resumen:hover .hist-resumen-titulo strong { color: var(--rojo); }
.hist-resumen .chev { color: var(--rojo); font-size: 12px; }
.hist-resumen-titulo { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.hist-resumen-titulo strong { font: 600 14px var(--texto); }
.hist-resumen-titulo small { color: var(--texto-suave); font: 500 10px var(--label); }
.hist-resumen-score { flex: none; padding: 3px 7px; border-radius: 3px; background: var(--beige-soft);
  color: var(--tinta); font: 700 12px var(--num); }
.hist-completo { display: block; margin: 12px 0 0; }
.hist-head { display: flex; align-items: center; gap: 8px; font-size: 15px; }
.escudo-anio, .escudo-mio-mini {
  display: inline-block;
  width: 13px;
  height: 13px;
  vertical-align: -2px;
  object-fit: contain;
  margin: 0 2px;
}
.escudo-mio-mini { opacity: .85; }
.resumen-toggle { display: inline-flex; align-items: center; gap: 6px; text-align: left; }
.resumen-toggle .chev { color: #c8102e; font-size: 12px; flex: none; width: 10px; }
.mini { list-style: none; padding: 4px 0 0 12px; margin: 0; font-size: 13px; color: var(--texto-suave); }
.link { border: none; background: none; cursor: pointer; color: #c8102e; font-weight: 700; padding: 0; font-size: 14px; }
.link.small { font-size: 12px; margin-left: 6px; }
.link.inv { color: #fff; text-decoration: underline; }
.error { color: #fff; background: #c8102e; border-radius: 8px; padding: 10px 14px; margin-top: 18px; }
.error-cierre { color: #c8102e; background: var(--superficie-roja); border: 1px solid var(--linea-roja); border-radius: 8px;
  padding: 8px 12px; margin: 8px 0 0; font-size: 12px; font-weight: 700; text-align: center; }
.checklist-cierre { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 2px; }
.checklist-cierre span { padding: 4px 8px; border-radius: 12px; border: 1px solid #d8cfbc;
  background: var(--superficie-baja); color: var(--texto-tenue); font: 600 10px 'JetBrains Mono', monospace; text-transform: uppercase; }
.checklist-cierre span.ok { border-color: #1b7f3b; background: var(--superficie-verde); color: #1b7f3b; }
.muted { color: var(--texto-suave); }
.small { font-size: 13px; }
@media (max-width: 1080px) { .workspace { grid-template-columns: minmax(230px, .75fr) minmax(360px, 1.2fr); } .score-column { grid-column: 1 / -1; } .score-card { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; } .score-card .card-heading, .score-card .squad-list { grid-column: 1 / -1; } .grid2 { grid-template-columns: 1fr; } }
/* Tu Historial: un renglón por equipo, jugó o no. */
.hist-eq-filtros { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 12px; }
.hist-eq-filtro { padding: 6px 14px; border: 1px solid var(--linea); border-radius: 999px;
  background: var(--superficie-baja); color: var(--texto-suave); cursor: pointer; font: 600 12px var(--texto); }
.hist-eq-filtro:hover { border-color: #c8102e; color: #c8102e; }
.hist-eq-filtro.on.jugados { border-color: var(--rojo); background: var(--superficie-roja); color: var(--rojo); }
.hist-eq-filtro.on.mas { border-color: #1b7f3b; background: var(--superficie-verde); color: #1b7f3b; }
.hist-eq-filtro.on.igual { border-color: #8a8172; background: var(--superficie-media); color: var(--texto-suave); }
.hist-eq-filtro.on.menos { border-color: #c8102e; background: var(--superficie-roja); color: #c8102e; }
.hist-eq-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.hist-eq-row { display: grid; grid-template-columns: 34px minmax(0, 1fr) 46px 104px;
  align-items: center; gap: 10px; padding: 8px 10px; background: var(--superficie-baja);
  border: 1px solid var(--linea); border-radius: 6px; }
.hist-eq-row.sin-partidos { background: var(--superficie-baja); color: var(--texto-tenue); }
.hist-eq-escudo { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; }
.hist-eq-escudo img { width: 100%; height: 100%; object-fit: contain; }
.hist-eq-escudo .ini { display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: 1px solid #d8d3c7; border-radius: 50%;
  color: var(--texto-tenue); font: 700 13px var(--num); }
.hist-eq-nombre { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.hist-eq-nombre strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.hist-eq-nombre small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--texto-tenue); font-size: 10px; }
.hist-eq-signo { display: flex; align-items: center; justify-content: center; min-width: 38px; height: 34px;
  padding: 0 5px; border: 1px solid currentColor; border-radius: 6px; font: 700 16px/1 var(--num); }
.hist-eq-signo.mas { color: #1b7f3b; background: var(--superficie-verde); }
.hist-eq-signo.igual { color: var(--texto-tenue); background: var(--superficie-media); }
.hist-eq-signo.menos { color: #c8102e; background: var(--superficie-roja); }
.hist-eq-signo.neutro { color: #b6afa1; background: transparent; border-style: dashed; font-size: 15px; }
.hist-eq-datos { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.3; }
.hist-eq-datos b { color: var(--texto-verde); font: 600 13px var(--num); }
.hist-eq-datos b small { color: var(--texto-tenue); font: 500 9px var(--mono); }
.hist-eq-datos > small { color: var(--texto-suave); font: 500 12px var(--num); }
/* El stepper y el panel "Más info" solo existen en celular. */
.mobile-steps, .escudo-cambiar, .mobile-info-toggle { display: none; }

@media (max-width: 720px) {
  .mobile-steps { display: flex; gap: 5px; margin: 16px 0 0; padding: 5px;
    background: var(--superficie); border: 1px solid var(--linea); border-radius: var(--radio); position: sticky; top: 0; z-index: 40; }
  .mobile-steps button { flex: 1; min-height: 46px; display: inline-flex; align-items: center;
    justify-content: center; gap: 7px; border: 1px solid transparent; border-radius: 3px; background: transparent;
    color: var(--texto-suave); font: 600 12px var(--texto); cursor: pointer; }
  .mobile-steps button.on { background: var(--rojo); border-color: var(--rojo); color: #fff; }
  .paso-num { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;
    border-radius: 50%; background: var(--superficie-media); font: 700 10px var(--num); }
  .mobile-steps button.on .paso-num { background: rgba(255,255,255,.22); color: #fff; }
  /* "Armar" tiene mazo + cancha juntos: se elige y se ubica sin ir y volver. */
  .paso-armar .score-column, .paso-equipo .setup-column, .paso-equipo .pitch-column { display: none; }
  .workspace { padding-top: 14px; }
  .escudo-cambiar { display: inline-flex; align-items: center; gap: 8px; width: 100%;
    padding: 8px 10px; border: 1px solid var(--linea); border-radius: 6px; background: var(--superficie-baja);
    font: 600 12px var(--texto); cursor: pointer; text-align: left; }
  .escudo-cambiar img { width: 26px; height: 26px; object-fit: contain; }
  .escudo-cambiar b { margin-left: auto; color: #c8102e; }
  .escudos-grid { display: none; }
  .escudos-grid.abierta { display: grid; }
  .mobile-info-toggle { display: flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; min-height: 48px; margin: 22px 0 0; padding: 10px 14px;
    border: 1px solid var(--linea-fuerte); border-radius: 4px; background: var(--superficie-baja);
    font: 600 11px var(--texto); text-transform: uppercase; letter-spacing: .04em; cursor: pointer; }
  .mobile-info-toggle span { color: #c8102e; }
  .info-extra { padding-top: 10px; }
  .info-extra:not(.abierto) { display: none; }
  .workspace { display: flex; flex-direction: column; padding: 24px 0 48px; gap: 18px; }
  .setup-column, .pitch-column, .score-column { width: 100%; min-width: 0; }
  .setup-card, .score-card { padding: 18px 16px; }
  .player-slot { width: 40px; height: 40px; margin: -20px 0 0 -20px; }
  .player-slot .tag { font-size: 9px; max-width: 110px; overflow: hidden; text-overflow: ellipsis; }
  .intro-panel { padding-left: 2px; padding-right: 2px; }
  /* En celular la bajada va centrada y con aire: antes quedaba pegada a la
     izquierda porque el marcador de plantel le comía lugar a la derecha. */
  .hero-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .hero-copy { max-width: none; text-align: center; }
  .hero-side { align-items: center; }
  .hero-lead { max-width: 46ch; margin: 10px auto 0; padding-left: 0;
    font-size: 14px; line-height: 1.55; text-align: center; }
  .intro-strip h1 { min-width: 100%; }
  .rail-row { flex-wrap: wrap; gap: 8px; }
  .next-step { max-width: none; text-align: left; flex-basis: 100%; }
  .config-actions { margin: 10px -16px -18px; padding: 10px 16px 16px; }
  .setup-card:has(.config-actions) { padding-bottom: 72px; }
  .score-card { display: block; }
  .squad-row { grid-template-columns: 22px 40px minmax(0, 1fr) auto; gap: 6px; padding: 10px 2px; }
  .squad-row.suplente { grid-template-columns: 34px 30px minmax(0, 1fr) auto 30px; }
  .banco-card { grid-template-columns: auto auto auto minmax(0, 1fr) 38px; padding: 9px; }
  .dorsal-edit { flex-wrap: wrap; }
  .dorsal-edit input { flex: 1; min-width: 70px; }
  .candidatos li { padding: 11px 12px; }
  .primary-button, .ghost-button, .choice-grid button, .choice-row button,
  .mazo-filtros input, .mazo-filtros select { min-height: 48px; }
  .section-heading { flex-direction: column; align-items: start; gap: 10px; }
  .section-heading h2 { font-size: 23px; }
  .hist-eq-row { grid-template-columns: 30px minmax(0, 1fr) 42px 78px; gap: 7px; padding: 7px 8px; }
  .hist-eq-signo { min-width: 34px; height: 32px; font-size: 14px; }
  .hist-eq-datos b { font-size: 12px; }
  .resumen-final { padding: 18px 16px; }
  .reiniciar-zona { text-align: left; }
  .reiniciar-btn { width: 100%; min-height: 44px; }
  .mejor-que { min-height: 38px; }
  .grid2 { grid-template-columns: 1fr; }
  .confirm .row .btn { flex: 1; min-height: 44px; }
  .team-input { font-size: 16px; }
}
@media (max-width: 420px) { .choice-grid:not(.formations) { grid-template-columns: repeat(2, 1fr); } }
.mazo-filtros { display: flex; gap: 6px; margin: 6px 0 8px; }
.mazo-filtros input, .mazo-filtros select { min-width: 0; padding: 6px 8px; border: 1px solid var(--linea);
  border-radius: 4px; background: var(--superficie-baja); font-size: 11px; }
.mazo-filtros input { flex: 1; }
.mazo-filtros select { width: 96px; }

/* Bandeja de elección: solo en celular, fija sobre la navegación inferior.
   Permite confirmar el puesto sin volver a subir hasta el mazo. */
.pick-tray { display: none; }

@media (max-width: 720px) {
  .pick-tray {
    position: fixed;
    z-index: 66;
    left: 8px;
    right: 8px;
    bottom: calc(64px + env(safe-area-inset-bottom));
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    background: var(--beige-soft);
    border: 1px solid var(--linea-fuerte);
    border-left: 3px solid var(--rojo);
    border-radius: var(--radio);
    box-shadow: 0 6px 22px rgba(26, 29, 26, .2);
  }
  .pick-tray-main { min-width: 0; display: flex; flex-direction: column; }
  .pick-tray-main small {
    color: var(--rojo);
    font: 600 8px var(--label);
    letter-spacing: .1em;
    text-transform: uppercase;
  }
  .pick-tray-main strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--tinta);
    font: 600 14px var(--display);
    text-transform: uppercase;
    letter-spacing: .01em;
  }
  .pick-tray-main span { color: var(--texto-tenue); font: 500 9px var(--label); }
  .pick-tray-actions {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-left: auto;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .pick-tray-actions::-webkit-scrollbar { display: none; }
  .pick-tray-slot, .pick-tray-primary {
    flex: none;
    min-height: 42px;
    padding: 0 12px;
    border: 1px solid var(--rojo);
    border-radius: 3px;
    background: var(--rojo);
    color: #fff;
    cursor: pointer;
    font: 600 11px var(--display);
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .pick-tray-slot:hover, .pick-tray-primary:hover { background: var(--rojo-hondo); }
  .pick-tray-empty { color: var(--texto-tenue); font: 600 9px var(--label); text-transform: uppercase; }
}
</style>
