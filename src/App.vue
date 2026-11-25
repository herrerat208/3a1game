<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import DraftGame from './components/DraftGame.vue'
import DocumentosPanel from './components/DocumentosPanel.vue'
import CuriosidadesInformacionView from './views/CuriosidadesInformacionView.vue'
import TusDraftsView from './views/TusDraftsView.vue'
import AuthModal from './components/AuthModal.vue'
import { registrarMedalla, resumenRecompensas } from './game/recompensas.js'
import { usuario, cargarSesion, salir } from './services/auth.js'

// Una sola navegación para todo el juego. DraftGame queda montado (v-show)
// para no perder la partida en curso al cambiar de sección.
// Curiosidades e Información son entradas separadas en el navbar de escritorio.
// En celular las dos se agrupan bajo un único "Info" con selector interno.
const nav = [
  { id: 'inicio', etiqueta: 'Zona de juego' },
  { id: 'curiosidades', etiqueta: 'Curiosidades' },
  { id: 'informacion', etiqueta: 'Información' },
  { id: 'tus-drafts', etiqueta: 'Tus drafts' }
]
const vista = ref('inicio')
const seccionInfo = ref('informacion')
// Privacidad es una pestaña dentro de Información: el navbar debe seguir
// marcando Información aunque la sección activa sea privacidad.
const navActiva = computed(() => vista.value === 'informacion' ? 'informacion' : vista.value)
const seccionDrafts = ref('rivales')
const docsAbierta = ref(false)
const docsSeccion = ref('manual')
const estadoJuego = ref(null)
const toasts = ref([])
const authAbierta = ref(false)

