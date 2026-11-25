<script setup>
import { computed, onMounted, ref } from 'vue'
import { obtenerRankingAdmin, borrarResultado } from '../services/api.js'
import { usuario } from '../services/auth.js'

const filas = ref([])
const carga = ref('cargando')
const error = ref('')
const borrando = ref(null)
const esAdmin = computed(() => usuario.value?.rol === 'admin')

async function cargar() {
  carga.value = 'cargando'
  error.value = ''
  try {
    const datos = await obtenerRankingAdmin(3)
    filas.value = Array.isArray(datos) ? datos : []
    carga.value = filas.value.length ? 'ok' : 'vacio'
  } catch (e) {
    filas.value = []
    error.value = e.message
    carga.value = 'error'
  }
}

async function retirar(fila) {
  if (!esAdmin.value || !fila.partidaId || borrando.value) return
  borrando.value = fila.partidaId
  error.value = ''
  try {
    await borrarResultado(fila.partidaId)
    await cargar()
  } catch (e) {
    error.value = e.message
  } finally {
    borrando.value = null
  }
}

onMounted(cargar)
</script>

<template>
  <section class="rc-panel">
    <header class="rc-head">
      <div>
        <span class="eyebrow">Base compartida · juego 3</span>
        <h2>Ranking conectado</h2>
        <p>Mejor puntaje de cada jugador. Lo calcula el servidor con las partidas guardadas.</p>
      </div>
      <button type="button" class="rc-recargar" @click="cargar">Actualizar</button>
    </header>

    <p v-if="carga === 'cargando'" class="rc-estado">Cargando ranking…</p>
    <p v-else-if="error" class="rc-error" role="alert">{{ error }}</p>
    <p v-else-if="carga === 'vacio'" class="rc-estado">Todavía no hay resultados guardados.</p>
    <ol v-else class="rc-lista">
      <li v-for="(f, i) in filas" :key="`${f.usuarioId}-${i}`">
        <span class="rc-puesto">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="rc-alias">{{ f.alias }}</span>
        <span class="rc-puntos">{{ f.puntos.toLocaleString('es-AR') }}</span>
        <button v-if="esAdmin" type="button" class="rc-borrar"
                :disabled="borrando === f.partidaId"
                :title="`Retirar resultado de ${f.alias}`"
                @click="retirar(f)">
          {{ borrando === f.partidaId ? '…' : 'Retirar' }}
        </button>
      </li>
    </ol>
    <p v-if="esAdmin" class="rc-nota">Como administrador podés retirar un resultado inválido. El permiso se verifica en el servidor.</p>
  </section>
</template>

<style scoped>
.rc-panel { padding: 18px; border: 1px solid var(--linea); background: var(--superficie-baja); }
.rc-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
.eyebrow { font: 600 10px var(--label); letter-spacing: .12em; text-transform: uppercase; color: var(--texto-suave); }
.rc-head h2 { margin: 6px 0 4px; font: 700 26px var(--display); text-transform: uppercase; color: var(--tinta); }
.rc-head p { margin: 0; font-size: 12px; color: var(--texto-suave); }
.rc-recargar { min-height: 36px; padding: 0 12px; border: 1px solid var(--linea); background: var(--superficie); color: var(--tinta); font: 600 11px var(--texto); cursor: pointer; }
.rc-lista { list-style: none; margin: 0; padding: 0; }
.rc-lista li {
  display: grid; grid-template-columns: 36px 1fr auto; align-items: center; gap: 10px;
  padding: 10px 12px; margin-bottom: 5px; background: var(--superficie);
  border-left: 3px solid var(--rojo);
}
.rc-lista li:has(.rc-borrar) { grid-template-columns: 36px 1fr auto auto; }
.rc-puesto { font: 700 16px var(--display); color: var(--texto-suave); }
.rc-alias { font: 600 14px var(--display); text-transform: uppercase; color: var(--tinta); }
.rc-puntos { font: 700 19px var(--display); color: var(--rojo); }
.rc-borrar { min-height: 30px; padding: 0 8px; border: 1px solid var(--linea); background: transparent; color: var(--rojo); font: 600 10px var(--texto); text-transform: uppercase; cursor: pointer; }
.rc-borrar:disabled { opacity: .5; cursor: wait; }
.rc-estado, .rc-error, .rc-nota { font-size: 12px; color: var(--texto-suave); }
.rc-error { color: var(--rojo); }
.rc-nota { margin: 12px 0 0; }
@media (max-width: 520px) {
  .rc-head { align-items: flex-start; flex-direction: column; }
  .rc-lista li, .rc-lista li:has(.rc-borrar) { grid-template-columns: 30px 1fr auto; }
  .rc-borrar { grid-column: 3; }
}
</style>
