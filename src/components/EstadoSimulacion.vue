<script setup>
defineProps({
  jugando: { type: Boolean, default: false },
  titulo: { type: String, required: true },
  detalle: { type: String, default: '' }
})
</script>

<template>
  <div v-if="jugando" class="panel estado-simulacion" role="status" aria-live="polite">
    <span class="sim-spinner" aria-hidden="true"></span>
    <div class="sim-texto">
      <strong>{{ titulo }}</strong>
      <small>{{ detalle || 'Se están jugando los partidos. Esperá un momento…' }}</small>
    </div>
  </div>
</template>

<style scoped>
.estado-simulacion {
  display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
  border-left: 3px solid #c8102e; background: var(--superficie-roja);
}
.sim-spinner {
  flex: 0 0 auto; width: 20px; height: 20px; border-radius: 50%;
  border: 2px solid #f0c4cc; border-top-color: #c8102e; animation: girar .8s linear infinite;
}
.sim-texto { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sim-texto strong { font-size: 13px; }
.sim-texto small { font-size: 11px; color: var(--texto-suave); }
@keyframes girar { to { transform: rotate(360deg); } }
</style>
