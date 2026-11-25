<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { obtenerHistorial, obtenerRivales } from '../services/api.js'
import { usePrensa } from '../services/prensa.js'
import { escudoDe } from '../game/fotos.js'
import { mvpAportes } from '../game/formations.js'
import { construirHistorialEquipos, signoPartido, claveEquipo } from '../game/historial_equipos.js'
import XvRivalModal from './XvRivalModal.vue'
import ResumenPartida from './ResumenPartida.vue'

// Tus drafts ya pasa este flag desde la vista que contiene el panel.
defineProps({ almanaque: { type: Boolean, default: false } })

const { texto: textoPrensa, tribuna: textoTribuna } = usePrensa()

const partidas = ref([])
const equiposCatalogo = ref([])
const cargando = ref(true)
const error = ref('')
const todasLasPartidas = ref(false)
const sesionesAbiertas = ref(new Set())
const rivalesAbiertos = ref(new Set())
const xvAbierto = ref(null)
// Cada detalle tiene su propia clave: varios partidos pueden estar abiertos
// a la vez sin pisar el resumen completo de la sesión.
const detallesAbiertos = ref(new Set())
// Resumen completo de cada sesión: marcadores, goleadores, asistencias,
// penales, figura y alineación propia, sin salir del historial.
const resumenAbierto = ref(null)
function alternarResumen(id) {
  resumenAbierto.value = resumenAbierto.value === id ? null : id
}

const sesionesVisibles = computed(() =>
  todasLasPartidas.value ? partidas.value : partidas.value.slice(0, 5)
)

function claveRival(p) {
  return p.rival_temporada_id ?? p.etiqueta ?? p.rival ?? null
}
function clavePartido(p, i) {
  return `${p.origen ?? '?'}-${p.id ?? i}-${i}`
}
function estaAbierto(conjunto, clave) {
  return conjunto.value.has(clave)
}
function alternar(conjunto, clave) {
  const siguiente = new Set(conjunto.value)
  if (siguiente.has(clave)) siguiente.delete(clave)
  else siguiente.add(clave)
  conjunto.value = siguiente
}
// OJO: en el template Vue desenvuelve los refs automáticamente. Pasar
// `sesionesAbiertas` desde el template llegaba como Set y `conjunto.value`
// era undefined -> "Cannot read properties of undefined (reading 'has')",
// que dejaba el panel entero sin renderizar. Estos wrappers no pasan refs.
const sesionAbierta = (id) => estaAbierto(sesionesAbiertas, id)
function alternarSesion(id) { alternar(sesionesAbiertas, id) }
const detalleAbierto = (clave) => estaAbierto(detallesAbiertos, 'd-' + clave)
function alternarDetalle(clave) { alternar(detallesAbiertos, 'd-' + clave) }
const rivalAbierto = (clave) => estaAbierto(rivalesAbiertos, clave)
function alternarRival(clave) { alternar(rivalesAbiertos, clave) }
function alternarXV(clave) {
  xvAbierto.value = xvAbierto.value === clave ? null : clave
}
function temporadaDePartido(p) {
  return {
    rival_temporada_id: p.rival_temporada_id,
    etiqueta: p.etiqueta,
    club: p.club,
    formacion: p.formacion,
    ovr_equipo: p.ovr_equipo,
    escudo: p.escudo,
    escudo_epoca: p.escudo_epoca
  }
}
function penalesDe(p) {
  return p.detalle?.tanda ?? null
}
function marcadorDe(p) {
  const pen = penalesDe(p)
  const base = p.gf != null && p.gc != null ? `${p.gf}–${p.gc}` : ''
  return pen ? `${base} (${pen.mios}–${pen.suyos})` : base
}
function signoDe(p) {
  return signoPartido(p)
}
function letraSigno(p) {
  const s = signoDe(p)
  return s === 1 ? 'V' : s === 0 ? 'E' : 'D'
}
function textoDiferencia(n) {
  return n > 0 ? `+${n}` : String(n)
}

// ---- Resumen general de partidos oficiales (los amistosos no cuentan) ----
const resumenGlobal = computed(() => {
  const total = { partidas: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0 }
  for (const sesion of partidas.value) {
    for (const p of (Array.isArray(sesion.partidos) ? sesion.partidos : [])) {
      if (p.amistoso) continue
      total.partidas++
      const s = signoDe(p)
      if (s === 1) total.v++
      else if (s === 0) total.e++
      else total.d++
      total.gf += Number(p.gf) || 0
      total.gc += Number(p.gc) || 0
    }
  }
  return { ...total, dif: total.gf - total.gc }
})

// ---- Filtros de partidos individuales (no afectan la tabla por equipo) ----
const FILTROS_RESULTADO = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'v', etiqueta: 'Victorias' },
  { id: 'e', etiqueta: 'Empates' },
  { id: 'd', etiqueta: 'Derrotas' }
]
const filtroResultado = ref('todos')
const busquedaRival = ref('')

