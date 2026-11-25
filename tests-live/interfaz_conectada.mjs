// Verificación en navegador (Chrome con --remote-debugging-port=9226).
//   node tests-live/interfaz_conectada.mjs
// Requiere: Apache+MySQL, API espejo, servidor WS, dist/ servido en 5175 y
// visor/ servido en 8080 (scripts/servir_static.mjs).
// Prueba: login por UI, visor separado, aviso WebSocket y ranking sin F5.
import assert from 'node:assert/strict'
import { WebSocket } from 'ws'

const CDP = 'http://127.0.0.1:9226'
const API = (process.env.API_BASE || 'http://localhost/3a1-api').replace(/\/$/, '')
const ORIGEN = process.env.ORIGEN_PRUEBA || 'http://localhost:5175'
const WS = process.env.A1_WS_URL || 'ws://localhost:8787/ws'
const VISOR_ORIGEN = process.env.VISOR_PRUEBA || 'http://localhost:8080'
const VISOR = `${VISOR_ORIGEN}/?api=${encodeURIComponent(API)}&ws=${encodeURIComponent(WS)}`
const ALIAS_JUGADOR = process.env.ALIAS_JUGADOR || 'Luna'
const ALIAS_ADMIN = process.env.ALIAS_ADMIN || 'Admin3a1'
const CLAVE_JUGADOR = process.env.CLAVE_JUGADOR || ''
const CLAVE_ADMIN = process.env.CLAVE_ADMIN || ''
if (!CLAVE_JUGADOR || !CLAVE_ADMIN) {
  throw new Error('Faltan CLAVE_JUGADOR y CLAVE_ADMIN: definilas antes de correr esta prueba')
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

async function abrirPagina(url) {
  const respuesta = await fetch(`${CDP}/json/new?url=${encodeURIComponent(url)}`, { method: 'PUT' })
  return respuesta.json()
}

function conectar(wsUrl) {
  const socket = new WebSocket(wsUrl)
  const pendientes = new Map()
  const eventos = []
  let id = 0
  socket.on('message', (raw) => {
    const m = JSON.parse(raw.toString())
    if (m.id && pendientes.has(m.id)) {
      const { res, rej } = pendientes.get(m.id)
      pendientes.delete(m.id)
      m.error ? rej(new Error(m.error.message)) : res(m.result)
    } else if (m.method === 'Runtime.exceptionThrown') {
      eventos.push(m.params.exceptionDetails.text)
    }
  })
  const listo = new Promise((res, rej) => { socket.once('open', res); socket.once('error', rej) })
  return {
    listo,
    cmd(method, params = {}) {
      return new Promise((res, rej) => {
        const n = ++id
        pendientes.set(n, { res, rej })
        socket.send(JSON.stringify({ id: n, method, params }))
      })
    },
    async iniciar() {
      await listo
      await this.cmd('Runtime.enable')
      await this.cmd('Page.enable')
    },
    async ir(url) {
      await this.cmd('Page.navigate', { url })
      await dormir(3500)
    },
    async eval(expr) {
      const r = await this.cmd('Runtime.evaluate', {
        expression: expr, awaitPromise: true, returnByValue: true
      })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
      return r.result?.value
    },
    eventos
  }
}

// Cliente API propio: simula "otra ventana" que guarda la partida.
function crearCliente() {
  const cookies = new Map()
  let csrf = ''
  return {
    async api(ruta, opciones = {}) {
      const res = await fetch(`${API}${ruta}`, {
        ...opciones,
        headers: { ...(opciones.headers || {}), Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
      })
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [par] = c.split(';'); const i = par.indexOf('=')
        if (i > 0) cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim())
      }
      let cuerpo = null
      try { cuerpo = await res.json() } catch { /* vacío */ }
      if (cuerpo?.csrfToken) csrf = cuerpo.csrfToken
      return { estado: res.status, cuerpo }
    },
    json(ruta, datos, metodo = 'POST') {
      return this.api(ruta, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify(datos)
      })
    }
  }
}

