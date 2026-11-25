<script setup>
import { ref, watch } from 'vue'
import RivalesPanel from '../components/RivalesPanel.vue'
import HistorialPanel from '../components/HistorialPanel.vue'
import PalmaresPanel from '../components/PalmaresPanel.vue'
import LogrosPanel from '../components/LogrosPanel.vue'
import RankingConectadoPanel from '../components/RankingConectadoPanel.vue'

const props = defineProps({
  almanaque: { type: Boolean, default: false },
  partidaId: { type: [Number, String], default: null },
  seccion: { type: String, default: 'rivales' }
})

const pestañas = [
  // El id interno sigue siendo 'rivales'; solo cambia la etiqueta visible.
  { id: 'rivales', etiqueta: 'Equipos', detalle: 'Planteles de época' },
  { id: 'historial', etiqueta: 'Historial', detalle: 'Partidos y resultados' },
  { id: 'palmares', etiqueta: 'Lo que ganaste', detalle: 'Títulos y rachas' },
  { id: 'logros', etiqueta: 'Logros', detalle: 'Objetivos cumplidos' },
  { id: 'ranking', etiqueta: 'Ranking', detalle: 'Compartido en la base' }
]
const idsPestañas = pestañas.map((p) => p.id)
// Una sección desconocida nunca debe dejar el contenido vacío.
function seccionValida(s) { return idsPestañas.includes(s) ? s : 'rivales' }
const activa = ref(seccionValida(props.seccion))
watch(() => props.seccion, (s) => { activa.value = seccionValida(s) })
</script>

<template>
  <section class="view">
    <header class="view-head">
      <div class="head-copy">
        <span class="eyebrow"><i aria-hidden="true"></i>Tu recorrido</span>
        <h1>Tus drafts</h1>
        <p>Equipos, partidos, títulos y logros. Todo lo que fuiste construyendo, en un solo lugar.</p>
      </div>
      <div class="head-side" aria-hidden="true">
        <span>Archivo personal</span>
        <strong>3A1</strong>
        <small>Draft histórico</small>
      </div>
    </header>

    <nav class="subnav" aria-label="Secciones de tus drafts">
      <button v-for="p in pestañas" :key="p.id" type="button"
              :class="['subtab', { on: activa === p.id }]"
              :aria-current="activa === p.id ? 'page' : undefined"
              @click="activa = p.id">
        <span class="subtab-label">{{ p.etiqueta }}</span>
        <small>{{ p.detalle }}</small>
      </button>
    </nav>

    <div class="contenido">
      <!-- v-show mantiene montadas las cinco secciones: al cambiar de pestaña no se pierde
           la búsqueda, los filtros ni los paneles abiertos, y siempre hay contenido detrás. -->
      <div v-show="activa === 'rivales'">
        <RivalesPanel :almanaque="props.almanaque" />
      </div>
      <div v-show="activa === 'historial'">
        <HistorialPanel :almanaque="props.almanaque" />
      </div>
      <div v-show="activa === 'palmares'">
        <PalmaresPanel detallado />
      </div>
      <div v-show="activa === 'logros'">
        <LogrosPanel :partida-id="props.partidaId" detallado />
      </div>
      <div v-show="activa === 'ranking'">
        <RankingConectadoPanel />
      </div>
    </div>
  </section>
</template>

<style scoped>
.view { max-width: 1180px; margin: 0 auto; padding: 34px 0 80px; }

/* ---------- Portada ---------- */
.view-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  padding-bottom: 26px;
  border-bottom: 1px solid var(--linea);
}
.head-copy { min-width: 0; }
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--texto-suave);
  font: 600 10px var(--label);
  letter-spacing: .14em;
  text-transform: uppercase;
}
.eyebrow i { width: 6px; height: 6px; border-radius: 50%; background: var(--rojo); }
.head-copy h1 {
  margin: 10px 0 10px;
  color: var(--tinta);
  font: 700 clamp(40px, 5vw, 62px)/.95 var(--display);
  letter-spacing: -.03em;
  text-transform: uppercase;
}
.head-copy p {
  max-width: 620px;
  margin: 0;
  color: var(--texto-suave);
  font: 400 15px/1.55 var(--texto);
}
.head-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex: none;
  padding-left: 28px;
  border-left: 1px solid var(--linea);
}
.head-side span {
  color: var(--texto-tenue);
  font: 600 9px var(--label);
  letter-spacing: .1em;
  text-transform: uppercase;
}
.head-side strong {
  margin: 3px 0 1px;
  color: var(--rojo);
  font: 700 43px/.9 var(--display);
  letter-spacing: -.02em;
}
.head-side small {
  color: var(--texto-tenue);
  font: 500 9px var(--label);
  letter-spacing: .08em;
  text-transform: uppercase;
}

/* ---------- Subnavegación ---------- */
.subnav {
  display: flex;
  gap: 5px;
  margin: 20px 0 0;
  padding: 5px;
  background: var(--superficie);
  border: 1px solid var(--linea);
  border-radius: var(--radio);
  box-shadow: var(--sombra-dura);
  overflow-x: auto;
  scrollbar-width: none;
}
.subnav::-webkit-scrollbar { display: none; }
.subtab {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  flex: 1;
  min-width: 132px;
  padding: 9px 13px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--texto-suave);
  text-align: left;
  cursor: pointer;
  transition: background .15s ease, color .15s ease;
}
.subtab:hover { background: var(--beige-soft); color: var(--tinta); }
.subtab.on { background: var(--rojo); border-color: var(--rojo); color: #fff; }
.subtab-label {
  font: 600 12px var(--display);
  letter-spacing: .035em;
  text-transform: uppercase;
  white-space: nowrap;
}
.subtab small {
  font: 500 8.5px var(--label);
  letter-spacing: .04em;
  color: var(--texto-tenue);
  white-space: nowrap;
}
.subtab.on small { color: rgba(255, 255, 255, .72); }

.contenido { padding-top: 24px; }

:focus-visible { outline: 2px solid var(--rojo); outline-offset: 2px; }

@media (max-width: 720px) {
  .view { padding: 24px 0 60px; }
  .view-head { padding-bottom: 20px; }
  .head-copy h1 { font-size: 40px; }
  .head-copy p { font-size: 14px; }
  .head-side { display: none; }
  .subnav { margin-top: 16px; padding: 4px; }
  .subtab { min-width: 0; padding: 8px 10px; }
  .subtab small { display: none; }
  .subtab-label { font-size: 11px; }
  .contenido { padding-top: 16px; }
}
</style>
