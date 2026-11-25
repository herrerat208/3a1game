// En local usa XAMPP; en Vercel se define VITE_API_URL con la URL pública de la API.
const API_URL = (import.meta.env?.VITE_API_URL || (import.meta.env?.PROD ? '' : 'http://localhost/3a1-api')).replace(/\/$/, '')
const SIN_API = Boolean(import.meta.env?.PROD && !import.meta.env?.VITE_API_URL)

// Sin límite de tiempo, una petición colgada deja el botón en "Simulando…"
// para siempre (pasó en Premier con el hosting compartido). Si tarda demasiado
// se cancela, se muestra el error y se vuelve a habilitar la interfaz.
const TIEMPO_ESPERA_MS = 20000

// La sesión vive en el servidor: el navegador conserva solo la cookie y este
// token CSRF, que se renueva con cada respuesta que lo incluye.
let csrfToken = ''

async function pedir(ruta, opciones = {}) {
  if (SIN_API) {
    throw new Error('El servicio de datos no está configurado. Reintentá más tarde.')
  }
  const control = new AbortController()
  const temporizador = setTimeout(() => control.abort(), TIEMPO_ESPERA_MS)
  let respuesta
  try {
    const metodo = (opciones.method || 'GET').toUpperCase()
    const cabeceras = { ...(opciones.headers || {}) }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(metodo) && csrfToken) {
      cabeceras['X-CSRF-Token'] = csrfToken
    }
    respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: cabeceras,
      credentials: 'include',
      signal: control.signal
    })
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error('El servidor tardó demasiado en responder. Reintentá la simulación.')
    }
    throw new Error('No se pudo conectar con el servicio de datos. Reintentá en unos instantes.')
  } finally {
    clearTimeout(temporizador)
  }
  let datos
  try {
    datos = await respuesta.json()
  } catch {
    throw new Error(respuesta.ok ? 'Respuesta inválida del servidor' : `Error del servidor (HTTP ${respuesta.status})`)
  }
  if (datos?.csrfToken) csrfToken = datos.csrfToken
  if (!respuesta.ok) {
    const error = new Error(datos?.error ?? `Error del servidor (HTTP ${respuesta.status})`)
    error.status = respuesta.status
    throw error
  }
  return datos
}

// Catálogos estáticos durante la sesión. Se piden una vez y se comparten entre
// DraftGame, CanchaRival, RivalesPanel, HistorialPanel y las vistas de torneo.
function cacheCatalogo(cargar) {
  let promesa = null
  return () => {
    if (!promesa) {
      promesa = cargar().catch((error) => {
        promesa = null
        throw error
      })
    }
    return promesa
  }
}

export const obtenerFormaciones = cacheCatalogo(() => pedir('/formaciones.php'))

// Nombres reales de árbitros y periodistas (solo narrativa). Se piden una vez:
// son datos de catálogo, no cambian durante la partida. Si falla, se limpia la
// caché para que un reintento vuelva a consultar.
let cachePrensa = null
export function obtenerPrensa() {
  if (!cachePrensa) {
    cachePrensa = pedir('/prensa.php').catch((error) => {
      cachePrensa = null
      throw error
    })
  }
  return cachePrensa
}

export function obtenerPartida(partidaId) {
  return pedir(`/partida.php?partida_id=${partidaId}`)
}

export function obtenerHistorial(limite = null) {
  const q = limite ? `?limite=${encodeURIComponent(limite)}` : ''
  return pedir(`/historial.php${q}`)
}

export const obtenerTemporadas = cacheCatalogo(() => pedir('/temporadas.php'))

export function obtenerSorteo(partidaId = null, soloRiver = true, semilla = '', paso = null) {
  const params = new URLSearchParams()
  if (partidaId) params.set('partida_id', partidaId)
  if (soloRiver) params.set('solo_river', '1')
  if (semilla) params.set('semilla', semilla)
  if (paso !== null && paso !== undefined) params.set('paso', paso)
  const q = params.toString() ? `?${params.toString()}` : ''
  return pedir(`/sorteo.php${q}`)
}

export function obtenerJugadores(temporadaId, posicion = '') {
  const pos = encodeURIComponent(posicion)
  return pedir(`/jugadores.php?temporada_id=${temporadaId}&posicion=${pos}`)
}

export function crearPartida(nombreEquipo, formacion, estilo = 'equilibrado', modo = 'copa', formato = 'copa') {
  return pedir('/partidas.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre_equipo: nombreEquipo,
      formacion,
      estilo,
      modo,
      formato
    })
  })
}

export function guardarJugador(partidaId, temporadaJugadorId, slot) {
  return pedir('/guardar_jugador.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partida_id: partidaId,
      temporada_jugador_id: temporadaJugadorId,
      slot
    })
  })
}

export function cargarEquipo(partidaId) {
  return pedir(`/equipo.php?partida_id=${partidaId}`)
}

export function setearDorsal(partidaId, slot, dorsal) {
  return pedir('/setear_dorsal.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partida_id: partidaId, slot, dorsal })
  })
}

// Asigna todos los dorsales de una sola vez (transacción en el servidor).
// El modo "xi" completa solo el once; "todo" incluye el banco.
export function asignarDorsales(partidaId, modo = 'xi') {
  return pedir('/asignar_dorsales.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partida_id: partidaId, modo })
  })
}

