<script setup>
// Mismo recurso que "Equipos": el XV del rival se abre como una notificación
// flotante con velo, no como una cancha enorme metida en medio del partido.
import { onBeforeUnmount, onMounted } from 'vue'
import CanchaRival from './CanchaRival.vue'

const props = defineProps({
  temporada: { type: Object, default: null },
  almanaque: { type: Boolean, default: false }
})
const emit = defineEmits(['cerrar'])
function alTecla(e) { if (e.key === 'Escape') emit('cerrar') }
onMounted(() => document.addEventListener('keydown', alTecla))
onBeforeUnmount(() => document.removeEventListener('keydown', alTecla))
</script>

<template>
  <div class="xv-veil" @click="emit('cerrar')"></div>
  <div v-if="props.temporada" class="xv-flotante" role="dialog" aria-modal="true"
       aria-label="Once del rival">
    <button class="xv-cerrar" type="button" aria-label="Cerrar XV" @click="emit('cerrar')">×</button>
    <CanchaRival :temporada="props.temporada" :almanaque="props.almanaque" compacto />
  </div>
</template>

<style scoped>
.xv-veil {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(20, 20, 20, .34);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  will-change: transform;
}
.xv-flotante {
  position: fixed;
  z-index: 81;
  left: 50%;
  top: 50%;
  width: min(520px, calc(100vw - 24px));
  max-height: calc(100vh - 72px);
  overflow: auto;
  padding: 36px 12px 12px;
  background: var(--superficie);
  border: 1px solid var(--rojo);
  border-radius: var(--radio);
  box-shadow: 6px 6px 0 rgba(26, 29, 26, .18);
  transform: translate(-50%, -50%);
  animation: xv-in .18s ease-out;
}
.xv-cerrar {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 28px;
  height: 28px;
  border: 1px solid var(--rojo);
  border-radius: 50%;
  background: var(--superficie-baja);
  color: var(--rojo);
  font: 600 18px/1 var(--texto);
  cursor: pointer;
}
.xv-cerrar:hover { background: var(--rojo); color: #fff; }

/* En "Ver XV" la ficha se agranda a propósito: acá sí se puede leer todo. */
.xv-flotante :deep(.cancha-xi.compacto .pitch-wrap) { max-width: 360px; }
.xv-flotante :deep(.cancha-xi.compacto .ficha) {
  width: 50px; height: 50px; margin: -25px 0 0 -25px;
}
.xv-flotante :deep(.cancha-xi.compacto .ficha .foto),
.xv-flotante :deep(.cancha-xi.compacto .ficha .ini) {
  width: 42px; height: 42px;
}
.xv-flotante :deep(.cancha-xi.compacto .ficha .tag) { max-width: 96px; font-size: 10px; }
.xv-flotante :deep(.cancha-xi.compacto .ficha .tag-meta) { font-size: 9px; }
.xv-flotante :deep(.ley-nota) { font-size: 12px; }
.xv-flotante :deep(.xi-leyenda) { gap: 5px 10px; }
.xv-flotante :deep(.xi-leyenda li) { font-size: 14px; padding: 5px 6px; }
.xv-flotante :deep(.xi-leyenda .ley-slot) { min-width: 30px; font-size: 10px; }
.xv-flotante :deep(.ley-foto) { width: 34px; height: 34px; }
.xv-flotante :deep(.xi-leyenda .ley-nombre) {
  white-space: normal; overflow-wrap: anywhere; line-height: 1.15;
}

@keyframes xv-in {
  from { opacity: 0; transform: translate(-50%, -50%) scale(.97); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
@media (max-width: 640px) {
  .xv-flotante { width: calc(100vw - 16px); max-height: calc(100svh - 60px); padding: 34px 8px 8px; }
  .xv-flotante :deep(.xi-leyenda) { grid-template-columns: 1fr; }
  .xv-flotante :deep(.xi-leyenda .ley-nombre) { font-size: 14px; }
}
</style>
