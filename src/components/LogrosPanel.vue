<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { obtenerLogros } from '../services/api.js'
import { DIFICULTAD_POR_MEDALLA, medallaPrometida, resumenRecompensas } from '../game/recompensas.js'

const props = defineProps({
  partidaId: { type: Number, default: null },
  // El detalle (fecha, dificultad, medallas y desglose) es solo para "Tus drafts".
  detallado: { type: Boolean, default: false }
})

const LABELS = {
  primer_partido: 'Debut: crear tu primera partida',
  primer_campeon: 'Primer campeón',
  siete_cero: '7A0 perfecto',
  campeon_debil: 'Campeón con equipo humilde (OVR < 82)',
  campeon_almanaque: 'Campeón a ciegas',
  goleada: 'Goleada (ganar por 4+)',
  valla_grupo: 'Grupos sin recibir goles',
  revancha_ok: 'Revancha cumplida',
  campeon_premier: 'Campeón Premier',
  campeon_liga30: 'Campeón Argentina',
  clasico_ganado: 'Clásico ganado vs Boca',
  asistencia: 'Primer pase gol',
  hat_trick: 'Hat-trick',
  diez_goles: '10 goles en un torneo',
  campeon_invicto: 'Campeón invicto',
  veterano: 'Veterano (5 torneos)',
  cinco_goles_un_jugador: '5 goles de un mismo jugador',
  cinco_asistencias: '5 pases gol en una competencia',
  torneo_perfecto: 'Torneo perfecto (7 victorias)',
  valla_total: 'Valla total (7 partidos sin goles en contra)',
  clasico_doble: 'Clásico doble (ida y vuelta ganadas)'
}

const DESC = {
  primer_partido: 'Tocá Crear partida por primera vez en Inicio.',
  primer_campeon: 'Ganá cualquier competencia por primera vez.',
  siete_cero: 'Salí campeón sin recibir goles en toda la competencia.',
  campeon_debil: 'Ganá un torneo con promedio de OVR menor a 82.',
  campeon_almanaque: 'Ganá un torneo jugando en De Memoria, sin ver OVR.',
  goleada: 'Ganá un partido por 4 goles o más.',
  valla_grupo: 'Terminá los 3 partidos de grupo del Mundial sin recibir goles.',
  revancha_ok: 'Jugá y ganá la revancha amistosa del torneo clásico.',
  campeon_premier: 'Ganá la Premier (38 fechas).',
  campeon_liga30: 'Ganá la Argentina (zonas, interzonal y playoffs).',
  clasico_ganado: 'Ganá el clásico contra Boca en una liga.',
  asistencia: 'Dale un pase gol a un compañero y que termine en gol.',
  hat_trick: 'Un mismo jugador anota 3 goles en un partido.',
  diez_goles: 'Sumá 10 goles en una sola competencia.',
  campeon_invicto: 'Salí campeón sin perder ningún partido.',
  veterano: 'Completá 5 competencias (se suman todas las partidas).',
  cinco_goles_un_jugador: 'Un mismo jugador anota 5 goles en una competencia.',
  cinco_asistencias: 'Sumá 5 pases gol en una competencia.',
  torneo_perfecto: 'Ganá los 7 partidos de una competencia (sin amistosos).',
  valla_total: 'Jugá 7 partidos oficiales y no recibas ningún gol.',
  clasico_doble: 'Ganá el clásico de ida y el de vuelta contra Boca en la Premier.'
}

const mios = ref([])
const recompensa = ref(resumenRecompensas())
function actualizarRecompensa() { recompensa.value = resumenRecompensas() }

