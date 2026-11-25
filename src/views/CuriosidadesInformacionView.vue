<script setup>
import { computed, ref, watch } from 'vue'
import DocumentoBloques from '../components/DocumentoBloques.vue'
import { curiosidades } from '../contenido/curiosidades.js'
import { informacion } from '../contenido/informacion.js'

// Información y Privacidad comparten esta página; Curiosidades tiene su propia
// entrada. El contenido de cada una nunca se mezcla con las demás.
const props = defineProps({
  seccion: { type: String, default: 'informacion' },
  // En la entrada de Curiosidades no se muestran las pestañas de Información.
  unica: { type: Boolean, default: false }
})
const emit = defineEmits(['cambiar-seccion'])

const pestañas = [
  {
    id: 'informacion',
    etiqueta: 'Información',
    datos: informacion.filter((s) => s.grupo !== 'privacidad'),
    kicker: 'Producto',
    titulo: 'Conocé',
    acento: '3A1',
    lead: 'Todo lo que necesitás saber sobre el juego.'
  },
  {
    id: 'curiosidades',
    etiqueta: 'Curiosidades',
    datos: curiosidades,
    kicker: 'Detrás del juego',
    titulo: 'Curiosidades',
    acento: 'del archivo',
    lead: 'Historias, datos y decisiones que quedaron detrás de 3A1.'
  },
  {
    id: 'privacidad',
    etiqueta: 'Privacidad y seguridad',
    datos: informacion.filter((s) => s.grupo === 'privacidad'),
    kicker: 'Tu dispositivo',
    titulo: 'Privacidad',
    acento: 'y seguridad',
    lead: 'Qué se guarda en tu dispositivo y cómo se protege.'
  }
]
// Curiosidades queda fuera de esta página: si llega una sección ajena, se
// muestra la información general en lugar de una pestaña vacía.
const pestañasVisibles = computed(() => props.unica
  ? pestañas.filter((p) => p.id === 'curiosidades')
  : pestañas.filter((p) => p.id !== 'curiosidades'))
const activa = ref(props.unica ? 'curiosidades' : props.seccion)
watch(() => props.seccion, (s) => {
  if (!props.unica && s && s !== 'curiosidades') activa.value = s
})
const actual = computed(() => pestañas.find((p) => p.id === activa.value) ?? pestañas[0])

