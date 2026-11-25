<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { obtenerTemporadas, obtenerEstadisticas } from '../services/api.js'
import { escudoDe } from '../game/fotos.js'
import XvRivalModal from './XvRivalModal.vue'

const props = defineProps({
  almanaque: { type: Boolean, default: false },
  compacto: { type: Boolean, default: false }
})
const emit = defineEmits(['ir-todos'])

const catalogo = ref([])
const rivales = computed(() => catalogo.value.filter((t) => !t.es_river))
const riveres = computed(() => catalogo.value.filter((t) => t.es_river))
const estadisticas = ref([])
const cargando = ref(true)
const error = ref('')
const busqueda = ref('')
const filtro = ref('todos')
// 8 equipos en el panel compacto: cierra una grilla simétrica de 4x2.
const LIMITE_COMPACTO = 8
// En celular se pagina de a 12; en pantallas grandes se muestra todo de una vez.
const LIMITE_MOVIL = 12
const limite = ref(props.compacto ? LIMITE_COMPACTO : LIMITE_MOVIL)
const esPc = ref(typeof window === 'undefined' || window.matchMedia('(min-width: 641px)').matches)
let consultaPc = null
function actualizarEsPc(e) { esPc.value = e.matches }
const abiertoId = ref(null)

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'river', label: 'River Plate' },
  { id: 'fuertes', label: 'Más fuertes' },
  { id: 'debiles', label: 'Más débiles' }
]

function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
function clave(t) {
  return t.temporada_id ?? t.id
}

const statsPorClub = computed(() => {
  const mapa = new Map()
  for (const s of estadisticas.value) {
    if (s?.club) mapa.set(normalizar(s.club), s)
  }
  return mapa
})
const ovrPromedio = computed(() => {
  const valores = rivales.value
    .map((r) => Number(r.ovr_equipo))
    .filter((n) => Number.isFinite(n))
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0
})

const filtrados = computed(() => {
  const q = normalizar(busqueda.value).trim()
  // River se muestra completo y sin OVR: compararlo por fuerza sería una trampa.
  const base = filtro.value === 'river' ? riveres.value : rivales.value
  const lista = base.filter((r) => {
    if (q && !normalizar(`${r.club ?? ''} ${r.etiqueta ?? ''}`).includes(q)) return false
    if (filtro.value === 'todos' || filtro.value === 'river') return true
    const ovr = Number(r.ovr_equipo)
    if (!Number.isFinite(ovr)) return false
    return filtro.value === 'fuertes' ? ovr >= ovrPromedio.value : ovr < ovrPromedio.value
  })
  if (filtro.value === 'fuertes') {
    return [...lista].sort((a, b) => (Number(b.ovr_equipo) || 0) - (Number(a.ovr_equipo) || 0))
  }
  if (filtro.value === 'debiles') {
    return [...lista].sort((a, b) => (Number(a.ovr_equipo) || 0) - (Number(b.ovr_equipo) || 0))
  }
  return lista
})
const limiteEfectivo = computed(() => {
  if (filtro.value === 'river') return filtrados.value.length
  // El panel compacto del inicio conserva sus 8 entradas también en PC.
  if (props.compacto) return limite.value
  return esPc.value ? filtrados.value.length : limite.value
})
const visibles = computed(() => filtrados.value.slice(0, limiteEfectivo.value).map((r) => ({
  ...r,
  stats: statsPorClub.value.get(normalizar(r.club)) ?? null
})))
const restantes = computed(() => Math.max(0, filtrados.value.length - limiteEfectivo.value))
function mostrarOvr(r) { return !props.almanaque && !r.es_river && r.ovr_equipo != null }

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [temporadas, stats] = await Promise.all([
      obtenerTemporadas(),
      obtenerEstadisticas().catch(() => [])
    ])
    catalogo.value = Array.isArray(temporadas) ? temporadas : []
    estadisticas.value = Array.isArray(stats) ? stats : []
  } catch (e) {
    error.value = e?.message ?? 'No se pudo cargar el catálogo de equipos.'
    catalogo.value = []
    estadisticas.value = []
  } finally {
    cargando.value = false
  }
}
function limpiarFiltros() {
  busqueda.value = ''
  filtro.value = 'todos'
  limite.value = props.compacto ? LIMITE_COMPACTO : LIMITE_MOVIL
}
function alternar(r) {
  abiertoId.value = abiertoId.value === clave(r) ? null : clave(r)
}
// La ventana flotante vive fuera de la grilla, igual que una notificación.
const abierto = computed(() => visibles.value.find((r) => clave(r) === abiertoId.value) ?? null)

