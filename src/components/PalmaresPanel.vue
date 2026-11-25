<script setup>
import { computed, onMounted, ref } from 'vue'
import { obtenerRanking } from '../services/api.js'
import { leerRachaClasico } from '../game/palmares.js'

// Los títulos se leen solo del ranking (MySQL). `resumenPalmares()` queda fuera
// a propósito: es memoria del navegador y no debe mezclarse con los campeonatos reales.
// La fecha del campeonato aparece solo en la vista detallada de "Tus drafts".
defineProps({ detallado: { type: Boolean, default: false } })

const FORMATOS = {
  siete: { etiqueta: 'Torneo clásico (7 partidos)', corta: '7A' },
  copa: { etiqueta: 'Mundial', corta: 'MUN' },
  premier: { etiqueta: 'Premier', corta: 'PR' },
  liga30: { etiqueta: 'Argentina', corta: 'ARG' }
}
const ORDEN_FORMATOS = ['siete', 'copa', 'premier', 'liga30']

const carga = ref('cargando')
const ranking = ref([])
const racha = ref({ g: 0, e: 0, p: 0 })

const marcado = (v) => Number(v) === 1
const corta = (formato) => FORMATOS[formato]?.corta ?? String(formato ?? '?')
// La fecha viene de ranking.php (torneos); si no está en la DB, se oculta.
function fechaCorta(v) {
  const s = String(v ?? '').trim()
  return s ? s.slice(0, 10) : '' // YYYY-MM-DD, sin inventar hora
}

const campeones = computed(() => ranking.value.filter((r) => marcado(r.campeon)))
const totalTitulos = computed(() => campeones.value.length)
const titulosSieteCero = computed(() => campeones.value.filter((r) => marcado(r.siete_cero)).length)
const vallasCampeon = computed(() => campeones.value.filter((r) => marcado(r.valla)).length)
const torneosFinalizados = computed(() => ranking.value.length)
const recientes = computed(() => campeones.value.slice(0, 5))
const desglose = computed(() => ORDEN_FORMATOS.map((formato) => {
  const filas = ranking.value.filter((r) => r.formato === formato)
  return {
    formato,
    etiqueta: FORMATOS[formato].etiqueta,
    titulos: filas.filter((r) => marcado(r.campeon)).length,
    torneos: filas.length,
    partidos: filas.reduce((sum, r) => sum + (Number(r.jugados) || 0), 0)
  }
}))

function normalizarRacha(r) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return { g: n(r?.g), e: n(r?.e), p: n(r?.p) }
}

onMounted(async () => {
  racha.value = normalizarRacha(leerRachaClasico())
  try {
    const datos = await obtenerRanking()
    ranking.value = Array.isArray(datos) ? datos : []
    carga.value = ranking.value.length ? 'ok' : 'vacio'
  } catch {
    ranking.value = []
    carga.value = 'error'
  }
})
</script>

