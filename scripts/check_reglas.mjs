// Reglas de oro chequeables sin base de datos:
//   1. Cero hardcode de nombres de jugadores en src/.
//   2. Códigos de posición del frontend ⊆ códigos canónicos de api/_slots.php.
//   3. El sorteo filtra River por defecto (fail-safe).
//   4. Contraseñas de MySQL solo en api/conexion.php (nunca en src/).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const fallos = []
const leer = (p) => readFileSync(join(raiz, p), 'utf8')

const src = leer('src/components/DraftGame.vue') + leer('src/components/LigaSection.vue') +
  leer('src/components/MundialSection.vue') + leer('src/game/ligas.js')
if (/Armani|Maradona|Messi/i.test(src)) fallos.push('Hay nombres de jugadores hardcodeados en src/')

const slots = leer('api/_slots.php')
const posAPI = new Set([...slots.matchAll(/'([A-Z]+\d*)'\s*=>\s*'([A-Z]+)'/g)].map((m) => m[2]))
if (!posAPI.size) fallos.push('No se pudieron leer las posiciones de api/_slots.php')

const pitch = leer('src/game/pitch.js')
const posFront = new Set([...pitch.matchAll(/^\s+([A-Z]+)\d*:\s*\[/gm)].map((m) => m[1]))
for (const pos of posFront) {
  if (!posAPI.has(pos)) fallos.push(`Posición ${pos} del frontend no existe en _slots.php`)
}

const sorteo = leer('api/sorteo.php')
if (!/solo_river/.test(sorteo)) fallos.push('api/sorteo.php perdió el filtro solo_river (fail-safe)')

const todoSrc = ['src/components/DraftGame.vue', 'src/services/api.js', 'src/App.vue']
  .map(leer).join('\n')
if (/mysqld?_?(connect|i)\s*\(|DB_PASSWORD|db_password/.test(todoSrc)) {
  fallos.push('Hay credenciales de MySQL fuera de api/conexion.php')
}

if (fallos.length) {
  console.error('check:reglas FALLÓ')
  for (const f of fallos) console.error(`  · ${f}`)
  process.exit(1)
}
console.log(`check:reglas OK (${posAPI.size} posiciones canónicas, ${posFront.size} usadas en cancha)`)