// `api/logros.php` ya devuelve codigo y fecha: armamos el mapa para saber
// cuándo se consiguió cada chip sin pedir nada nuevo al servicio.
const fechaPorCodigo = computed(() => {
  const mapa = {}
  for (const m of mios.value) if (m?.codigo) mapa[m.codigo] = m.fecha ?? ''
  return mapa
})
function esOn(cod) { return Object.prototype.hasOwnProperty.call(fechaPorCodigo.value, cod) }
function fechaLegible(fecha) {
  const s = String(fecha ?? '').trim()
  return s ? s.slice(0, 10) : '' // YYYY-MM-DD, sin inventar hora
}
const desgloseTexto = computed(() => recompensa.value.desglose
  .filter((m) => m.cantidad > 0)
  .map((m) => `${m.icono} ${m.cantidad} ${m.nombre}`)
  .join(' · '))

// Los 4 rangos se muestran siempre. El actual es la mejor medalla ganada
// (`resumenRecompensas().medalla`); los demás quedan en gris con candado,
// pero con su requisito y su cantidad a la vista.
const rangos = computed(() => {
  const actual = recompensa.value.medalla?.clave ?? 'bronce'
  return recompensa.value.desglose.map((m) => ({
    ...m,
    requisito: DIFICULTAD_POR_MEDALLA[m.clave] ?? '',
    actual: m.clave === actual
  }))
})

const tipActivo = ref('')
const codTip = ref('')
const tipPos = ref({ top: 0, left: 0, arriba: true })
let ultimoEsTouch = false
function tipDe(e) { return e.currentTarget?.getAttribute('data-tip') ?? '' }
function codDe(e) { return e.currentTarget?.getAttribute('data-cod') ?? '' }
function limpiarTip() { tipActivo.value = ''; codTip.value = '' }
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
  codTip.value = codDe(e)
  tipActivo.value = t
}
function alSalirTip(e) { if (e.pointerType !== 'touch') limpiarTip() }
function alTocarTip(e) {
  if (e.pointerType !== 'touch') return
  ultimoEsTouch = true
  const t = tipDe(e)
  if (tipActivo.value === t) { limpiarTip(); return }
  posarTip(e)
  codTip.value = codDe(e)
  tipActivo.value = t
}
function alFocoTip(e) {
  if (ultimoEsTouch) return
  const t = tipDe(e)
  if (!t) return
  posarTip(e)
  codTip.value = codDe(e)
  tipActivo.value = t
}
function alDesenfocarTip() { limpiarTip() }
function cerrarTipFuera(e) {
  if (tipActivo.value && !e.target.closest?.('[data-tip], .tip-globo')) limpiarTip()
}
function cerrarTipScroll() { limpiarTip() }
const tipHandlers = {
  onPointerenter: alEntrarTip, onPointerleave: alSalirTip, onPointerdown: alTocarTip,
  onFocus: alFocoTip, onBlur: alDesenfocarTip
}

async function cargar() {
  try {
    // Con partida devuelve los logros de esa partida; sin ella, los globales.
    mios.value = await obtenerLogros(props.partidaId)
  } catch { mios.value = [] /* tabla puede no existir aún */ }
}

onMounted(() => {
  cargar()
  actualizarRecompensa()
  window.addEventListener('3a1:logro', actualizarRecompensa)
  document.addEventListener('pointerdown', cerrarTipFuera)
  window.addEventListener('scroll', cerrarTipScroll, true)
  window.addEventListener('resize', cerrarTipScroll)
})
onBeforeUnmount(() => {
  window.removeEventListener('3a1:logro', actualizarRecompensa)
  document.removeEventListener('pointerdown', cerrarTipFuera)
  window.removeEventListener('scroll', cerrarTipScroll, true)
  window.removeEventListener('resize', cerrarTipScroll)
})
watch(() => props.partidaId, () => { cargar(); actualizarRecompensa() })
</script>

