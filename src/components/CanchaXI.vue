<script setup>
// Cancha única para las alineaciones: el mismo dibujo en el draft, en Copa y
// en Ligas. No contiene datos: recibe una lista [{ slot, pos, jugador }].
import { computed, ref } from 'vue'
import { fotoDe, fallbackInicial } from '../game/fotos.js'
import { nombreCorto } from '../game/nombres.js'
import { PITCH_COORDS } from '../game/pitch.js'

const props = defineProps({
  once: { type: Array, default: () => [] },
  formacion: { type: String, default: '' },
  titulo: { type: String, default: '' },
  subtitulo: { type: String, default: '' },
  escudo: { type: String, default: '' },
  almanaque: { type: Boolean, default: false },
  sinCabecera: { type: Boolean, default: false },
  compacto: { type: Boolean, default: false },
  vacio: { type: String, default: 'Sin alineación disponible.' }
})

const mapa = computed(() => PITCH_COORDS[props.formacion] ?? Object.values(PITCH_COORDS)[0] ?? {})
// En celular las etiquetas no caben sobre la cancha: tocá una ficha y se
// resalta su renglón en la lista de abajo, para asociar las dos vistas.
const resaltado = ref(null)
function resaltar(slot) { resaltado.value = resaltado.value === slot ? null : slot }
function coord(slot) {
  return mapa.value[slot] ?? [50, 50]
}
function inicial(jugador) {
  return String(jugador?.nombre ?? '').charAt(0) || '·'
}
</script>

<template>
  <div class="cancha-xi" :class="{ compacto }">
    <header v-if="!sinCabecera && titulo" class="xi-cab">
      <img v-if="escudo" :src="escudo" :alt="`Escudo de ${titulo}`" class="xi-escudo" loading="lazy"
           @error="(e) => e.target.remove()" />
      <div class="xi-id">
        <h3><span class="xi-bar"></span>{{ titulo }}</h3>
        <p v-if="subtitulo" class="muted small">{{ subtitulo }}</p>
      </div>
    </header>

    <p v-if="!once.length" class="estado-vacio">{{ vacio }}</p>
    <div v-else class="pitch-wrap">
      <div class="pitch">
        <div class="pitch-line halfway"></div>
        <div class="pitch-line penalty-top"></div>
        <div class="pitch-line penalty-bottom"></div>
        <div class="pitch-line goal-top"></div>
        <div class="pitch-line goal-bottom"></div>
        <div v-for="s in once" :key="s.slot" class="ficha"
             :class="{ libre: !s.jugador, resaltada: resaltado === s.slot }"
             :style="{ left: coord(s.slot)[0] + '%', top: coord(s.slot)[1] + '%' }"
             :title="s.jugador ? `${s.jugador.nombre} · ${s.slot}` : s.slot"
             @click="s.jugador && resaltar(s.slot)">
          <template v-if="s.jugador">
            <img v-if="fotoDe(s.jugador)" :src="fotoDe(s.jugador)" :alt="s.jugador.nombre"
                 class="foto" loading="lazy"
                 @error="(e) => fallbackInicial(e, s.jugador, 'ini foto-ini')" />
            <span v-else class="ini foto-ini">{{ inicial(s.jugador) }}</span>
            <!-- Nombre y puesto/OVR en renglones distintos: así el slot nunca
                 queda pegado al apellido ni se lee como un guion (Beltrán-DC). -->
            <small class="tag">
              <span class="tag-nombre">{{ nombreCorto(s.jugador.nombre) }}</span>
              <span class="tag-meta">
                <span class="tag-slot">{{ s.slot }}</span>
                <span v-if="!almanaque" class="tag-ovr">OVR {{ s.jugador.ovr_final ?? '?' }}</span>
              </span>
            </small>
          </template>
          <template v-else>
            <span class="pos">{{ s.pos }}</span>
            <small class="tag"><span class="tag-slot">{{ s.slot }}</span></small>
          </template>
        </div>
      </div>
    </div>
    <!-- En pantallas chicas las etiquetas dentro de la cancha se pisan:
         se ocultan y se muestra esta lista compacta debajo. -->
    <template v-if="once.length">
      <p class="ley-nota">En el celular los nombres no caben sobre la cancha. Tocá una ficha y se resalta en esta lista, ordenada por puesto.</p>
      <ol class="xi-leyenda">
        <li v-for="s in once" :key="`ley-${s.slot}`" :class="{ resaltada: resaltado === s.slot }"
            @click="resaltar(s.slot)">
          <span class="ley-slot">{{ s.slot }}</span>
          <img v-if="s.jugador && fotoDe(s.jugador)" :src="fotoDe(s.jugador)" alt="" class="ley-foto"
               loading="lazy" @error="(e) => e.target.remove()" />
          <span class="ley-nombre">{{ s.jugador ? nombreCorto(s.jugador.nombre) : s.pos }}</span>
          <span v-if="s.jugador && !almanaque" class="ley-ovr">{{ s.jugador.ovr_final ?? '?' }}</span>
        </li>
      </ol>
    </template>
  </div>
</template>

