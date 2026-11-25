<script setup>
import { computed, ref } from 'vue'
import { obtenerJugadores, obtenerRivales, guardarResultado, desbloquearLogro } from '../services/api.js'
import { usePrensa } from '../services/prensa.js'
import { RONDAS, simularTorneo, relato, goleadorTorneo, figuraPartido, calificaciones, elegirGoleadores } from '../game/formations.js'
import { onceRival } from '../game/ligas.js'
import XvRivalModal from './XvRivalModal.vue'
import RelatoEnVivo from './RelatoEnVivo.vue'
import EstadoSimulacion from './EstadoSimulacion.vue'
import { sonidoGol, sonidoCampeon, sonidoError, sonidoSilbato } from '../game/sound.js'
import { fotoDe, escudoDe, fallbackInicial } from '../game/fotos.js'
import { logrosDeTorneo } from '../game/logros.js'

const props = defineProps({
  equipo: { type: Array, required: true },
  estilo: { type: String, default: 'equilibrado' },
  anchura: { type: String, default: 'equilibrado' },
  capitan: { type: Object, default: null },
  partidaId: { type: Number, required: true },
  almanaque: { type: Boolean, default: false },
  nombreEquipo: { type: String, default: 'Tu equipo' },
  formaciones: { type: Object, required: true },
  todas: { type: Object, default: () => ({}) } // mapa completo incl. históricas
})
const emit = defineEmits(['fin'])
const { para: prensaPara, texto: textoPrensa, tribuna: textoTribuna } = usePrensa()

const fixture = ref([]) // 7 rivales
const indice = ref(0) // próximo partido a jugar
const jugando = ref(false)
const lineas = ref([]) // relato revelado
const torneo = ref(null) // { partidos }
const figuras = ref({}) // temporada_id -> top3
const logrosNuevos = ref([])
const amistoso = ref(false)
// UI: un solo despliegue de alineación a la vez por vista.
const alineacionAbierta = ref(false)
const previaPanel = ref(null)
const cierrePanel = ref(null)

const actual = computed(() => (!torneo.value?.finalizado ? fixture.value[indice.value] : null) ?? null)
const terminado = computed(() => !!torneo.value?.finalizado)
const ultimoPartido = computed(() => {
  const ps = torneo.value?.partidos ?? []
  return ps.length ? ps[ps.length - 1] : null
})
const rivalUltimo = computed(() =>
  fixture.value.find((f) => f.etiqueta === ultimoPartido.value?.rival) ?? null)

function irAPrevia() { previaPanel.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) }
function irACierre() { cierrePanel.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) }
const capitanNombre = computed(() => props.capitan?.nombre ?? null)
const capitanId = computed(() => props.capitan?.temporada_jugador_id ?? null)

function armarFixture(rivales) {
  const pool = [...rivales]
  const porOvr = [...pool].sort((a, b) => (b.ovr_equipo ?? 84) - (a.ovr_equipo ?? 84))
  const caos = Math.random() < 0.3
  if (caos || pool.length < 7) {
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 7)
  }
  const top = porOvr.slice(0, 2)
  const mid = porOvr.slice(2, 4)
  const resto = porOvr.slice(4)
  const grupos = [...resto].sort(() => Math.random() - 0.5).slice(0, 3)
  const usados = new Set(grupos.map((r) => r.temporada_id))
  const knock = [...top, ...mid].sort(() => Math.random() - 0.5)
  const fix = [...grupos]
  for (const r of knock) {
    if (!usados.has(r.temporada_id)) {
      fix.push(r)
      usados.add(r.temporada_id)
    }
  }
  let i = 0
  while (fix.length < 7) {
    const r = resto[i++ % resto.length]
    if (!usados.has(r.temporada_id)) {
      fix.push(r)
      usados.add(r.temporada_id)
    }
    if (i > 100) break
  }
  return fix.slice(0, 7)
}

async function preparar(amistosoPrevio = null) {
  const rivales = amistosoPrevio ?? (await obtenerRivales())
  if (rivales.length < 7) throw new Error('Faltan rivales en la base')
  fixture.value = armarFixture(rivales)
  indice.value = 0
  torneo.value = null
  lineas.value = []
  figuras.value = {}
  logrosNuevos.value = []
  amistoso.value = false
  alineacionAbierta.value = false
}