<template>
  <div class="panel sub">
    <h2><span class="h-bar"></span>Logros</h2>
    <div class="recompensa">
      <template v-if="detallado">
        <span class="medalla" aria-hidden="true">{{ recompensa.medalla.icono }}</span>
        <span class="recompensa-datos">
          <strong>{{ recompensa.medallas }} medallas · {{ recompensa.nivel }}</strong>
          <small>{{ recompensa.dificultad.etiqueta }}<template v-if="recompensa.siguiente"> · {{ recompensa.paraSiguiente }} logro en {{ recompensa.siguienteDificultad }} para {{ recompensa.siguiente }}</template></small>
          <small v-if="recompensa.clasificadas && desgloseTexto" class="desglose-medallas">{{ desgloseTexto }}</small>
          <small v-else-if="recompensa.sinClasificar" class="desglose-medallas">{{ recompensa.sinClasificar }} sin clasificar</small>
        </span>
      </template>
      <template v-else>
        <span class="medalla" aria-hidden="true">🏅</span>
        <span class="recompensa-datos">
          <strong>{{ recompensa.medallas }} medallas</strong>
          <small>{{ recompensa.nivel }}<template v-if="recompensa.siguiente"> · {{ recompensa.paraSiguiente }} para {{ recompensa.siguiente }}</template></small>
        </span>
      </template>
    </div>
    <div class="rangos" aria-label="Rangos de medallas">
      <div v-for="m in rangos" :key="m.clave" class="rango"
           :class="{ actual: m.actual, bloqueado: !m.actual }"
           :aria-label="`${m.nombre}: ${m.cantidad} ganadas${m.actual ? ', rango actual' : ', bloqueado'}`">
        <span class="rango-cabecera">
          <span class="rango-icono" aria-hidden="true">{{ m.icono }}</span>
          <strong>{{ m.nombre }}</strong>
          <span v-if="!m.actual" class="rango-candado" aria-hidden="true">🔒</span>
        </span>
        <small class="rango-requisito">{{ m.requisito }}</small>
        <span class="rango-conteo">{{ m.cantidad }} ganada{{ m.cantidad === 1 ? '' : 's' }}</span>
        <span v-if="m.actual" class="rango-actual">Rango actual</span>
      </div>
    </div>
    <div class="chips">
      <span v-for="(label, cod) in LABELS" :key="cod" class="chip"
            :class="{ on: detallado ? esOn(cod) : mios.some((m) => m.codigo === cod) }"
            tabindex="0" v-bind="tipHandlers" :data-tip="DESC[cod]"
            :data-cod="detallado ? cod : undefined">
        {{ label }}
      </span>
    </div>
  </div>
  <div v-if="tipActivo" class="tip-globo" :class="{ abajo: !tipPos.arriba }"
       :style="{ top: tipPos.top + 'px', left: tipPos.left + 'px' }" role="tooltip">
    <span class="tip-globo-label">ℹ Cómo se desbloquea</span>
    <p>{{ tipActivo }}</p>
    <template v-if="detallado && codTip">
      <small v-if="esOn(codTip)" class="tip-fecha" :title="fechaPorCodigo[codTip]">
        ✔ Conseguido: {{ fechaLegible(fechaPorCodigo[codTip]) || 'sin fecha registrada' }}
      </small>
      <small class="tip-dificultad">Dificultad: {{ recompensa.dificultad.etiqueta }}</small>
      <small v-if="medallaPrometida(codTip)" class="tip-recompensa">
        {{ medallaPrometida(codTip).icono }} Medalla mínima: {{ medallaPrometida(codTip).nombre }}
      </small>
      <small v-else class="tip-recompensa">{{ recompensa.dificultad.medalla.icono }} Medalla: {{ recompensa.dificultad.medalla.nombre }}</small>
    </template>
    <small v-else-if="detallado" class="tip-recompensa">🏅 Recompensa: +1 medalla · {{ recompensa.dificultad.medalla.nombre }}</small>
    <small v-else class="tip-recompensa">🏅 Recompensa: +1 medalla</small>
  </div>
</template>

<style scoped>
.sub { margin-top: 14px; }
.recompensa { display: inline-flex; align-items: center; gap: 10px; margin: 2px 0 12px;
  padding: 7px 13px; border: 1px solid var(--linea); border-radius: 8px; background: var(--superficie-baja); }