// Tema claro/oscuro. El atributo ya viene puesto por el script de index.html
// para que no haya parpadeo al cargar; acá solo se lee y se persiste.
const CLAVE_TEMA = '3a1:tema'
const tema = ref(document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro')
function aplicarTema(valor) {
  document.documentElement.dataset.tema = valor
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', valor === 'oscuro' ? '#11100F' : '#ece8dc')
}
function alternarTema() {
  tema.value = tema.value === 'oscuro' ? 'claro' : 'oscuro'
  try { localStorage.setItem(CLAVE_TEMA, tema.value) } catch (e) { /* almacenamiento no disponible */ }
}
watch(tema, aplicarTema)
const LOGROS = {
  primer_partido: 'Primer partido',
  primer_campeon: 'Primer campeón',
  campeon_premier: 'Campeón Premier',
  campeon_liga30: 'Campeón Argentina',
  clasico_ganado: 'Clásico ganado',
  goleada: 'Goleada (4+)',
  siete_cero: '7A0 perfecto',
  campeon_debil: 'Campeón humilde',
  campeon_almanaque: 'Campeón a ciegas',
  valla_grupo: 'Grupos sin goles',
  revancha_ok: 'Revancha cumplida',
  asistencia: 'Primer pase gol',
  hat_trick: 'Hat-trick',
  diez_goles: '10 goles en un torneo',
  campeon_invicto: 'Campeón invicto',
  veterano: 'Veterano (5 torneos)',
  cinco_goles_un_jugador: '5 goles de un jugador',
  cinco_asistencias: '5 pases gol',
  torneo_perfecto: 'Torneo perfecto',
  valla_total: 'Valla total',
  clasico_doble: 'Clásico doble'
}
function irA(id) {
  if (id === 'informacion' || id === 'privacidad') irAInfo(id)
  else vista.value = id
}
function irAInfo(seccion = 'informacion') {
  seccionInfo.value = seccion === 'curiosidades' ? 'informacion' : seccion
  vista.value = 'informacion'
}
function irATusDrafts(seccion = 'rivales') {
  seccionDrafts.value = seccion
  vista.value = 'tus-drafts'
}
function irARivales() { irATusDrafts('rivales') }
function abrirDocs(seccion = 'manual') {
  docsSeccion.value = seccion
  docsAbierta.value = true
}
function avisarLogro(cod) {
  if (!cod) return
  const medallas = registrarMedalla(cod)
  const resumen = resumenRecompensas()
  const id = Date.now() + Math.random()
  toasts.value.push({ id, cod, medallas, medalla: resumen.medalla })
  setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id) }, 3800)
}
function avisarGuardado(detalle) {
  const id = Date.now() + Math.random()
  toasts.value.push({ id, tipo: 'guardado', mensaje: detalle?.mensaje ?? '' })
  setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id) }, 4200)
}
async function salirCuenta() {
  try { await salir() } catch (e) { avisarGuardado({ mensaje: e.message }) }
}
onMounted(() => {
  aplicarTema(tema.value)
  window.addEventListener('3a1:logro', (e) => avisarLogro(e.detail))
  window.addEventListener('3a1:guardado', (e) => avisarGuardado(e.detail))
  cargarSesion()
})
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#contenido">Saltar al contenido</a>

    <header class="navbar">
      <div class="nav-inner">
        <button class="brand" type="button" @click="vista = 'inicio'" aria-label="Ir a la zona de juego">
          <img class="brand-logo" src="/logo-3a1.webp" alt="" width="400" height="321" />
          <span class="brand-type">
            <strong>Draft Millonario</strong>
          </span>
        </button>

        <nav class="nav-links" aria-label="Navegación principal">
          <button v-for="item in nav" :key="item.id" type="button"
                  :class="['nav-link', { on: navActiva === item.id }]"
                  :aria-current="navActiva === item.id ? 'page' : undefined"
                  @click="irA(item.id)">{{ item.etiqueta }}</button>
        </nav>

        <div class="nav-der">
          <div class="nav-status" :class="{ 'sin-partida': !estadoJuego?.partida }"
               :title="estadoJuego?.partida ? `${estadoJuego.jugadores} de ${estadoJuego.total} jugadores elegidos` : 'Todavía no empezaste un draft'">
            <span class="status-dot" aria-hidden="true"></span>
            <span class="status-num">{{ estadoJuego?.jugadores ?? 0 }}<span>/{{ estadoJuego?.total ?? 16 }}</span></span>
            <span class="status-label">Jugadores elegidos</span>
          </div>
          <span v-if="estadoJuego?.partida" class="paso-chip">{{ estadoJuego.estado }}</span>
          <button v-if="!usuario" class="nav-cuenta" type="button" @click="authAbierta = true">
            Ingresar
          </button>
          <div v-else class="nav-cuenta-logueada" :title="`Sesión de ${usuario.alias} (${usuario.rol})`">
            <span class="cuenta-alias">{{ usuario.alias }}</span>
            <span v-if="usuario.rol === 'admin'" class="cuenta-rol">admin</span>
            <button type="button" @click="salirCuenta">Salir</button>
          </div>
          <button class="nav-tema" type="button"
                  :title="tema === 'oscuro' ? 'Usar tema claro' : 'Usar tema oscuro'"
                  :aria-label="tema === 'oscuro' ? 'Usar tema claro' : 'Usar tema oscuro'"
                  :aria-pressed="tema === 'oscuro'" @click="alternarTema">
            <svg v-if="tema === 'claro'" class="ico-luna" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.3 14.6A8.6 8.6 0 0 1 9.4 3.7a8.6 8.6 0 1 0 10.9 10.9Z" />
            </svg>
            <svg v-else class="ico-sol" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
            </svg>
            <span class="tema-label">{{ tema === 'oscuro' ? 'Claro' : 'Oscuro' }}</span>
          </button>
          <button class="nav-help" type="button" title="Cómo jugar" @click="abrirDocs('manual')">
            <span class="help-mark" aria-hidden="true">?</span>
            <span class="help-label">Cómo jugar</span>
          </button>
        </div>
      </div>
    </header>

    <main id="contenido">
      <div v-show="vista === 'inicio'">
        <DraftGame @estado="estadoJuego = $event" @ir-rivales="irARivales"
                   @ir-historial="irATusDrafts('historial')" />
      </div>
      <CuriosidadesInformacionView v-if="vista === 'curiosidades'" :unica="true"
                                   @cambiar-seccion="irA($event)" />
      <CuriosidadesInformacionView v-else-if="vista === 'informacion'" :seccion="seccionInfo"
                                   @cambiar-seccion="irA($event)" />
      <TusDraftsView v-else-if="vista === 'tus-drafts'"
                     :almanaque="!!estadoJuego?.almanaque"
                     :partida-id="estadoJuego?.partidaId ?? null"
                     :seccion="seccionDrafts" />
    </main>

    <footer>
      <span class="footer-frase">Draft histórico de River Plate · Una camiseta. Once decisiones.</span>
      <button class="footer-docs" type="button" @click="abrirDocs('manual')">▤ Documentos completos</button>
    </footer>

    <!-- Navegación rápida de celular: mismas secciones, siempre a un toque. -->
    <nav class="bottom-nav" aria-label="Navegación rápida">
      <button type="button" :class="{ on: vista === 'inicio' }" :aria-current="vista === 'inicio' ? 'page' : undefined"
              @click="vista = 'inicio'">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M12 4v16M3 12h18"/><circle cx="12" cy="12" r="3.5"/></svg>
        <span>Juego</span>
      </button>
      <button type="button" :class="{ on: vista === 'tus-drafts' && seccionDrafts === 'rivales' }"
              :aria-current="vista === 'tus-drafts' && seccionDrafts === 'rivales' ? 'page' : undefined"
              @click="irATusDrafts('rivales')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v6c0 4.4-3.3 7.6-8 9-4.7-1.4-8-4.6-8-9V6l8-3Z"/><path d="m8.5 11.5 2.5 2.5 4.5-5"/></svg>
        <span>Equipos</span>
      </button>
      <button type="button" :class="{ on: vista === 'tus-drafts' && seccionDrafts !== 'rivales' }"
              :aria-current="vista === 'tus-drafts' && seccionDrafts !== 'rivales' ? 'page' : undefined"
              @click="irATusDrafts('historial')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>
        <span>Historial</span>
      </button>
      <button type="button" :class="{ on: vista === 'informacion' }" :aria-current="vista === 'informacion' ? 'page' : undefined"
              @click="irAInfo(seccionInfo)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 7.6v.4"/></svg>
        <span>Info</span>
      </button>
      <button type="button" @click="abrirDocs('manual')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M9.7 9a2.4 2.4 0 1 1 3.2 2.3c-.7.3-.9.7-.9 1.4v.3M12 16.6v.2"/></svg>
        <span>Ayuda</span>
      </button>
    </nav>

    <DocumentosPanel v-if="docsAbierta" :seccion-inicial="docsSeccion" @cerrar="docsAbierta = false" />
    <AuthModal v-if="authAbierta" @cerrar="authAbierta = false" />

    <div class="toast-stack" aria-live="polite">
      <div v-for="t in toasts" :key="t.id" class="toast-logro">
        <template v-if="t.tipo === 'guardado'">
          <span class="toast-icon" aria-hidden="true">✓</span>
          <div>
            <small>Ranking compartido</small>
            <strong>{{ t.mensaje }}</strong>
          </div>
        </template>
        <template v-else>
          <span class="toast-icon" aria-hidden="true">★</span>
          <div>
            <small>Logro desbloqueado · +1 {{ t.medalla?.nombre ?? 'medalla' }}</small>
            <strong>{{ LOGROS[t.cod] ?? t.cod }}</strong>
            <small>{{ t.medallas }} medallas · {{ t.medalla?.icono }} {{ t.medalla?.nombre }}</small>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-shell { min-height: 100vh; }

