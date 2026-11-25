<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { manual } from '../contenido/manual.js'
import { curiosidades } from '../contenido/curiosidades.js'
import { informacion } from '../contenido/informacion.js'
import { legal } from '../contenido/legal.js'
import DocumentoBloques from './DocumentoBloques.vue'

const props = defineProps({
  seccionInicial: { type: String, default: 'manual' }
})
const emit = defineEmits(['cerrar'])

const pestañas = [
  { id: 'manual', etiqueta: 'Manual', datos: manual, resumen: 'Reglas completas y guía de juego' },
  { id: 'curiosidades', etiqueta: 'Curiosidades', datos: curiosidades, resumen: 'Datos detrás del juego' },
  { id: 'informacion', etiqueta: 'Información', datos: informacion, resumen: 'Proyecto, datos y tecnología' },
  { id: 'legal', etiqueta: 'Términos y privacidad', datos: legal, resumen: 'Aviso legal, condiciones de uso, privacidad y derechos' }
]
const activa = ref(props.seccionInicial)
const actual = computed(() => pestañas.find((p) => p.id === activa.value) ?? pestañas[0])
const secciones = computed(() => actual.value.datos)

function imprimir() { window.print() }

function alTeclado(e) {
  if (e.key === 'Escape') emit('cerrar')
}
onMounted(() => {
  window.addEventListener('keydown', alTeclado)
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', alTeclado)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div class="docs-overlay" role="dialog" aria-modal="true" aria-label="Documentos de 3A1"
         @click.self="emit('cerrar')">
      <section class="docs-panel">
        <header class="docs-top">
          <div>
            <span class="docs-kicker">Biblioteca 3A1</span>
            <h1>Documentos</h1>
          </div>
          <div class="docs-actions">
            <button class="docs-print" type="button" @click="imprimir">
              <span aria-hidden="true">⎙</span> Imprimir / Guardar PDF
            </button>
            <button class="docs-close" type="button" aria-label="Cerrar documentos" @click="emit('cerrar')">×</button>
          </div>
        </header>

        <nav class="docs-tabs" aria-label="Secciones de documentos">
          <button v-for="p in pestañas" :key="p.id" type="button"
                  :class="['docs-tab', { on: activa === p.id }]"
                  :aria-current="activa === p.id ? 'page' : undefined"
                  @click="activa = p.id">
            {{ p.etiqueta }}
          </button>
        </nav>

        <p class="docs-resumen">{{ actual.resumen }}</p>

        <article class="docs-scroll">
          <section v-for="(sec, i) in secciones" :key="i" class="doc-section">
            <h2>{{ sec.titulo }}</h2>
            <DocumentoBloques :bloques="sec.bloques" />
          </section>
          <p class="docs-fin">Fin del documento · {{ actual.etiqueta }}</p>
        </article>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.docs-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(12, 14, 12, .82);
}
.docs-panel {
  display: flex;
  flex-direction: column;
  width: min(900px, 100%);
  max-height: min(90vh, 980px);
  background: var(--superficie-baja);
  border: 1px solid var(--linea);
  border-radius: 10px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, .38);
  overflow: hidden;
}
.docs-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 28px 16px;
  background: var(--negro);
  color: #f8f5ed;
}
.docs-kicker {
  font: 500 9px 'JetBrains Mono', monospace;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: #b99452;
}
.docs-top h1 {
  margin: 4px 0 0;
  color: var(--panel-oscuro-texto);
  font: 600 30px 'Oswald', sans-serif;
  letter-spacing: .03em;
}
.docs-actions { display: flex; align-items: center; gap: 10px; }
.docs-print, .docs-close {
  cursor: pointer;
  font-family: inherit;
  transition: background .15s ease, border-color .15s ease;
}
.docs-print {
  padding: 8px 12px;
  border: 1px solid #c8102e;
  border-radius: 4px;
  background: #c8102e;
  color: #fff;
  font: 600 11px 'JetBrains Mono', monospace;
}
.docs-print:hover { background: #a30d26; }
.docs-print span { margin-right: 5px; font-size: 14px; }
.docs-close {
  width: 34px;
  height: 34px;
  border: 1px solid var(--linea-fuerte);
  border-radius: 4px;
  background: transparent;
  color: #f8f5ed;
  font-size: 22px;
  line-height: 1;
}
.docs-close:hover { border-color: #f8f5ed; }
.docs-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 24px 0;
  border-bottom: 1px solid var(--linea);
  background: var(--superficie-media);
  overflow-x: auto;
}
.docs-tab {
  padding: 9px 14px;
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: 5px 5px 0 0;
  background: transparent;
  color: var(--texto-suave);
  cursor: pointer;
  font: 600 12px 'Oswald', sans-serif;
  letter-spacing: .04em;
  white-space: nowrap;
}
.docs-tab:hover { color: var(--tinta); }
.docs-tab.on {
  background: var(--superficie-baja);
  border-color: var(--linea);
  color: #c8102e;
}
.docs-resumen {
  margin: 0;
  padding: 10px 28px;
  border-bottom: 1px solid var(--linea);
  color: var(--texto-tenue);
  font: 10px 'JetBrains Mono', monospace;
  letter-spacing: .04em;
}
.docs-scroll { padding: 8px 28px 30px; overflow-y: auto; }
.doc-section { padding: 18px 0 4px; border-bottom: 1px solid var(--linea); }
.doc-section:last-of-type { border-bottom: 0; }
.doc-section h2 {
  margin: 0 0 10px;
  color: var(--tinta);
  font: 600 20px 'Oswald', sans-serif;
  letter-spacing: .02em;
}
:focus-visible { outline: 2px solid #c8102e; outline-offset: 2px; }

@media (max-width: 720px) {
  .docs-overlay { padding: 0; }
  .docs-panel { max-height: 100vh; height: 100vh; border: 0; border-radius: 0; }
  .docs-top { padding: 16px; }
  .docs-top h1 { font-size: 24px; }
  .docs-print { font-size: 10px; padding: 7px 9px; }
  .docs-tabs { padding: 8px 12px 0; }
  .docs-resumen { padding: 8px 16px; }
  .docs-scroll { padding: 4px 16px 24px; }
}
</style>

<style scoped>
@page { size: A4; margin: 16mm 15mm; }
@media print {
  :global(html), :global(body) {
    width: auto !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    overflow: visible !important;
  }
  :global(#app) { display: none !important; }
  .docs-overlay {
    position: static !important;
    display: block !important;
    inset: auto !important;
    padding: 0 !important;
    background: #fff !important;
    backdrop-filter: none !important;
    overflow: visible !important;
  }
  .docs-panel {
    display: block !important;
    width: auto !important;
    max-width: none !important;
    height: auto !important;
    max-height: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: #fff !important;
    overflow: visible !important;
  }
  .docs-top {
    padding: 0 0 10px !important;
    background: #fff !important;
    color: #141414 !important;
    border-bottom: 2px solid #c8102e !important;
  }
  .docs-kicker { color: #c8102e !important; }
  .docs-top h1 { font-size: 24px !important; }
  .docs-actions, .docs-tabs, .docs-resumen, .docs-fin { display: none !important; }
  .docs-scroll {
    padding: 0 !important;
    overflow: visible !important;
    max-height: none !important;
  }
  .doc-section { padding: 12px 0 !important; break-inside: auto; }
  .doc-section h2 { break-after: avoid; font-size: 16px !important; }
  .doc-section h3 { break-after: avoid; font-size: 13px !important; }
  .doc-section p, .doc-section li { font-size: 11px !important; line-height: 1.5 !important; }
  .doc-nota {
    background: #fff !important;
    border-left-color: #b99452 !important;
    color: #333 !important;
    font-size: 10px !important;
  }
}
</style>
