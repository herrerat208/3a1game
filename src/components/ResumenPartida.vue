<script setup>
// Resumen de una partida terminada, sin salir de la pantalla. Es el mismo
// patrón que "Ver alineación": el usuario despliega y ve todo lo que jugó
// (marcadores, goleadores, asistencias, penales, figura) junto a su XI y banco.
import { computed, onMounted, ref } from 'vue'
import { cargarEquipo } from '../services/api.js'
import { fotoDe, escudoDe, escudoEpocaDe, fallbackInicial } from '../game/fotos.js'
import { mvpAportes } from '../game/formations.js'
import { nombreCorto } from '../game/nombres.js'
import { ETIQUETAS_FORMATO } from '../game/recompensas.js'
import { PITCH_COORDS, coordConTactica } from '../game/pitch.js'
import CanchaXI from './CanchaXI.vue'

const props = defineProps({
  partida: { type: Object, required: true },
  almanaque: { type: Boolean, default: false },
  // El resumen del inicio es compacto: sin goles rivales, penales, figura ni
  // banco, y como máximo tres goleadores. El XI completo se muestra igual.
  // En Tus drafts se usa el resumen completo (comportamiento por defecto).
  resumido: { type: Boolean, default: false }
})

const equipo = ref([])
const cargando = ref(true)
const errorEquipo = ref('')

onMounted(async () => {
  try {
    equipo.value = await cargarEquipo(props.partida.id)
  } catch (e) {
    errorEquipo.value = e?.message ?? 'No se pudo cargar la alineación.'
  } finally {
    cargando.value = false
  }
})

const once = computed(() => equipo.value.filter((j) => !String(j.slot).startsWith('SUP')))
const suplentes = computed(() => equipo.value.filter((j) => String(j.slot).startsWith('SUP')))
const partidos = computed(() => props.partida.partidos ?? [])
// El resumen compacto reutiliza CanchaXI (el mismo XV que "Ver XV"): recibe
// fichas con { slot, pos, jugador } y dibuja la cancha sin CSS propio.
const onceParaCancha = computed(() => once.value.map((j) => ({
  slot: j.slot, pos: posDe(j.slot), jugador: j
})))
const formatoEtiqueta = computed(() =>
  ETIQUETAS_FORMATO[props.partida.formato] ?? null)

function posDe(slot) {
  return String(slot ?? '').replace(/\d+$/, '')
}
function coordenada(slot) {
  const coords = (PITCH_COORDS[props.partida.formacion] ?? {})[slot]
  return coords ? coordConTactica(coords, props.partida.estilo ?? 'equilibrado') : null
}
// Un solo pase por partido: el template antes recalculaba goleadores, tanda y
// figura (con mvpAportes) hasta tres veces por fila en cada render.
const partidosDetallados = computed(() => partidos.value.map((p) => {
  const goles = p.detalle?.goleadores ?? []
  return {
    ...p,
    goleadores: goles,
    goleadoresRival: p.detalle?.goleadoresRival ?? [],
    tanda: p.detalle?.tanda ?? null,
    figura: goles.length ? mvpAportes(goles) : null
  }
}))
const coordsPorSlot = computed(() => {
  const mapa = new Map()
  for (const j of once.value) {
    const c = coordenada(j.slot)
    if (c) mapa.set(j.slot, c)
  }
  return mapa
})
function etiquetaPartido(p) {
  if (p.amistoso) return 'Amistoso'
  if (p.fase) return p.fase
  if (p.fecha_n != null) return `Fecha ${p.fecha_n}`
  return 'Partido'
}
function signo(p) {
  return p.signo === 1 ? 'V' : p.signo === 0 ? 'E' : 'D'
}
// En la versión resumida se listan apenas los tres primeros goleadores.
function golesVisibles(p) {
  return props.resumido ? p.goleadores.slice(0, 3) : p.goleadores
}
</script>

