<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { obtenerJugadores, obtenerFormaciones } from '../services/api.js'
import { escudoDe } from '../game/fotos.js'
import { onceRival } from '../game/ligas.js'
import CanchaXI from './CanchaXI.vue'

const props = defineProps({
  temporada: { type: Object, required: true },
  almanaque: { type: Boolean, default: false },
  // En la ventana flotante se usa la cancha compacta: la completa es gigante.
  compacto: { type: Boolean, default: false }
})

const cargando = ref(true)
const error = ref('')
const plantel = ref([])
const catalogo = ref(null)

const idTemporada = computed(() =>
  props.temporada?.rival_temporada_id ?? props.temporada?.temporada_id ?? props.temporada?.id ?? null
)
const mapaFormaciones = computed(() => catalogo.value?.todas ?? catalogo.value?.formaciones ?? {})
const formacionPedida = computed(() => props.temporada?.formacion ?? null)

const formacion = computed(() => {
  const nombres = Object.keys(mapaFormaciones.value)
  if (!nombres.length) return formacionPedida.value ?? ''
  return mapaFormaciones.value[formacionPedida.value] ? formacionPedida.value : nombres[0]
})
const avisoFormacion = computed(() => {
  if (!catalogo.value || !formacionPedida.value) return ''
  return formacionPedida.value === formacion.value
    ? ''
    : `Formación ${formacionPedida.value} sin mapa: se muestra ${formacion.value}.`
})

const once = computed(() => onceRival(plantel.value, mapaFormaciones.value[formacion.value] ?? {}))

async function cargar() {
  plantel.value = []
  catalogo.value = null
  error.value = ''
  cargando.value = false
  if (!idTemporada.value) return

  cargando.value = true
  try {
    const [jugadores, formaciones] = await Promise.all([
      obtenerJugadores(idTemporada.value),
      obtenerFormaciones()
    ])
    plantel.value = Array.isArray(jugadores) ? jugadores : []
    catalogo.value = formaciones ?? {}
  } catch (e) {
    error.value = e?.message ?? 'No se pudo cargar el plantel del rival.'
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
watch(idTemporada, cargar)
</script>

<template>
  <div class="panel sub">
    <header class="rv-cab">
      <img v-if="escudoDe(temporada)" :src="escudoDe(temporada)"
           :alt="`Escudo de ${temporada.etiqueta ?? temporada.club ?? 'rival'}`"
           class="escudo" loading="lazy" @error="(e) => e.target.remove()" />
      <div class="rv-id">
        <h2><span class="h-bar"></span>{{ temporada.etiqueta ?? temporada.club ?? 'Rival' }}</h2>
        <p class="muted small">
          <template v-if="temporada.club">{{ temporada.club }}</template>
          <template v-if="temporada.formacion"> · {{ temporada.formacion }}</template>
          <template v-if="!almanaque && temporada.ovr_equipo != null"> · OVR {{ temporada.ovr_equipo }}</template>
        </p>
      </div>
    </header>

    <p v-if="!idTemporada" class="estado-vacio">Sin plantel disponible para este rival</p>
    <template v-else>
      <p v-if="cargando" class="muted small">Buscando el plantel…</p>
      <div v-else-if="error" class="estado-vacio">
        <span aria-hidden="true">⚠</span>
        <strong>No se pudo cargar el plantel</strong>
        <p class="error-line">{{ error }}</p>
        <button class="btn small-btn" type="button" @click="cargar">Reintentar</button>
      </div>
      <template v-else>
        <p v-if="avisoFormacion" class="aviso">{{ avisoFormacion }}</p>
        <p v-if="!plantel.length" class="estado-vacio">El plantel de este rival está vacío.</p>
        <template v-else>
          <!-- Sin CSS de cancha propia: CanchaXI dibuja el once de onceRival()
               con la misma ficha y foto que el XV de River. -->
          <CanchaXI :once="once" :formacion="formacion" :almanaque="almanaque"
                    sin-cabecera :compacto="props.compacto" />
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.sub { margin-top: 14px; }
.rv-cab { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.rv-cab .escudo { width: 48px; height: 48px; object-fit: contain; flex: none; }
.rv-id { min-width: 0; }
.rv-id h2 { margin: 0; font: 600 20px 'Oswald', sans-serif; text-transform: uppercase; }
.rv-id p { margin: 2px 0 0; }
.h-bar { display: inline-block; width: 5px; height: 18px; background: #c8102e; border-radius: 3px; margin-right: 8px; vertical-align: -3px; }
.aviso { margin: 6px 0; padding: 6px 9px; border-left: 3px solid #c8102e; background: var(--superficie-roja);
  color: #8a2b3b; font: 12px/1.5 'Inter', sans-serif; }

</style>