function textoRival(p) {
  return [p.etiqueta, p.rival, p.club].filter(Boolean).join(' ')
}
function coincideFiltro(p) {
  const s = signoDe(p)
  if (filtroResultado.value === 'v' && s !== 1) return false
  if (filtroResultado.value === 'e' && s !== 0) return false
  if (filtroResultado.value === 'd' && s !== -1) return false
  const buscado = claveEquipo(busquedaRival.value)
  return !buscado || claveEquipo(textoRival(p)).includes(buscado)
}

// Lista plana con la fecha de la sesión, para los filtros y el récord por rival.
const partidosPlanos = computed(() => partidas.value.flatMap((m) =>
  (Array.isArray(m.partidos) ? m.partidos : [])
    .map((p) => ({ ...p, fechaSesion: m.fecha_inicio ?? null }))))
const partidosFiltradosPlanos = computed(() => partidosPlanos.value.filter(coincideFiltro))

function claveDetalle(m, p, i) {
  return `${m.id ?? '?'}-${clavePartido(p, i)}`
}
// Goleadores, asistencias, tanda y figura se calculan una sola vez por partido.
const detallesPartidos = computed(() => {
  const mapa = new Map()
  for (const m of partidas.value) {
    const lista = Array.isArray(m.partidos) ? m.partidos : []
    lista.forEach((p, i) => {
      const goles = p.detalle?.goleadores ?? []
      mapa.set(claveDetalle(m, p, i), {
        goleadores: goles,
        goleadoresRival: p.detalle?.goleadoresRival ?? [],
        tanda: p.detalle?.tanda ?? null,
        figura: goles.length ? mvpAportes(goles) : null
      })
    })
  }
  return mapa
})
function partidosFiltrados(m) {
  const lista = Array.isArray(m.partidos) ? m.partidos : []
  return lista
    .map((p, i) => ({ p, clave: claveDetalle(m, p, i) }))
    .filter((item) => coincideFiltro(item.p))
    .map((item) => ({ ...item, detalle: detallesPartidos.value.get(item.clave) ?? null }))
}
// Sesión creada pero no jugada: aunque tenga jugadores drafteados, no tiene
// resultados y se marca como "Sin terminar" en lugar de ocultarla.
function sinTerminar(m) {
  return !Array.isArray(m?.partidos) || m.partidos.length === 0
}
function conteoPartidos(m) {
  const total = (Array.isArray(m.partidos) ? m.partidos : []).length
  const mostrados = partidosFiltrados(m).length
  return mostrados === total
    ? `${total} partido${total === 1 ? '' : 's'}`
    : `${mostrados} de ${total} partidos`
}

// ---- Historial por equipo: tabla completa del archivo ----
const EQUIPOS_POR_PAGINA = 12
const filtroEquipos = ref('jugados')
const paginaEquipos = ref(0)
const FILTROS_EQUIPOS = [
  { id: 'jugados', etiqueta: 'Con partidos' },
  { id: 'mas-jugados', etiqueta: 'Más jugados' },
  { id: 'positivo', etiqueta: 'Positivo' },
  { id: 'igual', etiqueta: 'Igualados' },
  { id: 'negativo', etiqueta: 'Negativo' },
  { id: 'todos', etiqueta: 'Todos' }
]
const historialEquipos = computed(() =>
  construirHistorialEquipos(equiposCatalogo.value, partidas.value))
const equiposFiltrados = computed(() => {
  const todos = historialEquipos.value
  switch (filtroEquipos.value) {
    // "Más jugados" vivía en el bloque que sacamos del inicio: lo conservamos
    // acá para no perder la vista ordenada por cantidad de partidos.
    case 'mas-jugados': return todos
      .filter((r) => r.partidos > 0)
      .slice()
      .sort((a, b) => b.partidos - a.partidos ||
        String(a.club ?? '').localeCompare(String(b.club ?? '')))
    case 'positivo': return todos.filter((r) => r.partidos > 0 && r.signo > 0)
    case 'igual': return todos.filter((r) => r.partidos > 0 && r.signo === 0)
    case 'negativo': return todos.filter((r) => r.partidos > 0 && r.signo < 0)
    case 'todos': return todos
    default: return todos.filter((r) => r.partidos > 0)
  }
})
const equiposPaginas = computed(() =>
  Math.max(1, Math.ceil(equiposFiltrados.value.length / EQUIPOS_POR_PAGINA)))
const equiposVisibles = computed(() => equiposFiltrados.value.slice(
  paginaEquipos.value * EQUIPOS_POR_PAGINA,
  (paginaEquipos.value + 1) * EQUIPOS_POR_PAGINA))
const equiposConPartidos = computed(() =>
  historialEquipos.value.filter((r) => r.partidos > 0).length)
watch([filtroEquipos, historialEquipos], () => { paginaEquipos.value = 0 })

function saldoTexto(r) {
  const dif = r.g - r.p
  return dif > 0 ? `+${dif}` : String(dif)
}
function saldoClase(r) {
  return r.signo > 0 ? 'pos' : r.signo < 0 ? 'neg' : 'neu'
}

