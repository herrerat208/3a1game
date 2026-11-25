<script setup>
import { nextTick, ref, watch } from 'vue'

const props = defineProps({
  lineas: { type: Array, default: () => [] },
  jugando: { type: Boolean, default: false },
  titulo: { type: String, default: 'Minuto a minuto' }
})

const caja = ref(null)
watch(() => props.lineas.length, async () => {
  await nextTick()
  if (caja.value) caja.value.scrollTop = caja.value.scrollHeight
})
</script>

<template>
  <section v-if="lineas.length" class="panel relato-en-vivo" aria-label="Relato del partido">
    <header class="relato-cabecera">
      <h4>{{ titulo }}</h4>
      <span class="relato-estado" :class="{ vivo: jugando }">
        <i aria-hidden="true"></i>{{ jugando ? 'EN JUEGO' : 'FINAL' }}
      </span>
    </header>
    <div ref="caja" class="relato-cuerpo" role="log" aria-live="polite">
      <p v-for="(l, i) in lineas" :key="i" :class="{ gol: l.includes('¡GOL') }">{{ l }}</p>
    </div>
  </section>
</template>

<style scoped>
.relato-en-vivo { margin-top: 12px; }
.relato-cabecera {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--linea);
}
.relato-cabecera h4 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
.relato-estado {
  display: inline-flex; align-items: center; gap: 6px;
  font: 700 10px/1 var(--texto); text-transform: uppercase; letter-spacing: .06em;
  color: var(--texto-suave); background: var(--superficie-media); border-radius: 999px; padding: 6px 9px;
}
.relato-estado i { width: 7px; height: 7px; border-radius: 50%; background: #6d6455; }
.relato-estado.vivo { color: #c8102e; background: var(--superficie-roja); }
.relato-estado.vivo i { background: #c8102e; animation: latido 1s ease-in-out infinite; }
.relato-cuerpo {
  max-height: 240px; overflow-y: auto; overscroll-behavior: contain;
  scroll-behavior: smooth; padding-right: 4px;
  font-size: 13px; line-height: 1.5;
}
.relato-cuerpo p { margin: 4px 0; animation: entrar .3s ease-out; }
.relato-cuerpo .gol { font-weight: 800; color: #c8102e; font-size: 16px; }
@keyframes latido { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .45; transform: scale(.7); } }
@keyframes entrar { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
</style>
