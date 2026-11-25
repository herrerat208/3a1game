// Genera src/version.js en cada build. El footer lo muestra para detectar caché
// vieja en el navegador (antes era un número manual que alguien olvidaba subir).
import { writeFileSync } from 'node:fs'

const stamp = `${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`
const destino = new URL('../src/version.js', import.meta.url)
writeFileSync(destino, `// Generado por scripts/version.mjs. No editar a mano.\nexport const BUILD_STAMP = ${JSON.stringify(stamp)}\n`, 'utf8')
console.log(`build stamp: ${stamp}`)