<template>
  <div class="resumen-partida">
    <div class="rp-meta">
      <span><b>{{ partida.nombre_equipo }}</b></span>
      <span v-if="formatoEtiqueta" class="rp-formato">{{ formatoEtiqueta }}</span>
      <span v-if="partida.formacion">{{ partida.formacion }}</span>
      <span v-if="partida.estilo">{{ partida.estilo }}</span>
      <span v-if="partida.fecha_inicio">{{ String(partida.fecha_inicio).slice(0, 10) }}</span>
      <span class="rp-cant">{{ partidos.length }} partido{{ partidos.length === 1 ? '' : 's' }}</span>
    </div>

    <h4 class="rp-titulo">Partidos jugados</h4>
    <ul v-if="partidos.length" class="rp-partidos">
      <li v-for="(p, i) in partidosDetallados" :key="p.origen + '-' + p.id + '-' + i" class="rp-partido">
        <div class="rp-cabeza">
          <span class="rp-signo" :class="{ v: p.signo === 1, e: p.signo === 0, d: p.signo === -1 }">{{ signo(p) }}</span>
          <img v-if="escudoDe(p)" :src="escudoDe(p)" alt="" class="rp-escudo" loading="lazy"
               @error="(e) => e.target.remove()" />
          <strong class="rp-marcador">{{ p.gf }}–{{ p.gc }}</strong>
          <span class="rp-rival">{{ p.etiqueta ?? p.rival ?? 'Rival' }}</span>
          <span class="rp-fase">{{ etiquetaPartido(p) }}</span>
        </div>
        <div v-if="p.goleadores.length" class="rp-goles">
          <span v-for="(g, j) in golesVisibles(p)" :key="'g' + j" class="rp-gol">
            {{ g.minuto }}' {{ g.jugador }}
            <em v-if="g.asistencia">· asist. {{ g.asistencia }}</em>
          </span>
        </div>
        <div v-if="!resumido && p.goleadoresRival.length" class="rp-goles suyos">
          <span v-for="(g, j) in p.goleadoresRival" :key="'r' + j" class="rp-gol">
            {{ g.minuto }}' {{ g.jugador }}
          </span>
        </div>
        <div v-if="p.tanda" class="rp-extra">
          Penales {{ p.tanda.mios }}–{{ p.tanda.suyos }}
          <template v-if="p.tanda.ganador != null"> · {{ p.tanda.ganador ? 'ganaste' : 'perdiste' }}</template>
        </div>
        <div v-if="!resumido && p.figura" class="rp-extra">
          Figura: <strong>{{ p.figura.jugador }}</strong> ({{ p.figura.g }}G + {{ p.figura.a }}A)
        </div>
      </li>
    </ul>
    <p v-else class="rp-vacio">Sin partidos registrados.</p>

    <h4 class="rp-titulo">Tu alineación</h4>
    <p v-if="cargando" class="rp-vacio">Buscando la alineación…</p>
    <p v-else-if="errorEquipo" class="rp-vacio">{{ errorEquipo }}</p>
    <template v-else-if="once.length">
      <!-- Últimas partidas reutiliza CanchaXI (el XV de "Ver XV") y deja
           solo el banco debajo; el historial completo mantiene el detalle. -->
      <CanchaXI v-if="resumido" :once="onceParaCancha" :formacion="partida.formacion"
                :almanaque="almanaque" sin-cabecera compacto />
      <template v-else>
        <div class="rp-cancha">
          <template v-for="j in once" :key="j.slot">
            <div v-if="coordsPorSlot.get(j.slot)" class="rp-punto"
                 :style="{ left: coordsPorSlot.get(j.slot)[0] + '%', top: coordsPorSlot.get(j.slot)[1] + '%' }"
                 :title="`${j.slot} · ${j.nombre}`">
              {{ posDe(j.slot) }}
            </div>
          </template>
        </div>
        <ul class="rp-once">
          <li v-for="j in once" :key="j.slot">
            <img v-if="fotoDe(j)" :src="fotoDe(j)" :alt="j.nombre" loading="lazy"
                 @error="(e) => fallbackInicial(e, j, 'rp-ini')" />
            <span v-else class="rp-ini">{{ j.nombre?.charAt(0) ?? '·' }}</span>
            <b>{{ j.slot }}</b>
            <span class="rp-nombre">{{ nombreCorto(j.nombre) }}<img v-if="escudoEpocaDe(j)" :src="escudoEpocaDe(j)" alt="" class="rp-escudo-mini" loading="lazy" @error="(e) => e.target.remove()" />{{ j.anio_orden ? ' ' + j.anio_orden : '' }}</span>
            <span v-if="j.dorsal_elegido != null" class="rp-dorsal">#{{ j.dorsal_elegido }}</span>
          </li>
        </ul>
      </template>
      <div v-if="suplentes.length" class="rp-banco">
        <h4 class="rp-titulo">Banco</h4>
        <ul class="rp-once">
          <li v-for="j in suplentes" :key="j.slot">
            <img v-if="fotoDe(j)" :src="fotoDe(j)" :alt="j.nombre" loading="lazy"
                 @error="(e) => fallbackInicial(e, j, 'rp-ini')" />
            <span v-else class="rp-ini">{{ j.nombre?.charAt(0) ?? '·' }}</span>
            <b>{{ j.slot }}</b>
            <span class="rp-nombre">{{ nombreCorto(j.nombre) }}<img v-if="escudoEpocaDe(j)" :src="escudoEpocaDe(j)" alt="" class="rp-escudo-mini" loading="lazy" @error="(e) => e.target.remove()" />{{ j.anio_orden ? ' ' + j.anio_orden : '' }}</span>
            <span v-if="j.dorsal_elegido != null" class="rp-dorsal">#{{ j.dorsal_elegido }}</span>
          </li>
        </ul>
      </div>
    </template>
    <p v-else class="rp-vacio">Sin alineación guardada.</p>
  </div>