function elegir(id) {
  activa.value = id
  emit('cambiar-seccion', id)
}
function numero(i) {
  return String(i + 1).padStart(2, '0')
}
function irASeccion(i) {
  document.getElementById(`doc-sec-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section class="view">
    <header class="view-hero">
      <div class="hero-copy">
        <span class="eyebrow"><i aria-hidden="true"></i>{{ actual.kicker }}</span>
        <h1>{{ actual.titulo }} <em>{{ actual.acento }}</em></h1>
        <p class="hero-lead">{{ actual.lead }}</p>
      </div>
      <div class="hero-side">
        <img class="hero-crest" src="/logo-3a1.webp" alt="" width="400" height="321" />
      </div>
    </header>

    <div v-if="pestañasVisibles.length > 1" class="view-bar">
      <div class="doc-tabs" role="tablist" aria-label="Información y privacidad">
        <button v-for="p in pestañasVisibles" :key="p.id" type="button" role="tab"
                :aria-selected="activa === p.id" :class="['tab', { on: activa === p.id }]"
                @click="elegir(p.id)">{{ p.etiqueta }}</button>
      </div>
    </div>

    <div class="doc-layout">
      <aside class="doc-index" aria-label="Índice de la sección">
        <span class="index-kicker">En esta sección</span>
        <ol>
          <li v-for="(sec, i) in actual.datos" :key="sec.titulo">
            <button type="button" @click="irASeccion(i)">
              <span>{{ numero(i) }}</span>
              <b>{{ sec.titulo }}</b>
              <small v-if="sec.resumen">{{ sec.resumen }}</small>
            </button>
          </li>
        </ol>
        <div class="index-foot">
          <span>3A1 · Archivo histórico</span>
        </div>
      </aside>

      <article class="doc-body">
        <section v-for="(sec, i) in actual.datos" :id="`doc-sec-${i}`" :key="sec.titulo" class="doc-section">
          <header class="doc-section-head">
            <span class="doc-num" aria-hidden="true">{{ numero(i) }}</span>
            <div>
              <h2>{{ sec.titulo }}</h2>
              <p v-if="sec.resumen">{{ sec.resumen }}</p>
            </div>
          </header>
          <DocumentoBloques :bloques="sec.bloques" />
        </section>
        <div class="doc-cruce">
          <template v-if="unica">
            <button type="button" @click="emit('cambiar-seccion', 'informacion')">
              ← Volver a información y seguridad
            </button>
          </template>
          <template v-else>
            <button v-if="activa === 'informacion'" type="button" @click="elegir('privacidad')">
              Ver privacidad, cookies y seguridad →
            </button>
            <button v-if="activa === 'informacion'" type="button" @click="emit('cambiar-seccion', 'curiosidades')">
              Ver curiosidades →
            </button>
            <button v-else type="button" @click="elegir('informacion')">
              ← Volver a la información general
            </button>
          </template>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.view { max-width: 1180px; margin: 0 auto; padding: 0 0 80px; }

/* ---------- Portada ---------- */
.view-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 286px;
  gap: clamp(24px, 4vw, 56px);
  align-items: stretch;
  padding: 46px 0 34px;
}
.hero-copy { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
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
.hero-copy h1 {
  margin: 12px 0 14px;
  color: var(--tinta);
  font: 700 clamp(44px, 6vw, 76px)/.94 var(--display);
  letter-spacing: -.035em;
  text-transform: uppercase;
}
.hero-copy h1 em { color: var(--rojo); font-style: normal; }
.hero-lead {
  max-width: 560px;
  margin: 0;
  color: var(--texto-suave);
  font: 400 clamp(15px, 1.4vw, 18px)/1.5 var(--texto);
}

/* El logo queda en la misma columna, centrado y sin tarjeta ni fondo. */
.hero-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}
.hero-crest { display: block; width: min(170px, 100%); height: auto; margin: 0 auto; }

/* ---------- Pestañas ---------- */
.view-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 14px 0;
  border-top: 1px solid var(--linea);
  border-bottom: 1px solid var(--linea);
}
.doc-tabs {
  display: inline-flex;
  gap: 3px;
  padding: 4px;
  background: var(--superficie-media);
  border: 1px solid var(--linea);
  border-radius: 4px;
}
.tab {
  min-height: 36px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--texto-suave);
  cursor: pointer;
  font: 600 11px var(--display);
  letter-spacing: .05em;
  text-transform: uppercase;
  transition: background .15s ease, color .15s ease;
}
.tab:hover { color: var(--tinta); background: var(--hover-claro); }
.tab.on { background: var(--rojo); border-color: var(--rojo); color: #fff; }
/* ---------- Índice + contenido ---------- */
.doc-layout {
  display: grid;
  grid-template-columns: 248px minmax(0, 840px);
  justify-content: space-between;
  gap: clamp(26px, 4vw, 56px);
  align-items: start;
  padding-top: 34px;
}
.doc-index {
  position: sticky;
  top: calc(var(--header-h) + 18px);
  min-width: 0;
}
.index-kicker {
  display: block;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--linea);
  color: var(--texto-tenue);
  font: 600 9px var(--label);
  letter-spacing: .11em;
  text-transform: uppercase;
}
.doc-index ol { list-style: none; margin: 0; padding: 8px 0 0; }
.doc-index button {
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr);
  width: 100%;
  padding: 10px 8px 10px 10px;
  border: 0;
  border-left: 2px solid transparent;
  border-radius: 0 3px 3px 0;
  background: transparent;
  color: var(--tinta);
  text-align: left;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease;
}
.doc-index button:hover { border-left-color: var(--rojo); background: var(--hover-claro); }
.doc-index button > span {
  grid-row: 1 / 3;
  color: var(--rojo);
  font: 600 9px/1.5 var(--label);
  letter-spacing: .04em;
}
.doc-index button b {
  font: 600 12.5px/1.25 var(--display);
  letter-spacing: .015em;
  text-transform: uppercase;
}
.doc-index button small {
  grid-column: 2;
  margin-top: 2px;
  color: var(--texto-tenue);
  font: 400 11px/1.35 var(--texto);
}
.index-foot {
  margin-top: 18px;
  padding: 14px 10px 0;
  border-top: 1px solid var(--linea);
}
.index-foot span {
  color: var(--tinta);
  font: 700 12px var(--display);
  letter-spacing: .05em;
  text-transform: uppercase;
}
.index-foot p { margin: 4px 0 0; color: var(--texto-tenue); font: 400 11px/1.4 var(--texto); }

.doc-body { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.doc-section {
  padding: 28px 32px 30px;
  background: var(--superficie);
  border: 1px solid var(--linea);
  border-radius: var(--radio);
  box-shadow: var(--sombra-dura);
  scroll-margin-top: calc(var(--header-h) + 20px);
}
.doc-section-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--linea);
}
.doc-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 38px;
  height: 38px;
  border: 1px solid var(--linea-roja);
  border-radius: 2px;
  background: var(--superficie-roja);
  color: var(--rojo);
  font: 700 11px var(--label);
  letter-spacing: .02em;
}
.doc-section-head h2 {
  margin: 0;
  color: var(--tinta);
  font: 600 clamp(22px, 2.4vw, 27px)/1.08 var(--display);
  letter-spacing: -.015em;
  text-transform: uppercase;
}
.doc-section-head p {
  margin: 5px 0 0;
  color: var(--texto-tenue);
  font: 500 9.5px/1.35 var(--label);
  letter-spacing: .07em;
  text-transform: uppercase;
}
.doc-section :deep(p),
.doc-section :deep(li) { max-width: 74ch; }

.doc-cruce { display: flex; justify-content: flex-end; }
.doc-cruce button {
  padding: 10px 14px;
  border: 1px solid var(--linea-fuerte);
  border-radius: 3px;
  background: var(--superficie);
  color: var(--rojo);
  cursor: pointer;
  font: 600 10px var(--label);
  letter-spacing: .06em;
  text-transform: uppercase;
}
.doc-cruce button:hover { border-color: var(--rojo); background: var(--superficie-roja); }

:focus-visible { outline: 2px solid var(--rojo); outline-offset: 2px; }

@media (max-width: 900px) {
  .view { padding-bottom: 64px; }
  .view-hero { grid-template-columns: 1fr; gap: 18px; padding: 30px 0 22px; }
  .hero-copy h1 { font-size: clamp(42px, 10vw, 58px); }
  .hero-side {
    flex-direction: row;
    align-items: center;
    gap: 14px;
    padding: 12px 0 0;
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  .doc-layout { grid-template-columns: 1fr; padding-top: 22px; }
  .doc-index { display: none; }
  .view-bar { padding: 12px 0; }
}

@media (max-width: 560px) {
  .hero-copy h1 { margin-top: 10px; }
  .hero-lead { font-size: 15px; }
  .view-bar { align-items: stretch; }
  .doc-tabs { width: 100%; }
  .tab { flex: 1; padding: 0 10px; }
  .doc-section { padding: 20px 18px 22px; }
  .doc-section-head { gap: 11px; margin-bottom: 15px; padding-bottom: 14px; }
  .doc-num { width: 34px; height: 34px; font-size: 10px; }
  .doc-section-head h2 { font-size: 22px; }
  .doc-section-head p { font-size: 9px; letter-spacing: .05em; }
  .doc-body { gap: 12px; }
}
</style>
