// Visor separado: solo habla con la API. No conoce tablas ni credenciales.
// Contrato: GET /ranking.php?juegoId=3 -> [{usuarioId, alias, puntos}] | []
// El WebSocket SOLAMENTE avisa; los datos siempre se traen por HTTP.
const params = new URLSearchParams(location.search)
const esProduccion = /^3a1\.page\.gd$/.test(location.hostname)
const API_URL = (params.get('api') || (esProduccion ? location.origin : 'http://localhost/3a1-api')).replace(/\/$/, '')
const WS_URL = params.get('ws') || (esProduccion
  ? `wss://${location.host}/ws`
  : 'ws://localhost:8787/ws')

const selector = document.getElementById('juego')
const boton = document.getElementById('actualizar')
const estado = document.getElementById('estado')
const lista = document.getElementById('ranking')
const mensaje = document.getElementById('mensaje')
document.getElementById('api-base').textContent = API_URL
document.getElementById('ws-base').textContent = WS_URL

let juegoId = Number(selector.value) || 3
if (params.has('juego')) {
  const pedido = String(params.get('juego'))
  if ([...selector.options].some((o) => o.value === pedido)) selector.value = pedido
  juegoId = Number(selector.value)
}

function ponerEstado(texto, clase = '') {
  estado.textContent = texto
  estado.className = `estado ${clase}`.trim()
}

function ponerMensaje(texto) {
  mensaje.textContent = texto
  mensaje.hidden = !texto
}

async function consultarRanking(juego) {
  const respuesta = await fetch(`${API_URL}/ranking.php?juegoId=${encodeURIComponent(juego)}`, {
    credentials: 'include',
    cache: 'no-store'
  })
  let datos = null
  try { datos = await respuesta.json() } catch { /* cuerpo no JSON */ }
  if (!respuesta.ok) {
    const error = new Error(datos?.error ?? `Error del servidor (HTTP ${respuesta.status})`)
    error.status = respuesta.status
    throw error
  }
  if (!Array.isArray(datos)) throw new Error('Formato de ranking inesperado')
  return datos
}

function dibujar(filas) {
  lista.replaceChildren()
  if (!filas.length) {
    ponerMensaje('Todavía no hay resultados guardados para este juego.')
    return
  }
  ponerMensaje('')
  filas.forEach((fila, i) => {
    const li = document.createElement('li')
    const puesto = document.createElement('span')
    puesto.className = 'puesto'
    puesto.textContent = String(i + 1).padStart(2, '0')
    const alias = document.createElement('span')
    alias.className = 'alias'
    alias.textContent = fila.alias ?? '—'
    const puntos = document.createElement('span')
    puntos.className = 'puntos'
    puntos.textContent = Number(fila.puntos ?? 0).toLocaleString('es-AR')
    li.append(puesto, alias, puntos)
    lista.append(li)
  })
}

async function cargar() {
  ponerEstado('Actualizando…', 'espera')
  try {
    const filas = await consultarRanking(juegoId)
    dibujar(filas)
    ponerEstado(socket?.readyState === WebSocket.OPEN ? 'En vivo' : 'Sin avisos en vivo', socket?.readyState === WebSocket.OPEN ? '' : 'espera')
  } catch (error) {
    lista.replaceChildren()
    if (error.status === 404) ponerMensaje('Ese juego no existe. Elegí otro.')
    else ponerMensaje(`No se pudo cargar el ranking: ${error.message}`)
    ponerEstado('Error', 'error')
  }
}

let socket = null
let intento = 0
function conectar() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return
  socket = new WebSocket(WS_URL)
  socket.addEventListener('open', () => {
    intento = 0
    cargar() // al reconectar pueden haberse perdido avisos
  })
  socket.addEventListener('message', (evento) => {
    let aviso
    try { aviso = JSON.parse(evento.data) } catch { return }
    if (aviso?.tipo === 'rankingActualizado' && Number(aviso.juegoId) === juegoId) cargar()
  })
  socket.addEventListener('close', () => {
    socket = null
    intento = Math.min(intento + 1, 5)
    ponerEstado('Reconectando…', 'espera')
    setTimeout(conectar, Math.min(1000 * 2 ** (intento - 1), 10000))
  })
  socket.addEventListener('error', () => socket?.close())
}

selector.addEventListener('change', () => {
  juegoId = Number(selector.value)
  cargar()
})
boton.addEventListener('click', cargar)
window.addEventListener('beforeunload', () => {
  const abierta = socket
  socket = null
  abierta?.close()
})

ponerEstado('Cargando…', 'espera')
cargar()
conectar()
