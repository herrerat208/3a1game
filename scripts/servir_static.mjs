// Servidor estático mínimo (sin dependencias) para dist/ o visor/.
//   node scripts/servir_static.mjs dist 5175
//   node scripts/servir_static.mjs visor 8080
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAIZ = path.resolve(RAIZ_REPO, process.argv[2] || 'visor')
const PUERTO = Number(process.argv[3] || 8080)
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon'
}

http.createServer(async (req, res) => {
  const nombre = decodeURIComponent((req.url || '/').split('?')[0])
  const relativo = nombre === '/' ? 'index.html' : nombre.replace(/^\/+/, '')
  let archivo = path.resolve(RAIZ, relativo)
  if (!archivo.startsWith(RAIZ)) {
    res.writeHead(403); res.end('Prohibido'); return
  }
  try {
    const contenido = await readFile(archivo)
    const ext = path.extname(archivo)
    res.writeHead(200, {
      'Content-Type': `${TIPOS[ext] || 'application/octet-stream'}${ext === '.svg' ? '' : '; charset=utf-8'}`,
      'Cache-Control': 'no-store'
    })
    res.end(contenido)
  } catch {
    // SPA: una ruta desconocida vuelve al index.
    if (!path.extname(relativo)) {
      try {
        const html = await readFile(path.join(RAIZ, 'index.html'))
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(html)
        return
      } catch { /* sigue el 404 */ }
    }
    res.writeHead(404); res.end('No encontrado')
  }
// Sin host explícito: escucha en IPv6 e IPv4, así `localhost` funciona igual
// que `127.0.0.1` y la cookie de la API comparte sitio con la interfaz.
}).listen(PUERTO, () => {
  console.log(`3A1 sirve ${path.relative(RAIZ_REPO, RAIZ)} en http://localhost:${PUERTO}/`)
})
