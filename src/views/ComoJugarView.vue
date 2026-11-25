<script setup>
import { computed, ref } from 'vue'
import DocumentoBloques from '../components/DocumentoBloques.vue'
import { manual } from '../contenido/manual.js'
import { legal } from '../contenido/legal.js'

const pestañas = [
  { id: 'manual', etiqueta: 'Manual', datos: manual, resumen: 'Reglas completas y guía de juego' },
  { id: 'legal', etiqueta: 'Legal', datos: legal, resumen: 'Términos, privacidad, cookies y derechos' }
]
const activa = ref('manual')
const actual = computed(() => pestañas.find((p) => p.id === activa.value) ?? pestañas[0])

function imprimir() { window.print() }
</script>

<template>
  <section class="view">
    <header class="view-head">
      <span class="eyebrow">Aprender a jugar</span>
      <h1>Cómo jugar</h1>
      <p>Lo esencial para arrancar y el manual completo, en el mismo lugar.</p>
    </header>

    <div class="quick-grid" aria-label="Guía rápida">
      <div><b>01</b><strong>Creá la partida</strong><span>Elegí competencia, formación y estilo.</span></div>
      <div><b>02</b><strong>Tirá el dado</strong><span>Sale un plantel real de River por sorteo.</span></div>
      <div><b>03</b><strong>Armá tu XI</strong><span>Un jugador por sorteo: elegí jugador y punto compatible.</span></div>
      <div><b>04</b><strong>Jugá el torneo</strong><span>Fecha a fecha, con tabla, crónica y cierre.</span></div>
    </div>

    <div class="doc-head">
      <div class="doc-tabs" role="tablist" aria-label="Documentos de cómo jugar">
        <button v-for="p in pestañas" :key="p.id" type="button" role="tab"
                :aria-selected="activa === p.id" :class="['tab', { on: activa === p.id }]"
                @click="activa = p.id">{{ p.etiqueta }}</button>
      </div>
      <button class="print-btn" type="button" @click="imprimir">⎙ Imprimir / Guardar PDF</button>
    </div>
    <p class="doc-resumen">{{ actual.resumen }}</p>

    <article class="doc-body">
      <section v-for="(sec, i) in actual.datos" :key="i" class="doc-section">
        <h2>{{ sec.titulo }}</h2>
        <DocumentoBloques :bloques="sec.bloques" />
      </section>
    </article>
  </section>
</template>


<style scoped>
.view { max-width: 980px; margin: 0 auto; padding: 38px 0 70px; }
.view-head .eyebrow { font: 500 10px 'JetBrains Mono', monospace; letter-spacing: .16em; text-transform: uppercase; color: #c8102e; }
.view-head h1 { margin: 6px 0 6px; font: 600 40px 'Oswald', sans-serif; letter-spacing: .02em; }
.view-head p { margin: 0 0 22px; color: var(--texto-suave); font: 400 14px 'Inter', sans-serif; }
.quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 28px; }
.quick-grid > div { display: flex; flex-direction: column; gap: 5px; padding: 14px; background: var(--superficie); border: 1px solid #ded8c8; border-top: 3px solid #c8102e; }
.quick-grid b { color: #c8102e; font: 600 10px 'JetBrains Mono', monospace; }
.quick-grid strong { font: 600 14px 'Oswald', sans-serif; }
.quick-grid span { color: var(--texto-tenue); font: 400 11px/1.5 'Inter', sans-serif; }
.doc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--linea); }
.doc-tabs { display: flex; gap: 4px; }
.tab { padding: 10px 16px; border: 1px solid transparent; border-bottom: 0; border-radius: 5px 5px 0 0; background: transparent; color: var(--texto-suave); cursor: pointer; font: 600 12px 'Oswald', sans-serif; }
.tab.on { background: var(--superficie); border-color: var(--linea); color: #c8102e; }
.print-btn { padding: 7px 11px; border: 1px solid #c8102e; border-radius: 4px; background: transparent; color: #c8102e; cursor: pointer; font: 600 10px 'JetBrains Mono', monospace; }
.print-btn:hover { background: #c8102e; color: #fff; }
.doc-resumen { margin: 0; padding: 10px 2px; color: var(--texto-tenue); font: 10px 'JetBrains Mono', monospace; }
.doc-body { background: var(--superficie); border: 1px solid #ded8c8; padding: 8px 26px 30px; }
.doc-section { padding: 16px 0; border-bottom: 1px solid #e6e1d3; }
.doc-section:last-child { border-bottom: 0; }
.doc-section h2 { margin: 0 0 10px; font: 600 21px 'Oswald', sans-serif; }
:focus-visible { outline: 2px solid #c8102e; outline-offset: 2px; }
@media (max-width: 860px) { .quick-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) {
  .view { padding: 24px 0 50px; }
  .view-head h1 { font-size: 30px; }
  .quick-grid { grid-template-columns: 1fr; }
  .doc-head { align-items: flex-end; }
  .doc-body { padding: 6px 16px 22px; }
}
@media print {
  .view { max-width: none; padding: 0; }
  .quick-grid, .doc-head, .doc-resumen { display: none !important; }
  .doc-body { border: 0; padding: 0; }
  .doc-section h2 { font-size: 16px; break-after: avoid; }
}
</style>