onMounted(cargar)
onMounted(() => {
  // Mismo corte que los estilos: hasta 640px es celular, desde 641px se despliega todo.
  consultaPc = window.matchMedia('(min-width: 641px)')
  esPc.value = consultaPc.matches
  consultaPc.addEventListener?.('change', actualizarEsPc)
})
onUnmounted(() => {
  consultaPc?.removeEventListener?.('change', actualizarEsPc)
})
watch([busqueda, filtro], () => {
  limite.value = props.compacto ? LIMITE_COMPACTO : LIMITE_MOVIL
  abiertoId.value = null
})
</script>

<template>
  <div class="panel" :class="{ compacto }">
    <template v-if="compacto">
      <div class="compacto-head">
        <div>
          <span class="kicker">Archivo de equipos</span>
          <h2>Equipos</h2>
        </div>
        <button class="link-todos" type="button" @click="emit('ir-todos')">Ver todos →</button>
      </div>
      <p class="panel-lead">Planteles de época con escudo y XV. Elegí por historia, no por número.</p>
    </template>
    <template v-else>
      <div class="panel-head">
        <div>
          <span class="kicker">Archivo de equipos</span>
          <h2>{{ filtro === 'river' ? 'River Plate' : 'Equipos' }}</h2>
        </div>
        <span class="conteo">{{ filtrados.length }} plantel{{ filtrados.length === 1 ? '' : 'es' }}</span>
      </div>
      <p class="panel-lead">{{ filtro === 'river'
        ? 'Todos tus River, sin OVR: elegí por época, no por número.'
        : 'Planteles históricos del archivo 3A1, listos para jugar.' }}</p>
      <div class="tools">
        <input v-model="busqueda" type="search" placeholder="Buscar club o etiqueta…"
               aria-label="Buscar equipos por club o etiqueta" />
        <div class="filtros" role="group" aria-label="Filtrar equipos">
          <button v-for="f in FILTROS" :key="f.id" type="button" class="filtro"
                  :class="{ on: filtro === f.id }" :aria-pressed="filtro === f.id"
                  @click="filtro = f.id">
            {{ f.label }}
          </button>
        </div>
      </div>
      <p v-if="filtro === 'fuertes' || filtro === 'debiles'" class="criterio">
        Corte según OVR promedio de los equipos: <b>{{ ovrPromedio.toFixed(1) }}</b>
      </p>
    </template>
    <p v-if="cargando" class="muted small">Buscando equipos…</p>
    <div v-else-if="error" class="estado-vacio">
      <span aria-hidden="true">⚠</span>
      <strong>No se pudo cargar el catálogo</strong>
      <p class="error-line">{{ error }}</p>
      <button class="btn small-btn" type="button" @click="cargar">Reintentar</button>
    </div>
    <div v-else-if="!rivales.length" class="estado-vacio">
      <strong>Sin equipos</strong>
      <p>No hay temporadas de equipos disponibles en la base.</p>
    </div>
    <template v-else>
      <div v-if="!filtrados.length" class="estado-vacio">
        <strong>Sin coincidencias</strong>
        <p>Probá con otro club, etiqueta o filtro.</p>
        <button class="btn small-btn" type="button" @click="limpiarFiltros">Limpiar filtros</button>
      </div>
      <template v-else>
        <div class="rival-grid">
          <template v-for="r in visibles" :key="clave(r)">
            <article class="rival-card">
              <div class="rc-head">
                <span class="rc-crest">
                  <img v-if="escudoDe(r)" :src="escudoDe(r)" :alt="`Escudo de ${r.club ?? 'equipo'}`"
                       class="escudo" loading="lazy" @error="(e) => e.target.remove()" />
                  <span v-else class="escudo-ini">{{ String(r.club ?? '?').charAt(0) }}</span>
                </span>
                <div class="rc-titulo">
                  <h3>{{ r.etiqueta ?? r.club ?? 'Equipo' }}</h3>
                  <p v-if="r.club">{{ r.club }}</p>
                </div>
                <div v-if="mostrarOvr(r)" class="rc-ovr">
                  <strong>{{ r.ovr_equipo }}</strong>
                  <span>OVR</span>
                </div>
              </div>
              <dl class="rc-datos">
                <div v-if="r.formacion"><dt>Formación</dt><dd>{{ r.formacion }}</dd></div>
                <div v-if="r.tecnico"><dt>Técnico</dt><dd>{{ r.tecnico }}</dd></div>
                <div v-if="r.stats"><dt>Jugadores</dt><dd>{{ r.stats.cantidad_jugadores }}</dd></div>
                <div v-if="r.stats && r.stats.promedio_ovr != null">
                  <dt>Prom. OVR</dt><dd>{{ Number(r.stats.promedio_ovr).toFixed(1) }}</dd>
                </div>
              </dl>
              <button class="rc-btn" type="button" :aria-expanded="abiertoId === clave(r)"
                      @click="alternar(r)">
                {{ abiertoId === clave(r) ? 'Ocultar XV' : 'Ver XV' }}
                <span aria-hidden="true">{{ abiertoId === clave(r) ? '▴' : '→' }}</span>
              </button>
            </article>
          </template>
        </div>
        <div v-if="!compacto" class="mas">
          <button v-if="restantes" class="btn" type="button" @click="limite = filtrados.length">
            Ver todos los equipos ({{ restantes }})
          </button>
          <span v-else-if="filtrados.length > LIMITE_MOVIL" class="muted small">
            Mostrando {{ filtrados.length }} equipos de esta lista.
          </span>
        </div>
      </template>
    </template>
    <XvRivalModal v-if="abierto" :temporada="abierto"
                  :almanaque="almanaque || !!abierto.es_river" @cerrar="abiertoId = null" />
  </div>