.skip-link {
  position: fixed;
  top: 10px;
  left: 10px;
  z-index: 200;
  padding: 10px 14px;
  background: var(--tinta);
  color: var(--invertir-texto);
  font: 600 12px var(--display);
  text-transform: uppercase;
  transform: translateY(-160%);
  transition: transform .15s ease;
}
.skip-link:focus { transform: none; }

/* ---------- Barra superior editorial ---------- */
.navbar {
  position: sticky;
  top: 0;
  z-index: 60;
  background: var(--nav-fondo);
  border-bottom: 1px solid var(--linea);
  backdrop-filter: saturate(1.1) blur(12px);
  -webkit-backdrop-filter: saturate(1.1) blur(12px);
}
.nav-inner {
  min-height: var(--header-h);
  padding: 0 clamp(16px, 3.2vw, 44px);
  display: flex;
  align-items: center;
  gap: clamp(14px, 2vw, 30px);
  max-width: 1440px;
  margin: 0 auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.brand-logo {
  width: 44px;
  height: 44px;
  display: block;
  object-fit: contain;
  flex: none;
}
.brand-type { display: flex; align-items: center; min-width: 0; }
.brand-type strong {
  color: var(--tinta);
  font: 700 15px/1 var(--display);
  letter-spacing: .035em;
  text-transform: uppercase;
  white-space: nowrap;
}

.nav-links { display: flex; align-items: center; gap: 2px; flex: 1; min-width: 0; }
.nav-link {
  position: relative;
  min-height: 36px;
  padding: 0 13px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--texto-suave);
  cursor: pointer;
  font: 600 12px var(--display);
  letter-spacing: .045em;
  text-transform: uppercase;
  white-space: nowrap;
  transition: background .15s ease, color .15s ease;
}
.nav-link:hover { color: var(--tinta); background: var(--superficie-media); }
.nav-link.on { background: var(--rojo); color: #fff; }

.nav-der { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.nav-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--linea);
  border-radius: 3px;
  background: var(--superficie);
  color: var(--tinta);
  white-space: nowrap;
}
.nav-status.sin-partida .status-dot { background: var(--linea-fuerte); box-shadow: none; }
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--turf);
  box-shadow: 0 0 0 3px rgba(59, 165, 104, .16);
  flex: none;
}
.status-num { font: 700 14px/1 var(--display); letter-spacing: .02em; }
.status-num span { color: var(--texto-tenue); font-weight: 500; }
.status-label {
  color: var(--texto-suave);
  font: 600 9px var(--label);
  letter-spacing: .08em;
  text-transform: uppercase;
}
.paso-chip {
  padding: 5px 8px;
  border: 1px solid var(--linea);
  border-radius: 2px;
  background: var(--superficie-media);
  color: var(--texto-suave);
  font: 600 9px var(--label);
  letter-spacing: .07em;
  text-transform: uppercase;
  white-space: nowrap;
}
.nav-help {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 12px;
  flex: none;
  border: 1px solid var(--tinta);
  border-radius: 3px;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: 600 11px var(--display);
  letter-spacing: .05em;
  text-transform: uppercase;
  white-space: nowrap;
  transition: background .15s ease, color .15s ease;
}
.nav-help:hover { background: var(--invertir-fondo); color: var(--invertir-texto); }

