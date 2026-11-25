<script setup>
import { onMounted, ref, watch } from 'vue'
import { obtenerHistorial, cargarEquipo } from '../services/api.js'
import { fotoDe, fallbackInicial } from '../game/fotos.js'

const props = defineProps({ almanaque: { type: Boolean, default: false } })

const mejor = ref([])
const cargando = ref(true)
const cacheEquipos = new Map()

async function equipoCached(id) {
  if (!cacheEquipos.has(id)) {
    cacheEquipos.set(id, cargarEquipo(id).catch(() => []))
  }
  return cacheEquipos.get(id)
}

onMounted(async () => {
  try {
    const h = await obtenerHistorial()
    const mapa = {}
    const lote = h.slice(0, 8)
    for (let i = 0; i < lote.length; i += 4) {
      const grupos = await Promise.all(lote.slice(i, i + 4).map((p) => equipoCached(p.id)))
      grupos.forEach((eq, k) => {
        const p = lote[i + k]
        for (const j of eq) {
          const cur = mapa[j.slot]
          if (!cur || Number(j.ovr_final) > Number(cur.ovr_final)) {
            mapa[j.slot] = { ...j, origen: p.nombre_equipo }
          }
        }
      })
    }
    baseMejor.value = Object.entries(mapa).map(([slot, j]) => ({ slot, ...j }))
    ordenar()
  } finally {
    cargando.value = false
  }
})

const baseMejor = ref([])
function ordenar() {
  mejor.value = [...baseMejor.value].sort((a, b) => props.almanaque
    ? String(a.slot).localeCompare(String(b.slot), 'es')
    : b.ovr_final - a.ovr_final)
}
watch(() => props.almanaque, ordenar)
</script>

<template>
  <div class="panel sub">
    <h2><span class="h-bar"></span>Mejor 11 histórico</h2>
    <p v-if="cargando" class="muted small">Buscando…</p>
    <ol v-else-if="mejor.length" class="mejor">
      <li v-for="(j, i) in mejor" :key="j.slot">
        <span class="rank" :class="{ top: i < 3 }">{{ i + 1 }}</span>
        <img v-if="fotoDe(j)" :src="fotoDe(j)" :alt="j.nombre" loading="lazy" @error="(e) => fallbackInicial(e, j, 'slot inicial')" />
        <span v-else class="slot inicial">{{ j.nombre.charAt(0) }}</span>
        <span class="slot">{{ j.slot }}</span>
        <span class="name">{{ j.nombre }}</span>
        <span v-if="!almanaque" class="bar mini"><span class="fill mini-fill" :style="{ width: Math.min(100, Math.max(0, (j.ovr_final - 60) * 2.5)) + '%' }"></span></span>
        <strong class="ovr">{{ almanaque ? '¿?' : j.ovr_final }}</strong>
      </li>
    </ol>
    <p v-else class="muted small">Jugá partidas para construirlo.</p>
  </div>
</template>

<style scoped>
.sub { margin-top: 14px; }
.mejor { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 6px; }
.mejor li { display: flex; gap: 8px; align-items: center; background: var(--superficie-baja); border-radius: 8px; padding: 6px 10px; }
.mejor img { width: 28px; height: 28px; object-fit: cover; border-radius: 50%; flex: none; }
.mejor .slot.inicial { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: var(--negro); color: #e8d58b; font: 700 13px 'Oswald', sans-serif; flex: none; }
.rank { background: #b8ab8f; color: #fff; font-size: 12px; font-weight: 800; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.rank.top { background: linear-gradient(180deg, #d4af37, #a8842c); }
.slot { color: var(--texto-suave); font-size: 12px; min-width: 44px; flex: none; }
.name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 720px) { .bar.mini { display: none; } }
.bar.mini { flex: 1; height: 5px; background: var(--superficie-media); border-radius: 3px; overflow: hidden; }
.fill.mini-fill { display: block; height: 100%; background: #c8102e; }
.ovr { color: #c8102e; font-size: 16px; }
.h-bar { display: inline-block; width: 5px; height: 18px; background: #c8102e; border-radius: 3px; margin-right: 8px; vertical-align: -3px; }
</style>