function agruparRivales(lista) {
  const grupos = new Map()
  for (const p of lista) {
    const clave = claveRival(p)
    if (clave === null || clave === undefined || clave === '') continue
    if (!grupos.has(clave)) grupos.set(clave, { clave, partidos: [] })
    grupos.get(clave).partidos.push(p)
  }
  return [...grupos.values()].map((g) => {
    const oficiales = g.partidos.filter((p) => !p.amistoso)
    const v = oficiales.filter((p) => signoDe(p) === 1).length
    const e = oficiales.filter((p) => signoDe(p) === 0).length
    const d = oficiales.filter((p) => signoDe(p) === -1).length
    const dif = v - d
    const gf = oficiales.reduce((suma, p) => suma + (Number(p.gf) || 0), 0)
    const gc = oficiales.reduce((suma, p) => suma + (Number(p.gc) || 0), 0)
    // Último cruce conocido: se prefiere la fecha de la sesión y se completa
    // con el número de fecha del torneo cuando el partido lo tiene.
    const cruces = g.partidos
      .map((p) => ({
        fecha: p.fechaSesion ? String(p.fechaSesion).slice(0, 10) : '',
        fecha_n: p.fecha_n ?? null
      }))
      .filter((c) => c.fecha || c.fecha_n != null)
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))
        || (a.fecha_n ?? -1) - (b.fecha_n ?? -1))
    const primero = g.partidos[0] ?? {}
    return {
      ...g,
      v, e, d, dif, gf, gc,
      saldo: gf - gc,
      ultimoCruce: cruces.length ? cruces[cruces.length - 1] : null,
      amistosos: g.partidos.length - oficiales.length,
      etiqueta: primero.etiqueta ?? primero.rival ?? null,
      club: primero.club ?? null,
      formacion: primero.formacion ?? null,
      escudo: escudoDe(primero),
      primero,
      conPlantel: primero.rival_temporada_id != null,
      tipo: dif > 0 ? 'pos' : dif < 0 ? 'neg' : 'neu',
      marca: dif > 0 ? `+${dif}` : dif < 0 ? String(dif) : '='
    }
  }).sort((a, b) => b.partidos.length - a.partidos.length
    || String(a.etiqueta ?? '').localeCompare(String(b.etiqueta ?? ''), 'es'))
}
const rivales = computed(() => agruparRivales(partidosFiltradosPlanos.value))
const totalRivales = computed(() => agruparRivales(partidosPlanos.value).length)

async function cargar() {
  cargando.value = true
  error.value = ''
  const [historial, catalogo] = await Promise.allSettled([
    obtenerHistorial(200),
    obtenerRivales()
  ])
  if (historial.status === 'fulfilled') {
    // El modo Diario fue eliminado: sus filas siguen en MySQL pero no se muestran.
    // Las sesiones sin resultados se conservan y se marcan como "Sin terminar".
    partidas.value = (Array.isArray(historial.value) ? historial.value : [])
      .filter((m) => m.modo !== 'diario')
  } else {
    error.value = historial.reason?.message ?? 'No se pudo cargar el historial.'
    partidas.value = []
  }
  equiposCatalogo.value = catalogo.status === 'fulfilled' && Array.isArray(catalogo.value)
    ? catalogo.value
    : []
  cargando.value = false
}
onMounted(cargar)
</script>