</template>

<style scoped>
.panel { padding: 24px; }
.panel.compacto { padding: 20px; }

.kicker {
  display: block;
  color: var(--rojo);
  font: 600 9px var(--label);
  letter-spacing: .12em;
  text-transform: uppercase;
}
.panel-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.panel h2 {
  margin: 3px 0 0;
  font: 600 30px/.98 var(--display);
  letter-spacing: -.02em;
  text-transform: uppercase;
}
/* La lista completa (Tus drafts) va con títulos y fichas más grandes. */
.panel:not(.compacto) h2 { font-size: 34px; }
.conteo {
  flex: none;
  padding: 5px 10px;
  border: 1px solid var(--linea);
  border-radius: 2px;
  background: var(--beige-soft);
  color: var(--texto-suave);
  font: 600 11px var(--label);
  letter-spacing: .05em;
  text-transform: uppercase;
}
.panel-lead {
  margin: 7px 0 0;
  color: var(--texto-suave);
  font: 400 13px/1.5 var(--texto);
}
.compacto-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.compacto-head h2 { margin: 3px 0 0; }
.link-todos {
  padding: 7px 10px;
  border: 1px solid var(--tinta);
  border-radius: 2px;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: 600 9px var(--label);
  letter-spacing: .06em;
  text-transform: uppercase;
}
.link-todos:hover { background: var(--invertir-fondo); color: var(--invertir-texto); }

.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 16px 0 4px;
  text-align: center;
}
.tools input {
  flex: 1 1 240px;
  min-width: 0;
  min-height: 44px;
  padding: 9px 12px;
  border: 1px solid var(--linea-fuerte);
  border-radius: 3px;
  background: var(--superficie);
  color: var(--tinta);
  font: 400 15px var(--texto);
  text-align: center;
}
.tools input::placeholder { color: var(--texto-tenue); }
.tools input:focus { border-color: var(--rojo); outline: 2px solid rgba(200, 16, 46, .12); }
.filtros { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
.filtro {
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid var(--linea-fuerte);
  border-radius: 3px;
  background: var(--superficie);
  color: var(--texto-suave);
  cursor: pointer;
  font: 600 12px var(--label);
  letter-spacing: .03em;
  text-align: center;
  transition: background .15s ease, border-color .15s ease, color .15s ease;
}
.filtro:hover { border-color: var(--rojo); color: var(--rojo); }
.filtro.on { background: var(--rojo); border-color: var(--rojo); color: #fff; }
.criterio {
  margin: 6px 0 8px;
  color: var(--texto-tenue);
  font: 500 12px var(--label);
  letter-spacing: .02em;
  text-align: center;
}
.criterio b { color: var(--tinta); }

.rival-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
  margin-top: 16px;
  align-items: stretch;
}
/* El inicio muestra 8 equipos: siempre dos columnas para cerrar 4 filas parejas. */
.compacto .rival-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.rival-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--beige-soft);
  border: 1px solid var(--linea);
  border-radius: var(--radio);
  transition: border-color .15s ease, box-shadow .15s ease;
}
.rival-card:hover { border-color: var(--linea-fuerte); box-shadow: var(--sombra-dura); }
.compacto .rival-card { padding: 11px; gap: 8px; }

/* Fichas centradas y con tipografía más grande solo en la lista completa. */
.panel:not(.compacto) .rival-grid {
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 14px;
}
.panel:not(.compacto) .rival-card { padding: 18px 16px; gap: 12px; text-align: center; }
.panel:not(.compacto) .rc-head { justify-content: center; }
.panel:not(.compacto) .rc-crest { width: 54px; height: 54px; }
.panel:not(.compacto) .escudo-ini { font-size: 22px; }
.panel:not(.compacto) .rc-titulo h3 { font-size: 19px; line-height: 1.2; white-space: normal; text-align: center; }
.panel:not(.compacto) .rc-titulo p { font-size: 11px; text-align: center; }
.panel:not(.compacto) .rc-ovr strong { font-size: 24px; }
.panel:not(.compacto) .rc-ovr span { font-size: 9px; }
.panel:not(.compacto) .rc-datos { gap: 9px 14px; }
.panel:not(.compacto) .rc-datos > div { text-align: center; }
.panel:not(.compacto) .rc-datos dt { font-size: 10px; }
.panel:not(.compacto) .rc-datos dd { font-size: 14px; }
.panel:not(.compacto) .rc-btn { justify-content: center; min-height: 42px; font-size: 13px; }