</template>

<style scoped>
.resumen-partida { margin-top: 10px; padding: 10px 12px 12px; background: var(--superficie-baja);
  border: 1px solid var(--linea); border-radius: 8px; }
.rp-meta { display: flex; flex-wrap: wrap; gap: 6px 12px; font: 11px 'JetBrains Mono', monospace;
  color: var(--texto-suave); padding-bottom: 8px; border-bottom: 1px solid var(--linea); }
.rp-meta b { color: var(--texto-verde); }
.rp-formato { color: var(--rojo); font-weight: 700; }
.rp-cant { margin-left: auto; }
.rp-titulo { margin: 12px 0 6px; font: 600 12px 'JetBrains Mono', monospace;
  text-transform: uppercase; letter-spacing: .06em; color: #c8102e; }
.rp-partidos { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.rp-partido { padding: 8px; background: var(--superficie); border: 1px solid var(--linea); border-radius: 6px; }
.rp-cabeza { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.rp-signo { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;
  border-radius: 4px; color: #fff; font: 700 11px 'JetBrains Mono', monospace; flex: none; }
.rp-signo.v { background: #1b7f3b; }
.rp-signo.e { background: #a8842c; }
.rp-signo.d { background: #c8102e; }
.rp-escudo { width: 26px; height: 26px; object-fit: contain; flex: none; }
.rp-marcador { font: 600 14px 'JetBrains Mono', monospace; }
.rp-rival { font-weight: 600; font-size: 13px; }
.rp-fase { color: var(--texto-suave); font: 10px 'JetBrains Mono', monospace; }
.rp-goles { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 6px; }
.rp-gol { font: 11px 'JetBrains Mono', monospace; color: var(--texto-verde); }
.rp-gol em { font-style: normal; color: var(--texto-tenue); }
.rp-goles.suyos .rp-gol { color: var(--texto-tenue); }
.rp-extra { margin-top: 5px; font: 11px 'JetBrains Mono', monospace; color: #59645b; }
.rp-extra strong { color: #c8102e; }
.rp-vacio { margin: 4px 0; color: var(--texto-tenue); font-size: 12px; }
.rp-cancha { position: relative; width: 100%; max-width: 280px; margin: 8px auto;
  aspect-ratio: 68 / 90; border-radius: 10px;
  background: repeating-linear-gradient(180deg, #2e7a3c 0 10%, #2a7138 10% 20%); }
.rp-punto { position: absolute; transform: translate(-50%, -50%); min-width: 30px; height: 30px;
  padding: 0 4px; border-radius: 15px; background: rgba(0,0,0,.6); border: 1.5px solid rgba(255,255,255,.85);
  color: #fff; font: 700 9px 'JetBrains Mono', monospace; display: flex; align-items: center;
  justify-content: center; }
.rp-once { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 3px; }
.rp-once li { display: grid; grid-template-columns: 22px 40px minmax(0, 1fr) auto;
  gap: 6px; align-items: center; padding: 3px 8px; background: var(--superficie); border: 1px solid var(--linea);
  border-radius: 6px; font-size: 12px; }
.rp-once img { width: 22px; height: 22px; object-fit: cover; border-radius: 50%; }
.rp-ini { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;
  border-radius: 50%; background: var(--negro); color: #e8d58b; font: 700 11px 'Oswald', sans-serif; }
.rp-once b { color: #c8102e; font: 600 10px 'JetBrains Mono', monospace; }
.rp-nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rp-escudo-mini { display: inline-block; width: 13px; height: 13px; vertical-align: -2px; object-fit: contain; margin: 0 2px; }
.rp-dorsal { color: var(--texto-suave); font: 600 10px 'JetBrains Mono', monospace; }
.rp-once strong { color: #c8102e; font: 600 12px 'JetBrains Mono', monospace; }
.rp-banco { margin-top: 10px; padding-top: 4px; border-top: 1px dashed var(--linea); }
</style>