<template>
  <div class="panel historial">
    <div class="panel-head">
      <div>
        <span class="kicker">Archivo de partidos</span>
        <h2>Historial</h2>
      </div>
      <span v-if="partidas.length" class="conteo">
        {{ partidas.length }} partida{{ partidas.length === 1 ? '' : 's' }}
      </span>
    </div>
    <p class="panel-lead">Todos los equipos que enfrentaste, con partidos, goles y saldo.</p>

    <p v-if="cargando" class="estado">Buscando partidas…</p>
    <div v-else-if="error" class="estado-vacio">
      <span aria-hidden="true">⚠</span>
      <strong>No se pudo cargar el historial</strong>
      <p class="error-line">{{ error }}</p>
      <button class="btn small-btn" type="button" @click="cargar">Reintentar</button>
    </div>
    <div v-else-if="!partidas.length" class="estado-vacio">
      <strong>Sin partidas</strong>
      <p>Jugá un torneo para empezar a construir el historial.</p>
    </div>
    <template v-else>
      <div class="resumen-global" aria-label="Resumen general de partidos oficiales">
        <span class="rg-titulo">Resumen general <small>solo partidos oficiales</small></span>
        <div class="rg-chips">
          <span class="rg-chip"><small>Partidas</small><strong>{{ resumenGlobal.partidas }}</strong></span>
          <span class="rg-chip v"><small>Victorias</small><strong>{{ resumenGlobal.v }}</strong></span>
          <span class="rg-chip e"><small>Empates</small><strong>{{ resumenGlobal.e }}</strong></span>
          <span class="rg-chip d"><small>Derrotas</small><strong>{{ resumenGlobal.d }}</strong></span>
          <span class="rg-chip"><small>Goles a favor</small><strong>{{ resumenGlobal.gf }}</strong></span>
          <span class="rg-chip"><small>Goles en contra</small><strong>{{ resumenGlobal.gc }}</strong></span>
          <span class="rg-chip dif"><small>Diferencia</small><strong>{{ textoDiferencia(resumenGlobal.dif) }}</strong></span>
        </div>
      </div>

      <section class="bloque bloque-equipos">
        <div class="bloque-head">
          <div>
            <h3>Historial por equipo</h3>
            <p class="bloque-sub">{{ equiposConPartidos }} equipos con partidos · {{ historialEquipos.length }} en el archivo</p>
          </div>
          <div class="filtros" role="group" aria-label="Filtrar historial por equipo">
            <button v-for="f in FILTROS_EQUIPOS" :key="f.id" type="button"
                    class="filtro" :class="{ on: filtroEquipos === f.id }"
                    :aria-pressed="filtroEquipos === f.id"
                    @click="filtroEquipos = f.id">{{ f.etiqueta }}</button>
          </div>
        </div>

        <div v-if="equiposVisibles.length" class="tabla-scroll">
          <table class="tabla-historial">
            <thead>
              <tr>
                <th scope="col">Equipo</th>
                <th scope="col">PJ</th>
                <th scope="col">G</th>
                <th scope="col">E</th>
                <th scope="col">P</th>
                <th scope="col">GF</th>
                <th scope="col">GC</th>
                <th scope="col">DIF</th>
                <th scope="col">%V</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in equiposVisibles" :key="r.id" :class="{ 'sin-partidos': !r.partidos }">
                <td class="eq">
                  <span class="eq-escudo">
                    <img v-if="r.escudo" :src="r.escudo" alt="" loading="lazy"
                         @error="(e) => e.target.remove()" />
                    <span v-else class="ini">{{ String(r.club ?? '?').charAt(0) }}</span>
                  </span>
                  <span class="eq-nombre">
                    <strong>{{ r.club }}</strong>
                    <small v-if="r.etiqueta && r.etiqueta !== r.club">{{ r.etiqueta }}</small>
                  </span>
                </td>
                <td>{{ r.partidos }}</td>
                <td class="goles">{{ r.g }}</td>
                <td>{{ r.e }}</td>
                <td class="goles">{{ r.p }}</td>
                <td>{{ r.gf }}</td>
                <td>{{ r.gc }}</td>
                <td :class="r.gf === r.gc ? '' : r.gf > r.gc ? 'dif-pos' : 'dif-neg'">
                  {{ r.gf - r.gc > 0 ? '+' : '' }}{{ r.gf - r.gc }}
                </td>
                <td><span class="saldo" :class="saldoClase(r)">{{ saldoTexto(r) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="estado">No hay equipos con este filtro.</p>

        <div v-if="equiposPaginas > 1" class="pager" role="group" aria-label="Páginas del historial por equipo">
          <button class="pag-btn" type="button" :disabled="paginaEquipos === 0"
                  aria-label="Ir a la página anterior" @click="paginaEquipos--">
            <span class="pag-flecha" aria-hidden="true">←</span>
            <span>Anterior</span>
            <span v-if="paginaEquipos > 0" class="pag-num" aria-hidden="true">{{ paginaEquipos }}</span>
          </button>
          <span class="pag-estado">Página {{ paginaEquipos + 1 }} de {{ equiposPaginas }}</span>
          <button class="pag-btn" type="button" :disabled="paginaEquipos + 1 >= equiposPaginas"
                  aria-label="Ir a la página siguiente" @click="paginaEquipos++">
            <span v-if="paginaEquipos + 2 <= equiposPaginas" class="pag-num" aria-hidden="true">{{ paginaEquipos + 2 }}</span>
            <span>Siguiente</span>
            <span class="pag-flecha" aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <section class="bloque">
        <div class="bloque-head">
          <div>
            <h3>Últimas partidas</h3>
            <p class="bloque-sub">Las partidas que no terminaste aparecen marcadas como “Sin terminar” · los filtros también aplican al récord por rival</p>
          </div>
        </div>
        <div class="filtros-partidos">
          <div class="filtros" role="group" aria-label="Filtrar partidos por resultado">
            <button v-for="f in FILTROS_RESULTADO" :key="f.id" type="button"
                    class="filtro" :class="{ on: filtroResultado === f.id }"
                    :aria-pressed="filtroResultado === f.id"
                    @click="filtroResultado = f.id">{{ f.etiqueta }}</button>
          </div>
          <label class="buscar-rival">
            <span>Rival</span>
            <input v-model="busquedaRival" type="search" placeholder="Etiqueta o club" />
          </label>
          <span class="conteo-filtrado" aria-live="polite">
            {{ partidosFiltradosPlanos.length }} de {{ partidosPlanos.length }} partidos mostrados
          </span>
        </div>
        <ul class="lista sesiones">
          <li v-for="m in sesionesVisibles" :key="m.id" class="item sesion">
            <button type="button" class="cabeza" :aria-expanded="sesionAbierta(m.id)"
                    @click="alternarSesion(m.id)">
              <span class="chev" aria-hidden="true">{{ sesionAbierta(m.id) ? '▾' : '▸' }}</span>
              <strong class="s-nombre">{{ m.nombre_equipo ?? `Partida #${m.id}` }}</strong>
              <span v-if="m.fecha_inicio" class="s-fecha">{{ String(m.fecha_inicio).slice(0, 10) }}</span>
              <span v-if="m.formacion" class="s-form">{{ m.formacion }}</span>
              <span v-if="m.ultimo_resultado" class="s-res">{{ m.ultimo_resultado }}</span>
              <span v-if="sinTerminar(m)" class="sin-terminar">Sin terminar</span>
              <span class="s-num">{{ conteoPartidos(m) }}</span>
            </button>
            <div v-if="sesionAbierta(m.id)" class="detalle">
              <p v-if="!partidosFiltrados(m).length" class="muted small">No hay partidos con estos filtros.</p>
              <ul v-else class="lista partidos">
                <li v-for="item in partidosFiltrados(m)" :key="item.clave" class="partido partido-detallado">
                  <span class="signo" :class="{ v: signoDe(item.p) === 1, e: signoDe(item.p) === 0, d: signoDe(item.p) === -1 }">
                    {{ letraSigno(item.p) }}
                  </span>
                  <strong v-if="marcadorDe(item.p)" class="marcador">{{ marcadorDe(item.p) }}</strong>
                  <span v-if="item.p.etiqueta ?? item.p.rival" class="p-rival">{{ item.p.etiqueta ?? item.p.rival }}</span>
                  <span v-if="item.p.club" class="p-club">{{ item.p.club }}</span>
                  <span v-if="item.p.fase" class="p-fase">{{ item.p.fase }}</span>
                  <span v-if="item.p.fecha_n != null" class="p-fecha">F{{ item.p.fecha_n }}</span>
                  <span v-if="m.fecha_inicio" class="p-fecha">{{ String(m.fecha_inicio).slice(0, 10) }}</span>
                  <span v-if="item.p.amistoso" class="amistoso">Amistoso</span>
                  <small v-if="item.detalle?.tanda" class="p-penales">
                    Penales {{ item.detalle.tanda.mios }}–{{ item.detalle.tanda.suyos }}<template
                      v-if="item.detalle.tanda.ganador != null"> · {{ item.detalle.tanda.ganador ? 'Ganado' : 'Perdido' }}</template>
                  </small>
                  <div v-if="item.detalle?.goleadores.length" class="p-detalle">
                    Goles:
                    <span v-for="(g, j) in item.detalle.goleadores" :key="'g' + j" class="p-gol">
                      {{ g.minuto }}' {{ g.jugador }}<em v-if="g.asistencia"> · asist. {{ g.asistencia }}</em>
                    </span>
                  </div>
                  <div v-if="item.detalle?.goleadoresRival.length" class="p-detalle suyos">
                    Del rival:
                    <span v-for="(g, j) in item.detalle.goleadoresRival" :key="'r' + j" class="p-gol">
                      {{ g.minuto }}' {{ g.jugador }}
                    </span>
                  </div>
                  <div v-if="item.detalle?.figura" class="p-detalle">
                    Figura: <strong>{{ item.detalle.figura.jugador }}</strong>
                    ({{ item.detalle.figura.g }}G + {{ item.detalle.figura.a }}A)
                  </div>
                  <small v-if="textoPrensa(item.p)" class="p-prensa">{{ textoPrensa(item.p) }}</small>
                  <small v-if="textoTribuna(item.p)" class="p-prensa">{{ textoTribuna(item.p) }}</small>
                  <div class="p-detalle-accion">
                    <button class="btn small-btn" type="button"
                            :aria-expanded="detalleAbierto(item.clave)"
                            @click="alternarDetalle(item.clave)">
                      {{ detalleAbierto(item.clave) ? 'Ocultar detalle' : 'Ver detalle' }}
                    </button>
                  </div>
                  <div v-if="detalleAbierto(item.clave)" class="p-resumen">
                    <ResumenPartida :partida="{ ...m, partidos: [item.p] }" :almanaque="almanaque" />
                  </div>
                </li>
              </ul>
              <div class="resumen-zone">
                <p class="muted small">En Tus drafts el resumen es completo; en el inicio es resumido.</p>
                <button class="btn small-btn" type="button" :aria-expanded="resumenAbierto === m.id"
                        @click="alternarResumen(m.id)">
                  {{ resumenAbierto === m.id ? 'Ocultar resumen' : 'Ver resumen completo' }}
                </button>
                <ResumenPartida v-if="resumenAbierto === m.id" :partida="m" :almanaque="almanaque" />
              </div>
            </div>
          </li>
        </ul>
        <button class="btn small-btn" type="button" @click="todasLasPartidas = !todasLasPartidas">
          {{ todasLasPartidas ? 'Ver solo las últimas 5' : 'Ver todas las partidas' }}
        </button>
      </section>

      <section class="bloque">
        <div class="bloque-head">
          <div>
            <h3>Récord por rival</h3>
            <p class="bloque-sub">{{ rivales.length }} de {{ totalRivales }} rivales ·
              {{ partidosFiltradosPlanos.length }} de {{ partidosPlanos.length }} partidos mostrados</p>
          </div>
        </div>
        <ul class="lista rivales">
          <li v-for="r in rivales" :key="r.clave" class="item rival">
            <button type="button" class="cabeza" :aria-expanded="rivalAbierto(r.clave)"
                    @click="alternarRival(r.clave)">
              <span class="chev" aria-hidden="true">{{ rivalAbierto(r.clave) ? '▾' : '▸' }}</span>
              <img v-if="r.escudo" :src="r.escudo" alt="" class="escudo" loading="lazy"
                   @error="(e) => e.target.remove()" />
              <strong class="r-nombre">{{ r.etiqueta ?? r.club ?? 'Rival' }}</strong>
              <span v-if="r.club && r.club !== r.etiqueta" class="r-club">{{ r.club }}</span>
              <span v-if="r.formacion" class="r-form">{{ r.formacion }}</span>
              <span class="r-ved">{{ r.v }}-{{ r.e }}-{{ r.d }}</span>
              <span class="dif" :class="r.tipo">{{ r.marca }}</span>
            </button>
            <div v-if="rivalAbierto(r.clave)" class="detalle">
              <p class="muted small">
                {{ r.v }} victorias · {{ r.e }} empates · {{ r.d }} derrotas
                · Saldo de goles: {{ textoDiferencia(r.saldo) }} ({{ r.gf }}–{{ r.gc }})
                <template v-if="r.ultimoCruce">
                  · Último cruce:
                  <template v-if="r.ultimoCruce.fecha">{{ r.ultimoCruce.fecha }}</template>
                  <template v-if="r.ultimoCruce.fecha_n != null"> F{{ r.ultimoCruce.fecha_n }}</template>
                </template>
                <template v-if="r.amistosos">
                  · {{ r.amistosos }} amistoso{{ r.amistosos === 1 ? '' : 's' }}
                  (no cuentan para el diferendo)
                </template>
              </p>
              <ul class="lista partidos">
                <li v-for="(p, i) in r.partidos" :key="clavePartido(p, i)" class="partido">
                  <span class="signo" :class="{ v: signoDe(p) === 1, e: signoDe(p) === 0, d: signoDe(p) === -1 }">
                    {{ letraSigno(p) }}
                  </span>
                  <strong v-if="marcadorDe(p)" class="marcador">{{ marcadorDe(p) }}</strong>
                  <span v-if="p.etiqueta ?? p.rival" class="p-rival">{{ p.etiqueta ?? p.rival }}</span>
                  <span v-if="p.club" class="p-club">{{ p.club }}</span>
                  <span v-if="p.fase" class="p-fase">{{ p.fase }}</span>
                  <span v-if="p.fecha_n != null" class="p-fecha">F{{ p.fecha_n }}</span>
                  <span v-if="p.amistoso" class="amistoso">Amistoso</span>
                  <small v-if="penalesDe(p)" class="p-penales">
                    {{ penalesDe(p).ganador ? 'Ganado' : 'Perdido' }} por penales
                  </small>
                </li>
              </ul>
              <div class="xv-zone">
                <button v-if="r.conPlantel" class="btn small-btn" type="button"
                        :aria-expanded="xvAbierto === r.clave" @click="alternarXV(r.clave)">
                  {{ xvAbierto === r.clave ? 'Ocultar XV' : 'Ver XV' }}
                </button>
                <p v-else class="muted small">Sin plantel disponible</p>
                <XvRivalModal v-if="xvAbierto === r.clave && r.conPlantel"
                              :temporada="temporadaDePartido(r.primero)" :almanaque="almanaque"
                              @cerrar="xvAbierto = null" />
              </div>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.historial { padding: 24px; }
.panel-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.kicker {
  display: block;
  color: var(--rojo);
  font: 600 9px var(--label);
  letter-spacing: .12em;
  text-transform: uppercase;
}
.historial h2 {
  margin: 3px 0 0;
  font: 600 30px/.98 var(--display);
  letter-spacing: -.02em;
  text-transform: uppercase;
}
.conteo {
  flex: none;
  padding: 4px 8px;
  border: 1px solid var(--linea);
  border-radius: 2px;
  background: var(--beige-soft);
  color: var(--texto-suave);
  font: 600 9px var(--label);
  letter-spacing: .05em;
  text-transform: uppercase;
}
.panel-lead { margin: 7px 0 0; color: var(--texto-suave); font: 400 13px/1.5 var(--texto); }
.estado { padding: 14px; border: 1px dashed var(--linea-fuerte); border-radius: var(--radio);
  background: var(--beige-soft); color: var(--texto-suave); font: 400 13px var(--texto); }

/* Franja de números generales: los mismos signos que usa cada partido. */
.resumen-global { margin-top: 14px; padding: 11px 12px; border: 1px solid var(--linea);
  border-left: 3px solid var(--rojo); border-radius: var(--radio); background: var(--superficie); }
.rg-titulo { display: block; color: var(--tinta); font: 600 11px var(--label);
  letter-spacing: .06em; text-transform: uppercase; }
.rg-titulo small { margin-left: 6px; color: var(--texto-tenue); font: 500 9px var(--label);
  letter-spacing: .02em; text-transform: none; }
.rg-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.rg-chip { display: inline-flex; align-items: baseline; gap: 6px; padding: 5px 8px;
  border: 1px solid var(--linea); border-radius: 3px; background: var(--beige-soft); }
.rg-chip small { color: var(--texto-tenue); font: 600 9px var(--label);
  letter-spacing: .03em; text-transform: uppercase; }
.rg-chip strong { color: var(--tinta); font: 700 13px var(--num); }
.rg-chip.v strong { color: var(--verde); }
.rg-chip.e strong { color: var(--oro); }
.rg-chip.d strong, .rg-chip.dif strong { color: var(--rojo); }

.bloque { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--linea); }
.bloque h3 { margin: 0 0 10px; color: var(--tinta); font: 600 18px var(--display);
  letter-spacing: .02em; text-transform: uppercase; }
.bloque-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.bloque-sub { margin: 3px 0 0; color: var(--texto-tenue); font: 500 10px var(--label); letter-spacing: .02em; }
.filtros { display: flex; flex-wrap: wrap; gap: 5px; }
.filtro {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--linea-fuerte);
  border-radius: 3px;
  background: var(--superficie);
  color: var(--texto-suave);
  cursor: pointer;
  font: 600 9px var(--label);
  letter-spacing: .03em;
  text-transform: uppercase;
}
.filtro:hover { border-color: var(--rojo); color: var(--rojo); }
.filtro.on { background: var(--rojo); border-color: var(--rojo); color: #fff; }

/* Filtros de partidos: resultado + rival, con recuento de lo mostrado. */
.filtros-partidos { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px;
  margin: 0 0 12px; padding: 9px 10px; border: 1px solid var(--linea);
  border-radius: var(--radio); background: var(--superficie); }
.buscar-rival { display: inline-flex; align-items: center; gap: 6px; color: var(--texto-tenue);
  font: 600 9px var(--label); letter-spacing: .04em; text-transform: uppercase; }
.buscar-rival input { width: 170px; max-width: 100%; min-height: 34px; padding: 0 8px;
  border: 1px solid var(--linea-fuerte); border-radius: 3px; background: var(--superficie);
  color: var(--tinta); font: 500 11px var(--texto); }
.conteo-filtrado { margin-left: auto; color: var(--texto-suave); font: 600 10px var(--num); }

.tabla-scroll { margin-top: 14px; overflow-x: auto; border: 1px solid var(--linea); border-radius: var(--radio); background: var(--superficie); }
.tabla-historial { width: 100%; border-collapse: collapse; min-width: 660px; }
.tabla-historial th {
  padding: 9px 8px;
  border-bottom: 1px solid var(--linea);
  background: var(--superficie-media);
  color: var(--texto-tenue);
  font: 600 8px var(--label);
  letter-spacing: .08em;
  text-align: right;
  text-transform: uppercase;
  white-space: nowrap;
}
.tabla-historial th:first-child { text-align: left; padding-left: 12px; }
.tabla-historial td {
  padding: 9px 8px;
  border-top: 1px solid var(--linea);
  color: var(--texto-suave);
  font: 600 12px var(--num);
  text-align: right;
  white-space: nowrap;
}
.tabla-historial tbody tr:first-child td { border-top: 0; }
.tabla-historial tbody tr:hover td { background: var(--beige-soft); }
.tabla-historial tr.sin-partidos td { color: var(--texto-tenue); background: var(--superficie-baja); }
.tabla-historial td.eq { display: flex; align-items: center; gap: 9px; min-width: 220px; text-align: left; padding-left: 12px; }
.eq-escudo { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex: none; }
.eq-escudo img { width: 100%; height: 100%; object-fit: contain; }
.eq-escudo .ini { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px;
  border: 1px solid var(--linea); border-radius: 50%; color: var(--texto-tenue); font: 700 12px var(--display); }
.eq-nombre { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.eq-nombre strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--tinta);
  font: 600 13px var(--texto); }
