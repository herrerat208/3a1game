// Prueba del tubo de avisos: dos clientes conectados reciben el mismo aviso.
//   node tests-live/websocket.mjs
import assert from 'node:assert/strict'
import { WebSocket } from 'ws'

const WS = process.env.A1_WS_URL || 'ws://127.0.0.1:8787/ws'
const HTTP = WS.replace(/^ws/, 'http').replace(/\/ws$/, '')
const SECRETO = process.env.A1_WS_SECRET || ''
if (!SECRETO) throw new Error('Falta A1_WS_SECRET: definilo antes de correr esta prueba')

async function abrir() {
  const socket = new WebSocket(WS, { origin: 'http://localhost:8080' })
  await new Promise((res, rej) => {
    socket.once('open', res)
    socket.once('error', rej)
  })
  return socket
}

function esperarMensaje(socket) {
  return new Promise((res) => socket.once('message', (d) => res(JSON.parse(d.toString()))))
}

const salud = await fetch(`${HTTP}/health`).then((r) => r.json())
assert.equal(salud.ok, true, 'el servicio debe estar arriba')

const a = await abrir()
const b = await abrir()
const esperaA = esperarMensaje(a)
const esperaB = esperarMensaje(b)

const sinSecreto = await fetch(`${HTTP}/broadcast`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ juegoId: 3 })
})
assert.equal(sinSecreto.status, 403, 'sin secreto no se puede avisar')

const aviso = await fetch(`${HTTP}/broadcast`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Ws-Secret': SECRETO },
  body: JSON.stringify({ juegoId: 3 })
})
assert.equal(aviso.status, 200)
assert.deepEqual(await esperaA, { tipo: 'rankingActualizado', juegoId: 3 })
assert.deepEqual(await esperaB, { tipo: 'rankingActualizado', juegoId: 3 })
console.log('✓ Dos visores reciben rankingActualizado con el mismo juegoId')

a.close()
b.close()