const rondaActual = (rival) => rival?.ronda ?? RONDAS[indice.value] ?? ''
async function verFiguras(rival) {
  if (!rival?.temporada_id) {
    figuras.value['sin-id'] = []
    return
  }
  if (figuras.value[rival.temporada_id]) return
  try {
    const js = await obtenerJugadores(rival.temporada_id)
    figuras.value[rival.temporada_id] = js
  } catch {
    figuras.value[rival.temporada_id] = []
  }
}

function onceRivalDe(rival) {
  if (!rival?.temporada_id) return []
  const plantel = figuras.value[rival.temporada_id] ?? []
  const mapa = props.todas[rival.formacion] ?? props.formaciones[rival.formacion] ?? {}
  return onceRival(plantel, mapa)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function jugar() {
  if (jugando.value || !actual.value) return
  jugando.value = true
  try {
    await verFiguras(actual.value)
    const rondaIdx = indice.value
    const t = simularTorneo(props.equipo, [actual.value], props.estilo, props.capitan, rondaIdx, props.anchura)
    const p = { ...t.partidos[0] }
    const acc = torneo.value ?? { partidos: [] }
    if (rondaIdx === 2) {
      const tres = [...acc.partidos, p].slice(0, 3)
      const pts = tres.reduce((a, x) => a + (x.favor > x.contra ? 3 : x.favor === x.contra ? 1 : 0), 0)
      if (pts < 3) p.avanzo = false
    }
    acc.partidos.push(p)
    const xiRival = onceRivalDe(actual.value).map((o) => o.jugador).filter(Boolean)
    p.goleadoresRival = elegirGoleadores(xiRival, p.contra)
    lineas.value = []
    sonidoSilbato()
    const soloMios = new Set((p.goleadores ?? []).map((g) => g.jugador))
    for (const l of relato(p, props.nombreEquipo, prensaPara(p))) {
      lineas.value.push(l)
      if (l.includes('¡GOL') && soloMios.size && [...soloMios].some((n) => l.includes(n))) sonidoGol()
      await sleep(750)
    }
    if (p.tanda) await sleep(500)
    await guardarResultado(props.partidaId, p.ronda, p.rival, p.favor, p.contra, p.avanzo, {
      goleadores: p.goleadores,
      tanda: p.tanda,
      goleadoresRival: p.goleadoresRival
    }, amistoso.value)
    if (p.avanzo) {
      indice.value++
      if (indice.value >= 7) {
        acc.campeon = true
        acc.finalizado = true
        acc.valla = acc.partidos.every((x) => x.contra === 0)
        torneo.value = acc
        sonidoCampeon()
        if (!amistoso.value) {
          await chequearLogros(acc)
          guardarUltimo(acc)
        } else {
          try {
            const r = await desbloquearLogro(props.partidaId, 'revancha_ok')
            if (r.nuevo) {
              logrosNuevos.value = ['revancha_ok']
              window.dispatchEvent(new CustomEvent('3a1:logro', { detail: 'revancha_ok' }))
            }
          } catch { /*noop*/ }
        }
        emit('fin', { campeon: true, amistoso: amistoso.value, valla: !!acc.valla })
      } else {
        torneo.value = acc
      }
    } else {
      acc.campeon = false
      acc.valla = false
      acc.finalizado = true
      torneo.value = acc
      if (!amistoso.value) guardarUltimo(acc)
      sonidoError()
      emit('fin', { campeon: false, amistoso: amistoso.value, valla: false })
    }
  } finally {
    jugando.value = false
  }
}

const LOGROS_LABEL = {
  primer_campeon: 'Primer campeón',
  siete_cero: '7A0 perfecto',
  campeon_debil: 'Campeón con equipo humilde',
  campeon_almanaque: 'Campeón a ciegas',
  goleada: 'Goleada (ganar por 4+)',
  valla_grupo: 'Grupos sin recibir goles',
  revancha_ok: 'Revancha cumplida',
  cinco_goles_un_jugador: '5 goles de un jugador',
  cinco_asistencias: '5 pases gol',
  torneo_perfecto: 'Torneo perfecto',
  valla_total: 'Valla total',
  clasico_doble: 'Clásico ida y vuelta'
}

async function chequearLogros(acc) {
  const nuevos = []
  const dar = async (cod, cond) => {
    if (!cond) return
    try {
      const r = await desbloquearLogro(props.partidaId, cod)
      if (r.nuevo) {
        nuevos.push(cod)
        window.dispatchEvent(new CustomEvent('3a1:logro', { detail: cod }))
      }
    } catch { /* tabla logros puede no existir aún */ }
  }
  const ovrProm = props.equipo.length
    ? props.equipo.reduce((a, j) => a + Number(j.ovr_final), 0) / props.equipo.length
    : 84
  await dar('primer_campeon', acc.campeon)
  await dar('siete_cero', acc.campeon && acc.valla)
  await dar('campeon_debil', acc.campeon && ovrProm < 82)
  await dar('campeon_almanaque', acc.campeon && props.almanaque)
  await dar('goleada', acc.partidos.some((p) => p.favor - p.contra >= 4))
  await dar('valla_grupo', acc.partidos.slice(0, 3).every((p) => p.contra === 0))

  // Los logros nuevos se infieren con la misma regla que en Copa/Liga. Se
  // filtran por LOGROS_LABEL para no duplicar los que ya se despacharon arriba.
  const delDetalle = logrosDeTorneo({
    campeon: acc.campeon,
    partidos: acc.partidos.map((p) => ({
      gf: p.favor, gc: p.contra, amistoso: false,
      detalle: { goleadores: p.goleadores ?? [] }
    }))
  }).filter((cod) => Object.prototype.hasOwnProperty.call(LOGROS_LABEL, cod))
  for (const cod of delDetalle) await dar(cod, true)
  logrosNuevos.value = nuevos
}

function guardarUltimo(acc) {
  try {
    localStorage.setItem('ultimoTorneo', JSON.stringify({
      fecha: new Date().toISOString(),
      campeon: !!acc.campeon,
      jugados: acc.partidos.length
    }))
  } catch { /*noop*/ }
}

const goleador = computed(() => (torneo.value ? goleadorTorneo(torneo.value, capitanId.value) : null))
const notas = computed(() => (torneo.value ? calificaciones(torneo.value) : null))
const figura = (p) => figuraPartido(p, capitanId.value, capitanNombre.value)

function comparativa() {
  try {
    const prev = JSON.parse(localStorage.getItem('ultimoTorneo') ?? 'null')
    if (!prev || !torneo.value) return ''
    const a = torneo.value
    if (a.campeon && !prev.campeon) return 'Mejor que tu anterior: ¡campeón!'
    if (!a.campeon && prev.campeon) return 'Peor que tu anterior, que fue campeón.'
    if (a.partidos.length > prev.jugados) return `Más lejos que la vez pasada (${prev.jugados} → ${a.partidos.length} partidos).`
    if (a.partidos.length < prev.jugados) return `Más corto que la vez pasada (${prev.jugados} → ${a.partidos.length}).`
    return 'Igual que tu anterior campaña.'
  } catch {
    return ''
  }
}

async function compartir() {
  if (!torneo.value) return
  const g = goleadorTorneo(torneo.value)
  const titulo = torneo.value.campeon
    ? (torneo.value.valla ? '🏆 ¡7A0! Campeón con valla invicta' : '🏆 ¡Campeón!')
    : `Eliminado en ${torneo.value.partidos[torneo.value.partidos.length - 1].ronda}`
  const lineasR = torneo.value.partidos.map((p) => `${p.ronda}: ${p.favor}-${p.contra} vs ${p.rival}`).join('\n')
  const texto = `3A1 · ${titulo}\n${g ? `Goleador: ${g.jugador} (${g.goles})` : 'Sin goles'}\n${lineasR}\n¿Armás un mejor 11?`
  try {
    if (navigator.share) {
      await navigator.share({ title: '3A1', text: texto })
    } else {
      await navigator.clipboard.writeText(texto)
      lineas.value.push('Copiado al portapapeles.')
    }
  } catch { /* cancelado */ }
}

async function revancha() {
  if (!fixture.value.length || fixture.value.length < 7) {
    try {
      await preparar()
    } catch {
      return
    }
  }
  const fix = fixture.value
  torneo.value = null
  lineas.value = []
  indice.value = 0
  figuras.value = {}
  logrosNuevos.value = []
  amistoso.value = true
  alineacionAbierta.value = false
  fixture.value = fix
}

async function restaurar(rows) {
  const oficiales = rows.filter((r) => !r.amistoso)
  if (!oficiales.length) return false
  const partidos = oficiales.map((r) => ({
    ronda: r.ronda,
    rival: r.rival,
    favor: r.goles_favor,
    contra: r.goles_contra,
    goleadores: r.detalle?.goleadores ?? [],
    tanda: r.detalle?.tanda ?? null,
    avanzo: r.avanzo
  }))
  const last = partidos[partidos.length - 1]
  const campeon = partidos.length === 7 && last.ronda === 'Final' && partidos.every((p) => p.avanzo)
  const finalizado = campeon || !last.avanzo || partidos.length >= 7
  let fix = oficiales.map((r) => ({
    etiqueta: r.rival,
    rival: r.rival,
    ronda: r.ronda,
    formacion: '',
    ovr_equipo: null,
    temporada_id: null
  }))
  if (!finalizado) {
    try {
      const rivales = await obtenerRivales()
      const usados = new Set(oficiales.map((r) => r.rival))
      const resto = rivales.filter((t) => !usados.has(t.etiqueta))
      let i = 0
      while (fix.length < 7 && i < resto.length) fix.push(resto[i++])
      i = 0
      while (fix.length < 7 && i < rivales.length) {
        const c = rivales[i++]
        if (!fix.some((f) => f.etiqueta === c.etiqueta)) fix.push(c)
        if (i > 200) break
      }
    } catch { /* sin red: queda solo lo jugado */ }
  }
  fixture.value = fix
  indice.value = finalizado ? partidos.length : partidos.length
  torneo.value = finalizado
    ? { partidos, campeon, valla: campeon && partidos.every((p) => p.contra === 0), finalizado: true }
    : { partidos, campeon: false, valla: false, finalizado: false }
  amistoso.value = false
  lineas.value = []
  return true
}

defineExpose({ preparar, restaurar })
</script>

<template>
  <div class="torneo-sec">
    <EstadoSimulacion :jugando="jugando" :titulo="`Jugando ${rondaActual(actual)}`"
                      detalle="El relato se muestra acá, minuto a minuto." />
    <div v-if="actual && !terminado" ref="previaPanel" class="panel previa">
      <h3>{{ rondaActual(actual) }} · previa</h3>
      <img v-if="escudoDe(actual)" :src="escudoDe(actual)" alt="escudo rival" class="escudo" loading="lazy" @error="(e) => e.target.remove()" />
      <p class="vs"><strong>{{ actual.etiqueta }}</strong> · {{ actual.formacion }} · OVR {{ almanaque ? '¿?' : (actual.ovr_equipo ?? '?') }}</p>
      <p v-if="textoPrensa(actual)" class="prensa-line">{{ textoPrensa(actual) }}</p>
      <button class="btn ghost small-btn alineacion-toggle" :aria-expanded="alineacionAbierta" @click="alineacionAbierta = !alineacionAbierta">
        {{ alineacionAbierta ? 'Ocultar XV' : 'Ver XV del rival' }}
      </button>
      <XvRivalModal v-if="alineacionAbierta && actual" :temporada="actual"
                    :almanaque="almanaque" @cerrar="alineacionAbierta = false" />
      <button class="btn primary big" :disabled="jugando" @click="jugar">
        {{ jugando ? 'Jugando…' : 'Jugar partido' }}
      </button>
    </div>

    <RelatoEnVivo :lineas="lineas" :jugando="jugando"
                  :titulo="`Minuto a minuto · ${rondaActual(actual)}`" />

    <div v-if="lineas.length && !jugando && ultimoPartido" class="panel partido-terminado-banner">
      <p class="terminado-kicker">Partido terminado</p>
      <div class="terminado-marcador">
        <img v-if="escudoDe(rivalUltimo)" :src="escudoDe(rivalUltimo)" alt="escudo rival" class="escudo" loading="lazy" @error="(e) => e.target.remove()" />
        <strong>{{ nombreEquipo }} {{ ultimoPartido.favor }}–{{ ultimoPartido.contra }} {{ ultimoPartido.rival }}</strong>
      </div>
      <p v-if="textoPrensa(ultimoPartido)" class="prensa-line">{{ textoPrensa(ultimoPartido) }}</p>
      <p v-if="textoTribuna(ultimoPartido)" class="prensa-line">{{ textoTribuna(ultimoPartido) }}</p>
      <button v-if="terminado" class="btn primary" @click="irACierre">Ver cierre</button>
      <button v-else class="btn primary" @click="irAPrevia">Siguiente partido</button>
    </div>

    <div v-if="terminado" ref="cierrePanel" class="panel cierre-final">
      <p class="terminado-kicker">Torneo finalizado</p>
      <h2>{{ torneo.campeon ? '🏆 CAMPEÓN' : 'Eliminado' }}
        <span v-if="torneo.campeon && torneo.valla" class="badge goldbg">7A0</span>
      </h2>
      <p v-if="comparativa()" class="muted">{{ comparativa() }}</p>
      <p v-if="goleador" class="muted">Goleador: <strong>{{ goleador.jugador }}</strong> ({{ goleador.goles }})</p>
      <p v-if="notas && !almanaque" class="muted small">Ataque {{ notas.ataque }}/10 · Defensa {{ notas.defensa }}/10</p>
      <ul class="torneo-list">
        <li v-for="p in torneo.partidos" :key="p.ronda">
          <strong>{{ p.ronda }}</strong> · {{ p.favor }} – {{ p.contra }} {{ p.rival }}
          <span v-if="!p.avanzo" class="badge">afuera</span>
          <span v-if="p.tanda" class="muted small"> · penales {{ p.tanda.mios }}–{{ p.tanda.suyos }}</span>
          <span v-if="figura(p)" class="muted small"> · figura: {{ figura(p) }}</span>
          <div v-for="g in p.goleadores" :key="g.minuto + g.jugador" class="muted small">
            {{ g.minuto }}' {{ g.jugador }}
          </div>
        </li>
      </ul>
      <div v-if="logrosNuevos.length" class="logros-new">
        <span v-for="c in logrosNuevos" :key="c" class="badge goldbg">{{ LOGROS_LABEL[c] ?? c }}</span>
      </div>
      <div class="row">
        <button class="btn ghost" @click="compartir">Compartir</button>
        <button v-if="!amistoso" class="btn primary" @click="revancha">Revancha (amistoso)</button>
      </div>
      <p class="muted small">Siguiente paso: jugá la revancha o empezá una nueva partida desde el inicio.</p>
      <p v-if="amistoso" class="muted small">Revancha amistosa: no suma logros ni ranking.</p>
    </div>
  </div>
</template>

<style scoped>
.previa { text-align: center; }
.escudo { width: 56px; height: 56px; object-fit: contain; }
.vs { font-size: 17px; }
.prensa-line { font: 500 11px/1.4 'JetBrains Mono', monospace; color: var(--texto-suave); margin: 6px 0 8px; }
.torneo-list { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 8px; }
.torneo-list > li { border: 1px solid var(--linea); border-radius: 10px; padding: 9px 12px; background: var(--superficie); }
.logros-new { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
.alineacion-toggle { margin: 2px 0 4px; }
.terminado-kicker { margin: 0 0 4px; font: 700 11px 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #1b7f3b; }
.partido-terminado-banner { border-left: 4px solid #1b7f3b; text-align: center; }
.terminado-marcador { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;
  background: var(--negro); color: #fff; border-radius: 8px; padding: 8px 12px; margin: 8px 0; }
.terminado-marcador .escudo { width: 34px; height: 34px; }
.terminado-marcador strong { font: 600 16px 'Oswald', sans-serif; }
.cierre-final { text-align: left; }
</style>