.nav-cuenta {
  display: inline-flex; align-items: center; min-height: 38px; padding: 0 12px;
  flex: none; border: 1px solid var(--rojo); border-radius: 3px;
  background: var(--rojo); color: #fff; cursor: pointer;
  font: 600 11px var(--display); letter-spacing: .05em; text-transform: uppercase;
}
.nav-cuenta:hover { filter: brightness(1.08); }
.nav-cuenta-logueada {
  display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 0 8px;
  border: 1px solid var(--linea); border-radius: 3px;
  font: 600 11px var(--display); text-transform: uppercase; white-space: nowrap;
}
.cuenta-alias { max-width: 110px; overflow: hidden; text-overflow: ellipsis; }
.cuenta-rol { padding: 2px 5px; background: var(--rojo); color: #fff; font-size: 9px; }
.nav-cuenta-logueada button {
  border: 0; background: transparent; color: var(--texto-suave);
  font: 600 10px var(--texto); text-transform: uppercase; cursor: pointer;
}
.nav-cuenta-logueada button:hover { color: var(--rojo); }

.nav-tema {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 11px;
  flex: none;
  border: 1px solid var(--linea);
  border-radius: 3px;
  background: var(--superficie);
  color: var(--texto-suave);
  cursor: pointer;
  font: 600 10px var(--label);
  letter-spacing: .05em;
  text-transform: uppercase;
  transition: background .15s ease, color .15s ease, border-color .15s ease;
}
.nav-tema:hover { background: var(--superficie-media); color: var(--tinta); border-color: var(--linea-fuerte); }
.nav-tema svg { width: 15px; height: 15px; flex: none; }
.nav-tema .ico-luna { fill: currentColor; }
.nav-tema .ico-sol { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
.help-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border: 1px solid currentColor;
  border-radius: 50%;
  font: 700 11px var(--label);
  line-height: 1;
}

main { width: 100%; padding: 0 clamp(16px, 3.2vw, 44px); max-width: 1440px; margin: 0 auto; }

/* ---------- Pie ---------- */
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: auto;
  padding: 26px clamp(16px, 3.2vw, 44px);
  background: var(--panel-oscuro);
  color: var(--panel-oscuro-texto);
  border-top: 3px solid var(--rojo);
  font: 500 10px var(--label);
  letter-spacing: .07em;
  text-transform: uppercase;
}
.footer-frase {
  color: #fff;
  font: 600 11px/1.5 var(--display);
  letter-spacing: .05em;
}
.footer-docs {
  border: 1px solid rgba(255, 255, 255, .4);
  border-radius: 3px;
  background: transparent;
  color: var(--panel-oscuro-texto);
  padding: 8px 12px;
  cursor: pointer;
  font: 600 9px var(--label);
  letter-spacing: .08em;
  text-transform: uppercase;
  transition: background .15s ease, border-color .15s ease;
}
.footer-docs:hover { background: var(--rojo); border-color: var(--rojo); }