.medalla { font-size: 20px; line-height: 1; }
.recompensa-datos { display: flex; flex-direction: column; line-height: 1.25; }
.recompensa-datos strong { color: var(--texto-verde); font: 700 13px var(--num); }
.recompensa-datos small { color: var(--texto-tenue); font: 500 10px var(--mono); }
.desglose-medallas { color: #a8842c !important; }
.rangos { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin: 2px 0 13px; }
.rango { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 8px 9px;
  border: 1px solid var(--linea); border-radius: 9px; background: var(--superficie-media); color: var(--texto-tenue); }
.rango.actual { border-color: #a8842c; background: linear-gradient(180deg, var(--superficie-dorada), var(--superficie-dorada));
  box-shadow: 0 2px 10px rgba(168,132,44,.22); color: var(--texto-verde); }
.rango.bloqueado { opacity: .72; }
.rango-cabecera { display: flex; align-items: center; gap: 5px; }
.rango-icono { font-size: 17px; line-height: 1; filter: grayscale(1); }
.rango.actual .rango-icono { filter: none; }
.rango-cabecera strong { font: 700 11px var(--num); }
.rango-candado { margin-left: auto; font-size: 11px; }
.rango-requisito { font: 500 9px/1.35 var(--mono); color: var(--texto-tenue); }
.rango-conteo { font: 700 10px var(--num); color: #a8842c; }
.rango-actual { align-self: flex-start; padding: 1px 5px; border-radius: 999px;
  background: #a8842c; color: #fff; font: 700 8px var(--mono); text-transform: uppercase; letter-spacing: .04em; }
@media (max-width: 720px) { .rangos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.tip-recompensa { display: block; margin-top: 5px; color: #a8842c; font: 700 10px var(--mono); }
.tip-fecha, .tip-dificultad { display: block; margin-top: 5px; color: #4f5b50; font: 600 10px var(--mono); }
.tip-dificultad { color: var(--texto-tenue); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { border: 1px dashed #cfc5b2; color: var(--texto-tenue); border-radius: 10px; padding: 6px 12px; font-size: 13px; cursor: help; }
.tip-globo { position: fixed; z-index: 71; width: 244px; max-width: calc(100vw - 24px);
  padding: 9px 12px; background: var(--superficie-baja); color: var(--tinta); border: 1px solid #c8102e;
  border-radius: 8px; box-shadow: 0 14px 34px rgba(0,0,0,.34); --ty: -100%;
  transform: translate(-50%, var(--ty)); will-change: transform, opacity;
  animation: globo-in .16s ease-out; }
.tip-globo.abajo { --ty: 0; }
.tip-globo::after { content: ''; position: absolute; left: 50%; bottom: -7px; width: 12px; height: 12px;
  margin-left: -6px; background: var(--superficie-baja); border-right: 1px solid #c8102e; border-bottom: 1px solid #c8102e;
  transform: rotate(45deg); }
.tip-globo.abajo::after { bottom: auto; top: -7px; border: 0; border-left: 1px solid #c8102e; border-top: 1px solid #c8102e; }
.tip-globo-label { display: block; font: 600 10px 'JetBrains Mono', monospace; color: #c8102e; }
.tip-globo p { margin: 3px 0 0; font: 400 11px/1.45 'Inter', sans-serif; }
@keyframes globo-in {
  from { opacity: 0; transform: translate(-50%, var(--ty)) scale(.94); }
  to   { opacity: 1; transform: translate(-50%, var(--ty)) scale(1); }
}
.chip.on { background: linear-gradient(180deg, #d4af37, #a8842c); color: #fff; border-style: solid; border-color: transparent; font-weight: 700; box-shadow: 0 2px 8px rgba(168,132,44,.4); }
.h-bar { display: inline-block; width: 5px; height: 18px; background: #c8102e; border-radius: 3px; margin-right: 8px; vertical-align: -3px; }
</style>