.rc-head { display: flex; align-items: center; gap: 10px; }
.rc-crest {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  flex: none;
  padding: 4px;
  background: var(--superficie);
  border: 1px solid var(--linea);
  border-radius: 3px;
}
.compacto .rc-crest { width: 38px; height: 38px; }
.rc-crest .escudo { width: 100%; height: 100%; object-fit: contain; }
.escudo-ini {
  color: var(--texto-tenue);
  font: 700 18px var(--display);
  text-transform: uppercase;
}
.rc-titulo { min-width: 0; flex: 1; }
.rc-titulo h3 {
  margin: 0;
  color: var(--tinta);
  font: 600 16px/1.15 var(--display);
  letter-spacing: -.005em;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.compacto .rc-titulo h3 { font-size: 14px; }
.rc-titulo p {
  margin: 3px 0 0;
  color: var(--texto-tenue);
  font: 600 9px var(--label);
  letter-spacing: .05em;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rc-ovr {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: none;
  min-width: 42px;
  padding: 4px 6px;
  background: var(--superficie);
  border: 1px solid var(--linea-roja);
  border-radius: 2px;
}
.rc-ovr strong { color: var(--rojo); font: 700 20px/1 var(--num); }
.rc-ovr span {
  margin-top: 2px;
  color: var(--texto-tenue);
  font: 600 7px var(--label);
  letter-spacing: .08em;
}

.rc-datos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px 12px;
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid var(--linea);
}
.rc-datos > div { min-width: 0; }
.rc-datos dt {
  color: var(--texto-tenue);
  font: 600 8px var(--label);
  letter-spacing: .06em;
  text-transform: uppercase;
}
.rc-datos dd {
  margin: 1px 0 0;
  color: var(--texto-suave);
  font: 600 12px/1.3 var(--texto);
  overflow-wrap: anywhere;
}
.rc-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  margin-top: auto;
  padding: 0 10px;
  border: 1px solid var(--tinta);
  border-radius: 2px;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: 600 10px var(--display);
  letter-spacing: .05em;
  text-transform: uppercase;
}
.rc-btn:hover { background: var(--invertir-fondo); color: var(--invertir-texto); }

.mas { margin-top: 16px; text-align: center; }
.mas .btn, .mas span { font-size: 13px; }

@media (max-width: 640px) {
  .panel, .panel.compacto { padding: 18px 14px; }
  .panel h2 { font-size: 26px; }
  .panel:not(.compacto) h2 { font-size: 28px; }
  .panel-lead { font-size: 13px; }
  .panel:not(.compacto) .panel-lead { font-size: 14px; }
  .tools { gap: 8px; margin-top: 14px; }
  .tools input { flex-basis: 100%; min-height: 46px; font-size: 16px; }
  .filtros { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; width: 100%; }
  .filtro { min-height: 44px; padding: 0 8px; }
  .rival-grid { grid-template-columns: 1fr; gap: 10px; }
  .compacto .rival-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .rival-card, .compacto .rival-card { padding: 13px; gap: 10px; }
  .rc-crest, .compacto .rc-crest { width: 44px; height: 44px; }
  .rc-titulo h3, .compacto .rc-titulo h3 { font-size: 16px; }
  .panel:not(.compacto) .rival-grid { grid-template-columns: 1fr; gap: 12px; }
  .panel:not(.compacto) .rival-card { padding: 15px 14px; gap: 12px; }
  .panel:not(.compacto) .rc-crest { width: 48px; height: 48px; }
  .panel:not(.compacto) .rc-titulo h3 { font-size: 18px; }
  .rc-btn { min-height: 42px; }
  /* En dos columnas el compacto se ajusta para que las fichas sigan legibles. */
  .compacto .rival-card { padding: 10px; gap: 7px; }
  .compacto .rc-crest { width: 32px; height: 32px; }
  .compacto .rc-titulo h3 { font-size: 13px; white-space: normal; }
  .compacto .rc-ovr { min-width: 34px; padding: 3px 4px; }
  .compacto .rc-ovr strong { font-size: 16px; }
  .compacto .rc-datos { grid-template-columns: 1fr; gap: 4px; }
  .compacto .rc-btn { min-height: 44px; padding: 0 7px; }
}
</style>