.toast-stack {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 90;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.toast-logro {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 240px;
  padding: 12px 15px;
  background: var(--panel-oscuro);
  color: var(--panel-oscuro-texto);
  border: 1px solid var(--linea-fuerte);
  border-left: 4px solid var(--oro);
  border-radius: 4px;
  box-shadow: 4px 4px 0 rgba(26, 29, 26, .16);
  animation: toast-in .25s ease-out;
}
.toast-icon { color: var(--oro); font-size: 18px; }
.toast-logro div { display: flex; flex-direction: column; gap: 1px; }
.toast-logro small { color: var(--texto-suave); font: 500 9px var(--label); text-transform: uppercase; letter-spacing: .08em; }
.toast-logro strong { font: 600 14px var(--display); letter-spacing: .02em; text-transform: uppercase; }
@keyframes toast-in { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }

/* ---------- Celular ---------- */
.bottom-nav { display: none; }

@media (max-width: 1180px) {
  .status-label { display: none; }
}
@media (max-width: 980px) {
  .nav-link { padding: 0 10px; font-size: 11px; }
  .paso-chip { display: none; }
}
@media (max-width: 720px) {
  .nav-inner { flex-wrap: nowrap; gap: 10px; min-height: var(--header-h); padding: 0 14px; }
  .brand-logo { width: 38px; height: 38px; }
  .brand-type strong { font-size: 13px; }
  .nav-links { display: none; }
  .nav-der { gap: 6px; }
  .nav-status { min-height: 34px; padding: 0 9px; gap: 6px; }
  .status-num { font-size: 13px; }
  .status-label { display: none; }
  .nav-help { min-height: 34px; padding: 0 9px; }
  .nav-cuenta { min-height: 34px; padding: 0 9px; }
  .cuenta-alias { display: none; }
  .nav-tema { min-height: 34px; padding: 0 9px; }
  .tema-label { display: none; }
  .help-label { display: none; }
  .help-mark { width: 18px; height: 18px; }
  main { padding: 0 12px 10px; }
  footer {
    padding: 18px 14px calc(18px + 66px + env(safe-area-inset-bottom));
    justify-content: space-between;
    text-align: left;
    gap: 12px;
  }
  .footer-frase { font-size: 10px; }
  .toast-stack { left: 12px; right: 12px; bottom: calc(74px + env(safe-area-inset-bottom)); }
  .toast-logro { min-width: 0; width: 100%; }

  .bottom-nav {
    display: flex;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 70;
    background: var(--nav-fondo);
    border-top: 1px solid var(--linea);
    padding: 0 4px env(safe-area-inset-bottom);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .bottom-nav button {
    position: relative;
    flex: 1;
    min-height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border: 0;
    background: transparent;
    color: #7c7a70;
    cursor: pointer;
    font: 600 8.5px var(--label);
    letter-spacing: .07em;
    text-transform: uppercase;
  }
  .bottom-nav svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .bottom-nav button.on { color: var(--rojo); }
  .bottom-nav button.on::before {
    content: '';
    position: absolute;
    top: 0;
    left: 22%;
    right: 22%;
    height: 2px;
    background: var(--rojo);
  }
}

@media (max-width: 380px) {
  .nav-status { padding: 0 7px; }
  .status-num span { display: none; }
}
</style>