<style scoped>
.xi-cab { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.xi-escudo { width: 34px; height: 34px; object-fit: contain; flex: none; }
.xi-id { min-width: 0; }
.xi-id h3 { margin: 0; color: var(--tinta); font: 600 15px var(--display, 'Oswald', sans-serif); text-transform: uppercase; }
.xi-id p { margin: 2px 0 0; }
.xi-bar { display: inline-block; width: 4px; height: 14px; margin-right: 7px; vertical-align: -2px;
  border-radius: 2px; background: var(--rojo, #c8102e); }
.estado-vacio { padding: 10px; color: #777; font: 12px var(--texto, 'Inter', sans-serif); }

.pitch-wrap { padding: 8px; background: var(--superficie-baja); border: 1px solid var(--linea); }
.pitch { position: relative; aspect-ratio: 1 / 1.22; overflow: hidden;
  background: repeating-linear-gradient(0deg, #236b3b 0, #236b3b 12.5%, #1e6436 12.5%, #1e6436 25%);
  border: 2px solid #d2d9c9; }
.pitch::before, .pitch::after { content: ''; position: absolute; left: 4%; right: 4%; border: 2px solid rgba(217,231,202,.48); }
.pitch::before { top: 4%; bottom: 4%; }
.pitch::after { top: 50%; height: 0; border-width: 1px 0 0; }
.pitch-line { position: absolute; z-index: 1; border: 2px solid rgba(217,231,202,.45); }
.halfway { width: 18%; aspect-ratio: 1; left: 41%; top: 42%; border-radius: 50%; }
.penalty-top, .penalty-bottom { left: 29%; width: 42%; height: 15%; }
.penalty-top { top: 4%; border-top: 0; }
.penalty-bottom { bottom: 4%; border-bottom: 0; }
.goal-top, .goal-bottom { left: 40%; width: 20%; height: 4%; }
.goal-top { top: 4%; border-top: 0; }
.goal-bottom { bottom: 4%; border-bottom: 0; }

/* Ficha única: River y rivales comparten este tamaño y formato de foto. */
.ficha { position: absolute; z-index: 2; display: flex; align-items: center; justify-content: center;
  width: 46px; height: 46px; margin: -23px 0 0 -23px; border: 1.5px solid #e8d58b; border-radius: 50%;
  background: rgba(16,73,36,.42); color: #f6e7af; font: 600 10px var(--label, 'JetBrains Mono', monospace); }
.ficha.libre { border-style: dashed; }
.ficha .foto, .ficha .ini, .ficha :deep(.ini) { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; }
.ficha .ini, .ficha :deep(.ini) { display: inline-flex; align-items: center; justify-content: center;
  background: var(--negro); color: #e8d58b; font: 700 13px var(--display, 'Oswald', sans-serif); }
/* Dos renglones: el nombre nunca se pega al slot ni se lee con guion. */
.ficha .tag { position: absolute; top: 103%; left: 50%; transform: translateX(-50%); max-width: 92px;
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  text-align: center; line-height: 1.15;
  background: rgba(0,0,0,.78); color: #fff; border-radius: 4px; padding: 2px 5px;
  font: 600 9px var(--label, 'JetBrains Mono', monospace); }
/* El nombre se parte en renglones en vez de cortarse con "…": en la cancha
   compacta el arquero (y cualquier nombre largo) debe leerse completo. */
.ficha .tag-nombre { display: block; max-width: 100%; white-space: normal; overflow-wrap: anywhere; line-height: 1.1; }
.ficha .tag-meta { display: flex; align-items: center; justify-content: center; gap: 5px;
  font-size: 8px; color: #e8d58b; }
.ficha .tag-slot { font-weight: 700; }
.ficha .tag-ovr { color: #fff; }
.ficha.resaltada { outline: 2px solid #fff; box-shadow: 0 0 0 3px rgba(200,16,46,.65); }
.ley-nota, .xi-leyenda { display: none; }

.cancha-xi.compacto .pitch-wrap { max-width: 320px; margin: 6px auto; padding: 5px; }
.cancha-xi.compacto .ficha { width: 42px; height: 42px; margin: -21px 0 0 -21px; }
.cancha-xi.compacto .ficha .foto, .cancha-xi.compacto .ficha .ini,
.cancha-xi.compacto .ficha :deep(.ini) { width: 34px; height: 34px; }
.cancha-xi.compacto .ficha .tag { max-width: 76px; font-size: 9px; }

@media (max-width: 600px) {
  .pitch-wrap { padding: 5px; }
  .ficha, .cancha-xi.compacto .ficha { width: 44px; height: 44px; margin: -22px 0 0 -22px; }
  .ficha .foto, .ficha .ini, .ficha :deep(.ini),
  .cancha-xi.compacto .ficha .foto, .cancha-xi.compacto .ficha .ini,
  .cancha-xi.compacto .ficha :deep(.ini) { width: 36px; height: 36px; }
  .ficha, .cancha-xi.compacto .ficha { cursor: pointer; }
  .ficha .tag, .cancha-xi.compacto .ficha .tag { display: none; }
  .ley-nota { display: block; margin: 10px 0 6px; color: var(--texto-suave);
    font: 500 11px/1.45 var(--texto, 'Inter', sans-serif); }
  .xi-leyenda { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px 10px;
    margin: 0; padding: 0; list-style: none; counter-reset: ley; }
  .xi-leyenda li { display: flex; align-items: center; gap: 5px; min-width: 0; padding: 3px 4px;
    border-radius: 4px; color: var(--tinta); cursor: pointer;
    font: 500 11px/1.35 var(--texto, 'Inter', sans-serif); }
  .xi-leyenda li.resaltada { background: var(--superficie-roja); box-shadow: inset 2px 0 0 var(--rojo); }
  .xi-leyenda .ley-slot { flex: none; min-width: 26px; color: var(--texto-tenue);
    font: 600 9px var(--label, 'JetBrains Mono', monospace); }
  .ley-foto { width: 20px; height: 20px; flex: none; border-radius: 50%; object-fit: cover; }
  .xi-leyenda .ley-nombre { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .xi-leyenda .ley-ovr { margin-left: auto; color: var(--rojo); font-weight: 600; }
}
</style>