export async function obtenerRivales() {
  const todas = await obtenerTemporadas()
  return todas.filter((t) => !t.es_river)
}

export function quitarJugador(partidaId, slot) {
  return pedir('/quitar_jugador.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partida_id: partidaId, slot })
  })
}

export function intercambiarJugadores(partidaId, slotA, slotB) {
  return pedir('/intercambiar.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partida_id: partidaId, slot_a: slotA, slot_b: slotB })
  })
}

export function guardarResultado(partidaId, ronda, rival, golesFavor, golesContra, avanzo = true, detalle = null, amistoso = false) {
  return pedir('/guardar_resultado.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partida_id: partidaId,
      ronda,
      rival,
      goles_favor: golesFavor,
      goles_contra: golesContra,
      avanzo,
      detalle: detalle ? JSON.stringify(detalle) : null,
      amistoso
    })
  })
}

export function obtenerResultados(partidaId) {
  return pedir(`/resultados.php?partida_id=${partidaId}`)
}

export function obtenerEstadisticas() {
  return pedir('/estadisticas.php')
}

// Sin parámetro sigue el ranking histórico (palmarés). Con juegoId usa el
// contrato del sistema conectado: [{usuarioId, alias, puntos}].
export function obtenerRanking(juegoId = null) {
  return pedir(juegoId ? `/ranking.php?juegoId=${encodeURIComponent(juegoId)}` : '/ranking.php')
}

export function desbloquearLogro(partidaId, codigo) {
  return pedir('/logros.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partida_id: partidaId, codigo })
  })
}

export function obtenerLogros(partidaId) {
  // Sin partida activa, logros.php devuelve los conteos globales por código.
  return pedir(partidaId ? `/logros.php?partida_id=${partidaId}` : '/logros.php')
}

export function crearTorneo(partidaId, formato, participantes, calendario) {
  return pedir('/torneo.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partida_id: partidaId,
      formato,
      participantes,
      calendario
    })
  })
}

export function obtenerTorneo({ partidaId = null, torneoId = null } = {}) {
  const q = torneoId ? `torneo_id=${torneoId}` : `partida_id=${partidaId}`
  return pedir(`/torneo.php?${q}`)
}

export function agregarCalendario(torneoId, calendario) {
  return pedir('/torneo.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ torneo_id: torneoId, calendario })
  })
}

export function actualizarTorneo(torneoId, campos) {
  return pedir('/torneo.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ torneo_id: torneoId, ...campos })
  })
}

export function obtenerFecha(torneoId, fechaN = null, fase = '') {
  const params = new URLSearchParams({ torneo_id: torneoId })
  if (fechaN !== null) params.set('fecha_n', fechaN)
  if (fase) params.set('fase', fase)
  return pedir(`/calendario.php?${params.toString()}`)
}

export function jugarPartidoCalendario(calendarioId, gf, gc, detalle = null) {
  return pedir('/calendario.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      calendario_id: calendarioId,
      gf,
      gc,
      detalle: detalle ? JSON.stringify(detalle) : null
    })
  })
}

export function obtenerTabla(torneoId, zona = '') {
  const q = zona ? `&zona=${encodeURIComponent(zona)}` : ''
  return pedir(`/tabla.php?torneo_id=${torneoId}${q}`)
}

export function obtenerSanciones(torneoId) {
  return pedir(`/sanciones.php?torneo_id=${torneoId}`)
}

export function sancionar(torneoId, temporadaJugadorId, { amarillas = 0, roja = false, suspendidoHasta = 0 } = {}) {
  return pedir('/sanciones.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      torneo_id: torneoId,
      temporada_jugador_id: temporadaJugadorId,
      amarillas,
      roja,
      suspendido_hasta_fecha: suspendidoHasta
    })
  })
}

// ---- Sistema conectado: usuarios, sesión y ranking compartido ----

export function obtenerCsrf() {
  return pedir('/csrf.php')
}

export function obtenerYo() {
  return pedir('/me.php').catch((error) => {
    if (error.status === 401) return null
    throw error
  })
}

function jsonPost(ruta, datos) {
  return pedir(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  })
}

export function iniciarSesion(alias, password) {
  return jsonPost('/login.php', { alias, password })
}

export function registrarUsuario(alias, password) {
  return jsonPost('/registro.php', { alias, password })
}

export function cerrarSesion() {
  return jsonPost('/logout.php', {})
}

// El navegador NO manda usuarioId ni puntos de confianza: solo la partida.
export function guardarEnRanking(partidaId, juegoId = 3, duracionSegundos = null) {
  return jsonPost('/guardar_ranking.php', {
    partidaId, juegoId, duracionSegundos
  })
}

// Solo el panel de administración pide el id interno de cada partida.
export function obtenerRankingAdmin(juegoId = 3) {
  return pedir(`/ranking.php?juegoId=${encodeURIComponent(juegoId)}&admin=1`)
}

export function borrarResultado(partidaId) {
  return pedir(`/partidas.php?id=${encodeURIComponent(partidaId)}`, { method: 'DELETE' })
}
