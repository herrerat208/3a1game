// 3A1 — sube archivos y ejecuta SQL en InfinityFree usando htdocs/recibir.php.
// Uso: A1_UPLOAD_TOKEN=... node scripts/subir_helper.mjs info|upload|sql <archivo.sql>|verificar|borrar
// El helper es temporal: se sube por File Manager y se borra al final.
// Los PHP de api/ se publican en la raíz (donde el frontend los pide), salvo
// config.php, que conserva las credenciales del hosting.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = path.resolve(import.meta.dirname, '..')
const ARG_BASE = process.argv.find((a) => a.startsWith('--base='))
const BASE = ARG_BASE ? ARG_BASE.slice(7) : (process.env.A1_BASE || 'https://3a1.page.gd')
const TOKEN = process.env.A1_UPLOAD_TOKEN || ''
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const CHUNK = 256 * 1024
let cookie = null

async function obtenerCookie() {
  if (BASE.includes('127.0.0.1')) { cookie = 'local'; return cookie }
  const r = await fetch(`${BASE}/temporadas.php`, { headers: { 'User-Agent': UA } })
  const html = await r.text()
  const m = html.match(/toNumbers\("([0-9a-f]+)"\),b=toNumbers\("([0-9a-f]+)"\),c=toNumbers\("([0-9a-f]+)"\)/)
  if (!m) throw new Error('No apareció el desafío anti-bot')
  const [a, b, c] = m.slice(1).map((h) => Buffer.from(h, 'hex'))
  const d = crypto.createDecipheriv('aes-128-cbc', a, b)
  d.setAutoPadding(false)
  cookie = Buffer.concat([d.update(c), d.final()]).toString('hex')
  return cookie
}

async function req(accion, { params = {}, body = null } = {}) {
  if (!TOKEN) throw new Error('Falta A1_UPLOAD_TOKEN (el mismo token que pusiste en recibir.php)')
  const url = new URL(`${BASE}/recibir.php`)
  url.searchParams.set('token', TOKEN)
  url.searchParams.set('accion', accion)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const headers = { 'User-Agent': UA }
  if (!cookie) await obtenerCookie()
  headers.Cookie = `__test=${cookie}`
  const init = { method: body === null ? 'GET' : 'POST', headers }
  if (body !== null) {
    headers['Content-Type'] = 'application/octet-stream'
    init.body = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8')
  }
  const r = await fetch(url, init)
  const txt = await r.text()
  if (txt.includes('aes.js') && txt.includes('document.cookie')) {
    await obtenerCookie()
    return req(accion, { params, body })
  }
  return txt
}

function walk(dir, prefijo, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, e.name)
    const rel = prefijo ? `${prefijo}/${e.name}` : e.name
    if (e.isDirectory()) walk(ruta, rel, out)
    else if (e.isFile()) out.push([ruta, rel])
  }
}

function armarPayload() {
  const archivos = []
  walk(path.join(ROOT, 'dist/jugadores'), 'jugadores', archivos)
  walk(path.join(ROOT, 'dist/escudos'), 'escudos', archivos)
  // Visor separado: se publica en /visor/ y solo lee la API.
  walk(path.join(ROOT, 'visor'), 'visor', archivos)
  for (const nombre of ['index.html', 'favicon.png', 'favicon.svg', 'logo-3a1.webp']) {
    const p = path.join(ROOT, 'dist-plano', nombre)
    if (fs.existsSync(p)) archivos.push([p, nombre])
  }
  // API: en producción los endpoints están en la raíz, no en /api/.
  // Nunca incluir config.php (credenciales reales del hosting).
  for (const entrada of fs.readdirSync(path.join(ROOT, 'api'), { withFileTypes: true })) {
    if (!entrada.isFile() || !entrada.name.endsWith('.php')) continue
    if (['config.php', 'config.example.php', 'recibir.php'].includes(entrada.name)) continue
    archivos.push([path.join(ROOT, 'api', entrada.name), entrada.name])
  }
  const partes = []
  for (const [ruta, rel] of archivos) {
    const datos = fs.readFileSync(ruta)
    partes.push(Buffer.from(`${rel}\n${datos.length}\n`, 'utf8'), datos)
  }
  return { payload: Buffer.concat(partes), cantidad: archivos.length }
}

async function main() {
  const [cmd, arg] = process.argv.slice(2).filter((a) => !a.startsWith('--base='))
  if (!cmd) {
    console.log('Uso: A1_UPLOAD_TOKEN=... node scripts/subir_helper.mjs info|upload|sql <archivo>|verificar|borrar')
    process.exit(1)
  }
  if (cmd === 'info') {
    console.log(await req('info'))
  } else if (cmd === 'upload') {
    const { payload, cantidad } = armarPayload()
    console.log(`Payload: ${cantidad} archivos, ${(payload.length / 1048576).toFixed(1)} MB`)
    console.log((await req('reset')).trim())
    const total = Math.ceil(payload.length / CHUNK)
    for (let i = 0; i < total; i++) {
      const inicio = i * CHUNK
      const parte = payload.subarray(inicio, Math.min(inicio + CHUNK, payload.length))
      let res = (await req('chunk', { params: { idx: i }, body: parte })).trim()
      if (res.startsWith('ERROR')) {
        res = (await req('chunk', { params: { idx: i, force: 1 }, body: parte })).trim()
      }
      if (!res.startsWith('OK')) throw new Error(`Chunk ${i}: ${res}`)
      if (i % 10 === 0 || i === total - 1) console.log(`  ${i + 1}/${total}`)
    }
    console.log(await req('apply'))
    console.log(await req('verificar'))
  } else if (cmd === 'sql') {
    if (!arg) throw new Error('Falta el archivo SQL')
    const sql = fs.readFileSync(path.resolve(arg), 'utf8')
    console.log(`SQL: ${path.basename(arg)} (${sql.length} chars)`)
    console.log(await req('sql', { body: sql }))
  } else if (cmd === 'verificar') {
    console.log(await req('verificar'))
  } else if (cmd === 'borrar') {
    console.log((await req('borrar')).trim())
  } else {
    throw new Error(`Comando desconocido: ${cmd}`)
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
