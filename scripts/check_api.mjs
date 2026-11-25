// Verifica que todo endpoint usado por el frontend exista en api/ y que nadie
// llame a fetch() fuera de services/api.js (regla de oro del repo).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const fallos = []
const api = readFileSync(join(raiz, 'src/services/api.js'), 'utf8')
const rutas = [...new Set([...api.matchAll(/pedir\(\s*[`'\"]\/?([a-z_]+\.php)/g)].map((m) => m[1]))]

if (!rutas.length) fallos.push('No se detectaron rutas en services/api.js (¿cambió la forma de pedir?)')
for (const ruta of rutas) {
  if (!existsSync(join(raiz, 'api', ruta))) fallos.push(`Falta api/${ruta} (la usa services/api.js)`)
}

function* archivos(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) yield* archivos(p)
    else if (/\.(js|vue)$/.test(entry)) yield p
  }
}
const src = join(raiz, 'src')
for (const archivo of archivos(src)) {
  if (archivo.endsWith('services/api.js')) continue
  const texto = readFileSync(archivo, 'utf8')
  if (/\bfetch\s*\(/.test(texto)) fallos.push(`fetch() fuera de services/api.js: ${relative(raiz, archivo)}`)
  if (/localhost\/3a1-api|trycloudflare\.com/.test(texto)) {
    fallos.push(`URL de backend hardcodeada: ${relative(raiz, archivo)}`)
  }
}

if (fallos.length) {
  console.error('check:api FALLÓ')
  for (const f of fallos) console.error(`  · ${f}`)
  process.exit(1)
}
console.log(`check:api OK (${rutas.length} endpoints, fetch centralizado)`)