.eq-nombre small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--texto-tenue);
  font: 500 9px var(--label); letter-spacing: .02em; }
.tabla-historial td.goles { color: var(--tinta); }
.dif-pos { color: var(--verde) !important; }
.dif-neg { color: var(--rojo) !important; }
.saldo { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 26px;
  padding: 0 6px; border: 1px solid currentColor; border-radius: 2px; font: 700 12px var(--num); }
.saldo.pos { color: var(--verde); background: var(--superficie-verde); }
.saldo.neg { color: var(--rojo); background: var(--superficie-roja); }
.saldo.neu { color: var(--texto-tenue); background: var(--beige-soft); }
/* Paginador grande y explícito: flecha + página destino + "Página X de Y". */
.pager { display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
  gap: 10px; margin-top: 14px; }
.pag-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  min-height: 46px; padding: 0 15px; border: 1px solid var(--tinta); border-radius: 3px;
  background: var(--superficie); color: var(--tinta); cursor: pointer;
  font: 600 12px var(--label); letter-spacing: .04em; text-transform: uppercase;
  transition: background .15s ease, color .15s ease, border-color .15s ease; }
.pag-btn:hover:not(:disabled) { background: var(--invertir-fondo); color: var(--invertir-texto); }
.pag-btn:focus-visible { outline: 2px solid var(--rojo); outline-offset: 2px; }
.pag-btn:disabled { opacity: .4; cursor: not-allowed; border-color: var(--linea);
  background: var(--beige-soft); color: var(--texto-tenue); }