<template>
  <section class="panel palmares">
    <span class="kicker">Palmarés</span>
    <h2>Lo que ganaste.</h2>
    <p class="subtitulo">
      Los campeonatos salen del ranking guardado en el servicio, no del navegador.
      La racha del clásico es la única info local y va separada al final.
    </p>

    <p v-if="carga === 'cargando'" class="estado">Cargando ranking…</p>

    <div v-else-if="carga === 'error'" class="estado estado-error">
      <strong>No se pudo cargar el ranking</strong>
      <small>Volvé a intentar cuando el servidor esté disponible.</small>
    </div>

    <div v-else-if="carga === 'vacio'" class="estado estado-vacio">
      <strong>Todavía no hay torneos finalizados</strong>
      <p>Cuando termines un torneo, sus campeonatos van a aparecer acá.</p>
    </div>

    <template v-else>
      <article class="hero">
        <div class="hero-main">
          <span class="eyebrow">CAMPEONATOS REALES</span>
          <strong class="hero-num">{{ totalTitulos }}</strong>
          <span class="hero-label">título{{ totalTitulos === 1 ? '' : 's' }} en el ranking</span>
        </div>
        <div class="hero-subs">
          <div>
            <b>{{ titulosSieteCero }}</b>
            <span>títulos 7A0</span>
          </div>
          <div>
            <b>{{ vallasCampeon }}</b>
            <span>vallas invictas de campeón</span>
          </div>
          <div>
            <b>{{ torneosFinalizados }}</b>
            <span>torneos finalizados</span>
          </div>
        </div>
      </article>

      <h3>Por formato</h3>
      <div class="formatos">
        <div v-for="f in desglose" :key="f.formato" class="formato" :class="{ 'sin-datos': !f.torneos }">
          <div class="formato-top">
            <span class="formato-nombre">{{ f.etiqueta }}</span>
            <span class="formato-cant">{{ f.titulos }} campeonato{{ f.titulos === 1 ? '' : 's' }}</span>
          </div>
          <div class="formato-bar">
            <i :style="{ width: `${totalTitulos ? (f.titulos / totalTitulos) * 100 : 0}%` }"></i>
          </div>
          <div class="formato-meta">
            <span>{{ f.torneos }} torneo{{ f.torneos === 1 ? '' : 's' }} finalizado{{ f.torneos === 1 ? '' : 's' }}</span>
            <span>{{ f.partidos }} partidos jugados</span>
          </div>
        </div>
      </div>

      <h3>Campeonatos más recientes</h3>
      <p v-if="!recientes.length" class="vacio-lista">
        Los torneos finalizados todavía no incluyen ningún campeón.
      </p>
      <ul v-else class="lista-titulos">
        <li v-for="r in recientes" :key="r.id">
          <span class="fmt-badge" :class="`fmt-${r.formato}`">{{ corta(r.formato) }}</span>
          <span class="equipo">{{ r.nombre_equipo }}</span>
          <span class="detalle">{{ r.gf }}–{{ r.gc }} · {{ r.jugados }} PJ<template v-if="detallado && fechaCorta(r.fecha)"> · <span class="fecha-titulo" :title="`Campeonato: ${r.fecha}`">{{ fechaCorta(r.fecha) }}</span></template></span>
          <span v-if="marcado(r.siete_cero)" class="badge goldbg">7A0</span>
          <span v-if="marcado(r.valla)" class="badge goldbg">Valla</span>
        </li>
      </ul>
    </template>

    <div class="racha-local">
      <div class="racha-head">
        <span class="racha-kicker">Racha del clásico (en este dispositivo)</span>
        <span class="racha-nota">Dato local · no suma títulos</span>
      </div>
      <div class="racha-numeros">
        <div><b>{{ racha.g }}</b><span>G</span></div>
        <div><b>{{ racha.e }}</b><span>E</span></div>
        <div><b>{{ racha.p }}</b><span>P</span></div>
      </div>
      <p class="racha-ayuda">Se guarda en este navegador y es independiente del ranking.</p>
    </div>
  </section>
</template>

<style scoped>
.palmares { padding: 26px; }
.kicker {
  display: block;
  color: var(--rojo);
  font: 600 9px var(--label);
  letter-spacing: .12em;
  text-transform: uppercase;
}
.palmares h2 {
  margin: 3px 0 6px;
  font: 600 30px/.98 var(--display);
  letter-spacing: -.02em;
  text-transform: uppercase;
}
.subtitulo {
  max-width: 760px;
  margin: 0 0 18px;
  color: var(--texto-suave);
  font: 400 13px/1.5 var(--texto);
}
.palmares h3 {
  margin: 22px 0 10px;
  color: var(--tinta);
  font: 600 14px var(--display);
  letter-spacing: .05em;
  text-transform: uppercase;
}

.estado {
  padding: 16px;
  border: 1px dashed var(--linea-fuerte);
  border-radius: var(--radio);
  background: var(--beige-soft);
  color: var(--texto-suave);
  font: 400 13px/1.5 var(--texto);
}
.estado-error { border-color: var(--linea-roja); background: var(--superficie-roja); }
.estado-error strong { display: block; color: var(--rojo); font: 600 15px var(--display); text-transform: uppercase; }
.estado-error small { font: 500 10px var(--label); }
.estado-vacio strong { display: block; color: var(--tinta); font: 600 15px var(--display); text-transform: uppercase; }
.estado-vacio p { margin: 4px 0 0; }