async function main() {
  const appTarget = await abrirPagina('about:blank')
  const visorTarget = await abrirPagina('about:blank')
  const app = conectar(appTarget.webSocketDebuggerUrl)
  const visor = conectar(visorTarget.webSocketDebuggerUrl)
  await Promise.all([app.iniciar(), visor.iniciar()])
  // El perfil de CDP conserva cookies entre corridas: arrancamos sin sesión.
  await app.cmd('Network.enable')
  await app.cmd('Network.clearBrowserCookies')

  await Promise.all([
    app.ir(`${ORIGEN}/?v=${Date.now()}`),
    visor.ir(`${VISOR}&v=${Date.now()}`)
  ])

  const ingreso = await app.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Ingresar')
    if (!b) return false
    b.click(); return true
  })()`)
  assert.equal(ingreso, true, 'debe existir el botón Ingresar')
  await dormir(500)

  const login = await app.eval(`(async () => {
    const poner = (s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })) }
    poner('#auth-alias', ${JSON.stringify(ALIAS_JUGADOR)}); poner('#auth-clave', ${JSON.stringify(CLAVE_JUGADOR)})
    document.querySelector('.auth-enviar').click()
    await new Promise(r => setTimeout(r, 900))
    return document.querySelector('.cuenta-alias')?.textContent?.trim() ?? null
  })()`)
  assert.equal(login, ALIAS_JUGADOR, 'la navbar debe mostrar el alias de la sesión')
  console.log('✓ Login por interfaz: la identidad viene de /me.php')

  const estadoVisor = await visor.eval(`document.querySelector('#estado')?.textContent`)
  assert.equal(estadoVisor, 'En vivo', 'el visor debe estar conectado al WebSocket')
  console.log('✓ Visor conectado al tubo de avisos')

  // Otra ventana guarda una partida real: PHP avisa por WS y el visor vuelve a consultar.
  const cliente = crearCliente()
  await cliente.api('/csrf.php')
  let r = await cliente.json('/login.php', { alias: ALIAS_JUGADOR, password: CLAVE_JUGADOR })
  assert.equal(r.estado, 200)
  const forms = await cliente.api('/formaciones.php')
  const nombre = Object.keys(forms.cuerpo.todas ?? forms.cuerpo.formaciones)[0]
  r = await cliente.json('/partidas.php', { nombre_equipo: 'River Plate', formacion: nombre, estilo: 'equilibrado', modo: 'copa', formato: 'copa' })
  const partidaId = Number(r.cuerpo.id)
  for (const ronda of ['Ronda 1', 'Ronda 2', 'Octavos', 'Cuartos', 'Semifinal', 'Final', 'Final revancha']) {
    await cliente.json('/guardar_resultado.php', {
      partida_id: partidaId, ronda, rival: 'Rival CDP', goles_favor: 2, goles_contra: 0, avanzo: true
    })
  }
  r = await cliente.json('/guardar_ranking.php', { juegoId: 3, partidaId })
  assert.equal(r.estado, 201)
  await dormir(1500)

  const filasVisor = await visor.eval(`[...document.querySelectorAll('#ranking li')].map(li => li.innerText.replace(/\\s+/g, ' ').trim())`)
  assert.ok(filasVisor.some((f) => f.toLowerCase().includes(ALIAS_JUGADOR.toLowerCase())), `el visor debe mostrar a ${ALIAS_JUGADOR} sin recargar: ${JSON.stringify(filasVisor)}`)
  console.log(`✓ Visor actualizado solo con el aviso: ${filasVisor[0]}`)

  const panel = await app.eval(`(async () => {
    const b = [...document.querySelectorAll('.nav-link')].find(x => x.textContent.includes('Tus drafts'))
    b.click(); await new Promise(r => setTimeout(r, 500))
    const tab = [...document.querySelectorAll('.subtab')].find(x => x.textContent.includes('Ranking'))
    tab.click(); await new Promise(r => setTimeout(r, 900))
    const textos = [...document.querySelectorAll('.rc-lista li')].map(li => li.innerText.replace(/\\s+/g, ' ').trim())
    return { textos, adminButtons: document.querySelectorAll('.rc-borrar').length }
  })()`)
  assert.ok(panel.textos.some((t) => t.toLowerCase().includes(ALIAS_JUGADOR.toLowerCase())), 'el panel de ranking debe mostrar el resultado')
  assert.equal(panel.adminButtons, 0, 'un jugador no debe ver botones de administrador')
  console.log('✓ Panel Ranking del juego y permisos de jugador')

  // Un visor con otro juego no debe recargar por avisos del juego 3.
  await visor.eval(`(() => { const s = document.querySelector('#juego'); s.value = '4'; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await dormir(700)
  const textoVacio = await visor.eval(`document.querySelector('#mensaje')?.textContent`)
  assert.ok(textoVacio?.includes('Todavía no hay resultados'), 'juego 4 debe mostrar []')
  await cliente.json('/guardar_ranking.php', { juegoId: 3, partidaId })
  await dormir(1000)
  const sigueVacio = await visor.eval(`document.querySelector('#mensaje')?.textContent`)
  assert.ok(sigueVacio?.includes('Todavía no hay resultados'), 'un aviso del juego 3 no debe tocar el visor del juego 4')
  console.log('✓ El filtro por juegoId evita mezclar rankings')

  const errores = [...app.eventos, ...visor.eventos]
  assert.deepEqual(errores, [], `no debe haber errores JS: ${JSON.stringify(errores)}`)
  console.log('✓ Sin errores de JavaScript')

  // Limpieza: el admin retira la partida de prueba.
  await cliente.json('/logout.php', {})
  await cliente.api('/csrf.php')
  r = await cliente.json('/login.php', { alias: ALIAS_ADMIN, password: CLAVE_ADMIN })
  assert.equal(r.estado, 200)
  r = await cliente.json(`/partidas.php?id=${partidaId}`, {}, 'DELETE')
  assert.equal(r.estado, 200)
  console.log('✓ Limpieza: admin retiró el resultado de prueba')

  app.cmd('Page.close'); visor.cmd('Page.close')
  console.log('\nInterfaz conectada: todas las comprobaciones pasaron.')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
