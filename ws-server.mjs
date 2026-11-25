// 3A1 — Tubo de avisos en tiempo real.
// No es Socket.IO: el navegador usa WebSocket nativo y acá habla la librería
// `ws`. La API sigue siendo PHP + MySQL; este proceso solo reparte avisos.
//   A1_WS_SECRET=... node ws-server.mjs
import http from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'

const PUERTO = Number(process.env.A1_WS_PORT || 8787)
const SECRETO = process.env.A1_WS_SECRET || ''
if (!SECRETO) throw new Error('Falta A1_WS_SECRET: definilo antes de arrancar el servidor WS')
const ORIGENES = new Set((process.env.A1_WS_ORIGINES || [
  'http://localhost:8080', 'http://[::1]:8080', 'http://127.0.0.1:8080',
  'http://localhost:5174', 'http://[::1]:5174', 'http://127.0.0.1:5174',
  'http://localhost:5175', 'http://[::1]:5175', 'http://127.0.0.1:5175',
  'http://localhost:5176', 'http://[::1]:5176', 'http://127.0.0.1:5176',
  'https://3a1.page.gd'
].join(',')).split(',').map((s) => s.trim()))

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Ws-Secret')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
}

let totalAvisos = 0
let ultimoAviso = null

const servidor = http.createServer((req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200)
    res.end(JSON.stringify({
      ok: true,
      conexiones: [...wss.clients].filter((c) => c.readyState === WebSocket.OPEN).length,
      totalAvisos,
      ultimoAviso
    }))
    return
  }

  if (req.method === 'POST' && (req.url === '/broadcast' || req.url === '/broadcast/')) {
    if ((req.headers['x-ws-secret'] || '') !== SECRETO) {
      res.writeHead(403)
      res.end(JSON.stringify({ error: 'Secreto inválido' }))
      return
    }
    let cuerpo = ''
    req.on('data', (trozo) => {
      cuerpo += trozo
      if (cuerpo.length > 4096) req.destroy()
    })
    req.on('end', () => {
      let datos
      try { datos = JSON.parse(cuerpo || '{}') } catch {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'JSON inválido' }))
        return
      }
      const juegoId = Number(datos.juegoId)
      if (!Number.isInteger(juegoId) || juegoId <= 0) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'juegoId inválido' }))
        return
      }
      const aviso = JSON.stringify({ tipo: 'rankingActualizado', juegoId })
      totalAvisos++
      ultimoAviso = { juegoId }
      let enviados = 0
      for (const cliente of wss.clients) {
        if (cliente.readyState === WebSocket.OPEN) {
          cliente.send(aviso)
          enviados++
        }
      }
      res.writeHead(200)
      res.end(JSON.stringify({ ok: true, enviados }))
    })
    return
  }

  res.writeHead(404)
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }))
})

const wss = new WebSocketServer({ server: servidor, path: '/ws' })
wss.on('connection', (socket, req) => {
  const origen = req.headers.origin || ''
  if (origen && !ORIGENES.has(origen)) {
    socket.close(1008, 'Origen no permitido')
    return
  }
  socket.on('error', () => { /* un cliente corto no derriba el servidor */ })
})

// Sin host: IPv4 e IPv6, para que `localhost` y `127.0.0.1` funcionen igual.
servidor.listen(PUERTO, () => {
  console.log(`3A1 WS escuchando en ws://localhost:${PUERTO}/ws`)
})