.pag-flecha { font: 700 17px/1 var(--texto); }
.pag-num { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px;
  padding: 0 4px; border-radius: 2px; background: var(--beige-soft); color: var(--rojo);
  font: 700 11px var(--num); }
.pag-estado { min-width: 132px; text-align: center; color: var(--texto-suave);
  font: 600 11px var(--label); letter-spacing: .03em; }

.lista { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.item { background: var(--beige-soft); border: 1px solid var(--linea); border-radius: var(--radio); }
.cabeza { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 12px; border: 0;
  border-radius: var(--radio); background: transparent; color: var(--tinta); font: inherit;
  text-align: left; cursor: pointer; }
.cabeza:hover { background: var(--superficie); }
.chev { color: var(--rojo); font-size: 11px; flex: none; width: 10px; }
.escudo { width: 28px; height: 28px; object-fit: contain; flex: none; }
.s-nombre, .r-nombre { font: 600 13px var(--display); letter-spacing: .02em; text-transform: uppercase;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.s-fecha, .s-form, .s-res, .s-num, .r-club, .r-form, .p-club, .p-fase, .p-fecha {
  color: var(--texto-tenue); font: 500 9px var(--label); flex: none; }
.s-res { color: var(--rojo); font-weight: 600; }
.s-num, .r-ved { margin-left: auto; flex: none; }
.r-ved { color: var(--texto-suave); font: 600 12px var(--num); }
.dif { flex: none; min-width: 34px; text-align: center; padding: 3px 6px; border-radius: 2px;
  font: 700 11px var(--num); color: #fff; }
.dif.pos { background: var(--verde); }
.dif.neu { background: var(--oro); color: #1a1d1a; }
.dif.neg { background: var(--rojo); }
.detalle { padding: 8px 12px 12px 30px; border-top: 1px solid var(--linea); }
.detalle > p { margin: 0 0 8px; font-size: 12px; }
.partidos { gap: 4px; }
.partido { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 7px 9px;
  border: 1px solid var(--linea); border-radius: 3px; background: var(--superficie); font-size: 12px; }
.signo { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;
  border-radius: 2px; color: #fff; font: 700 10px var(--num); flex: none; }
.signo.v { background: var(--verde); }
.signo.e { background: var(--oro); color: #1a1d1a; }
.signo.d { background: var(--rojo); }
.marcador { font: 700 12px var(--num); }
.p-rival { font: 600 12px var(--texto); }
.amistoso { padding: 1px 5px; border: 1px dashed var(--linea-fuerte); border-radius: 2px;
  color: var(--texto-tenue); font: 600 8px var(--label); text-transform: uppercase; }
.p-penales { flex-basis: 100%; color: var(--rojo); font: 600 9px var(--label); text-transform: uppercase; }
.p-prensa { flex-basis: 100%; color: var(--texto-tenue); font: 400 10px/1.4 var(--texto); }
/* Datos finos de cada partido, visibles sin desplegar el detalle. */
.p-detalle { flex-basis: 100%; color: var(--tinta); font: 500 10px/1.6 var(--texto); }
.p-detalle.suyos { color: var(--texto-tenue); }
.p-detalle strong { color: var(--rojo); }
.p-gol { display: inline-block; margin-right: 8px; white-space: nowrap; }
.p-gol em { font-style: normal; color: var(--texto-tenue); }
.p-detalle-accion, .p-resumen { flex-basis: 100%; }
.p-resumen .resumen-partida { margin-top: 6px; }
.xv-zone { margin-top: 10px; }
.resumen-zone { margin-top: 10px; }
.bloque > .btn { margin-top: 10px; }

@media (max-width: 720px) {
  .historial { padding: 18px 14px; }
  .historial h2 { font-size: 27px; }
  .bloque-head { flex-direction: column; gap: 10px; }
  .filtros { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; width: 100%; }
  .filtro { min-height: 38px; }
  .pager { gap: 8px; }
  .pag-estado { flex-basis: 100%; order: -1; }
  .pag-btn { flex: 1 1 130px; padding: 0 10px; }
  .tabla-historial { min-width: 620px; }
  .tabla-historial td.eq { min-width: 190px; }
  .detalle { padding-left: 12px; }
  .s-form, .s-res, .r-club, .r-form { display: none; }
  .cabeza { padding: 10px; }
  .filtros-partidos .filtros { flex: 1 1 100%; }
  .buscar-rival { flex: 1 1 100%; }
  .buscar-rival input { flex: 1; width: auto; }
  .conteo-filtrado { flex-basis: 100%; margin-left: 0; }
}
</style>