/* Marcador principal del palmarés. */
.hero {
  display: grid;
  grid-template-columns: minmax(190px, .9fr) 1.6fr;
  gap: 24px;
  align-items: center;
  padding: 22px 24px;
  border-left: 4px solid var(--rojo);
  border-radius: var(--radio);
  background:
    radial-gradient(90% 130% at 100% 0%, rgba(197, 155, 39, .12), transparent 60%),
    var(--tinta);
  color: #fff;
}
.hero-main { display: flex; flex-direction: column; }
.eyebrow {
  color: var(--oro-claro);
  font: 600 9px var(--label);
  letter-spacing: .12em;
  text-transform: uppercase;
}
.hero-num {
  margin: 4px 0 2px;
  color: #fff;
  font: 700 66px/.86 var(--num);
  letter-spacing: -.03em;
}
.hero-label {
  color: #b9b3a4;
  font: 500 9px var(--label);
  letter-spacing: .07em;
  text-transform: uppercase;
}
.hero-subs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.hero-subs > div { padding-left: 13px; border-left: 1px solid rgba(255, 255, 255, .18); }
.hero-subs b { display: block; color: var(--oro-claro); font: 600 30px/1 var(--num); }
.hero-subs span {
  display: block;
  margin-top: 5px;
  color: #b9b3a4;
  font: 500 9px/1.35 var(--label);
  letter-spacing: .04em;
  text-transform: uppercase;
}

.formatos { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
.formato {
  padding: 13px;
  border: 1px solid var(--linea);
  border-radius: var(--radio);
  background: var(--beige-soft);
}
.formato.sin-datos { opacity: .62; }
.formato-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.formato-nombre { font: 600 13px/1.3 var(--texto); }
.formato-cant { color: var(--rojo); font: 600 8.5px var(--label); letter-spacing: .03em; text-transform: uppercase; white-space: nowrap; }
.formato-bar { height: 4px; margin: 10px 0 8px; overflow: hidden; border-radius: 999px; background: var(--superficie-media); }
.formato-bar i { display: block; height: 100%; background: var(--oro); }
.formato-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--texto-tenue);
  font: 500 9px var(--label);
  letter-spacing: .01em;
}

.vacio-lista {
  padding: 12px;
  border: 1px dashed var(--linea-fuerte);
  border-radius: var(--radio);
  color: var(--texto-suave);
  font: 400 13px var(--texto);
}
.lista-titulos { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.lista-titulos li {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 11px;
  border: 1px solid var(--linea);
  border-left: 3px solid var(--rojo);
  border-radius: 3px;
  background: var(--beige-soft);
  font-size: 13px;
}
.fmt-badge {
  padding: 3px 7px;
  border-radius: 2px;
  background: var(--invertir-fondo);
  color: var(--invertir-texto);
  font: 600 8px var(--label);
  letter-spacing: .06em;
  text-transform: uppercase;
}
.fmt-badge.fmt-siete { background: var(--rojo); }
.equipo { color: var(--tinta); font-weight: 600; }
.detalle { margin-left: auto; color: var(--texto-tenue); font: 500 10px var(--label); }
.detalle .fecha-titulo { color: var(--oro); font-weight: 700; }
.lista-titulos .badge { margin: 0; }

.racha-local {
  margin-top: 22px;
  padding: 15px 16px;
  border: 1px dashed var(--linea-fuerte);
  border-radius: var(--radio);
  background: var(--beige-soft);
}
.racha-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.racha-kicker { color: var(--tinta); font: 600 13px var(--display); text-transform: uppercase; letter-spacing: .02em; }
.racha-nota { color: var(--rojo); font: 600 8px var(--label); text-transform: uppercase; letter-spacing: .07em; }
.racha-numeros { display: flex; gap: 24px; margin-top: 10px; }
.racha-numeros > div { display: flex; align-items: baseline; gap: 6px; }
.racha-numeros b { color: var(--tinta); font: 600 30px/1 var(--num); }
.racha-numeros span { color: var(--texto-tenue); font: 600 10px var(--label); }
.racha-ayuda { margin: 8px 0 0; color: var(--texto-suave); font: 400 11px var(--texto); }

@media (max-width: 720px) {
  .palmares { padding: 18px 14px; }
  .palmares h2 { font-size: 27px; }
  .hero { grid-template-columns: 1fr; gap: 18px; padding: 18px 16px; }
  .hero-num { font-size: 56px; }
  .hero-subs { grid-template-columns: 1fr; gap: 9px; }
  .hero-subs > div { padding: 8px 0 0; border-left: 0; border-top: 1px solid rgba(255, 255, 255, .14); }
  .hero-subs b { font-size: 24px; }
  .detalle { margin-left: 0; flex-basis: 100%; }
  .lista-titulos li { padding: 10px; }
}
</style>
