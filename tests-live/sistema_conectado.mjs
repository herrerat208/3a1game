// Prueba en vivo del sistema conectado. Requiere Apache + MySQL con la
// migración aplicada y el espejo api/ -> htdocs/3a1-api actualizado.
//   node tests-live/sistema_conectado.mjs
//   API_BASE=http://localhost/3a1-api node tests-live/sistema_conectado.mjs
import assert from 'node:assert/strict'

const BASE = (process.env.API_BASE || 'http://localhost/3a1-api').replace(/\/$/, '')
const CLAVE_JUGADOR = process.env.CLAVE_JUGADOR || ''
const CLAVE_ADMIN = process.env.CLAVE_ADMIN || ''
if (!CLAVE_JUGADOR || !CLAVE_ADMIN) {
  throw new Error('Faltan CLAVE_JUGADOR y CLAVE_ADMIN: definilas antes de correr esta prueba')
}

function crearCliente() {
  const cookies = new Map()
  let csrf = ''
  const guardarCookies = (res) => {
    const crudos = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : [])
    for (const c of crudos) {
      const [par] = c.split(';')
      const i = par.indexOf('=')
      if (i > 0) cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim())
    }
  }
  return {
    async api(ruta, opciones = {}) {
      const res = await fetch(`${BASE}${ruta}`, {
        ...opciones,
        headers: {
          ...(opciones.headers || {}),
          Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ')
        }
      })
      guardarCookies(res)
      let cuerpo = null
      try { cuerpo = await res.json() } catch { /* respuesta vacía */ }
      if (cuerpo?.csrfToken) csrf = cuerpo.csrfToken
      return { estado: res.status, cuerpo }
    },
    token() { return csrf }
  }
}

async function json(cliente, ruta, datos, metodo = 'POST') {
  return cliente.api(ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cliente.token() },
    body: JSON.stringify(datos)
  })
}

const jugador = crearCliente()
const admin = crearCliente()

// 1. Token y sesión vacía.
let r = await jugador.api('/csrf.php')
assert.equal(r.estado, 200, 'csrf.php debe responder 200')
assert.ok(r.cuerpo?.csrfToken, 'debe devolver token CSRF')
r = await jugador.api('/me.php')
assert.equal(r.estado, 401, 'me.php sin sesión debe ser 401')
console.log('✓ CSRF y /me sin sesión')

// 2. Credenciales incorrectas no crean sesión.
r = await json(jugador, '/login.php', { alias: 'Luna', password: 'incorrecta' })
assert.equal(r.estado, 401, 'login inválido debe ser 401')
console.log('✓ Login con contraseña incorrecta rechazado')

// 3. Jugador ingresa; el alias y el rol vienen del servidor.
r = await json(jugador, '/login.php', { alias: 'Luna', password: CLAVE_JUGADOR })
assert.equal(r.estado, 200, `login de jugador falló: ${JSON.stringify(r.cuerpo)}`)
assert.equal(r.cuerpo.rol, 'jugador')
r = await jugador.api('/me.php')
assert.equal(r.estado, 200)
assert.equal(r.cuerpo.alias, 'Luna')
assert.ok(!('password_hash' in r.cuerpo), '/me no debe filtrar el hash')
console.log('✓ Sesión de jugador y /me sin datos privados')

// 4. Ranking: arreglo vacío para juegos sin resultados, 404 para id inexistente.
r = await jugador.api('/ranking.php?juegoId=4')
assert.equal(r.estado, 200)
assert.ok(Array.isArray(r.cuerpo), 'el ranking siempre debe ser un arreglo')
r = await jugador.api('/ranking.php?juegoId=9999')
assert.equal(r.estado, 404, 'un juego inexistente debe dar 404')
console.log('✓ Ranking: [] y 404 son casos distintos')

// 5. Sin sesión no se puede guardar; con sesión pero sin CSRF tampoco.
const anonimo = crearCliente()
r = await json(anonimo, '/guardar_ranking.php', { juegoId: 3, partidaId: 1 })
assert.equal(r.estado, 401, 'guardar sin sesión debe ser 401')
r = await jugador.api('/guardar_ranking.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ juegoId: 3, partidaId: 1 })
})
assert.equal(r.estado, 403, 'guardar sin CSRF debe ser 403')
console.log('✓ Guardado protegido: 401 sin sesión, 403 sin CSRF')

// 6. Partida real terminada (7 Triunfos, valla invicta) y guardado.
const formaciones = await jugador.api('/formaciones.php')
assert.equal(formaciones.estado, 200)
const nombres = Object.keys(formaciones.cuerpo?.todas ?? formaciones.cuerpo?.formaciones ?? {})
assert.ok(nombres.length, 'debe haber formaciones elegibles')
r = await json(jugador, '/partidas.php', {
  nombre_equipo: 'River Plate', formacion: nombres[0], estilo: 'equilibrado',
  modo: 'copa', formato: 'copa'
})
assert.equal(r.estado, 200, `crear partida falló: ${JSON.stringify(r.cuerpo)}`)
const partidaId = Number(r.cuerpo.id)
for (const ronda of ['Ronda 1', 'Ronda 2', 'Octavos', 'Cuartos', 'Semifinal', 'Final', 'Final revancha']) {
  await json(jugador, '/guardar_resultado.php', {
    partida_id: partidaId, ronda, rival: 'Rival de prueba',
    goles_favor: 2, goles_contra: 0, avanzo: true
  })
}
r = await json(jugador, '/guardar_ranking.php', {
  juegoId: 3, partidaId, puntos: 999999, duracionSegundos: 45
})
assert.equal(r.estado, 201, `guardar ranking falló: ${JSON.stringify(r.cuerpo)}`)
assert.equal(r.cuerpo.usuarioId, 1, 'la identidad debe salir de la sesión')
assert.ok(r.cuerpo.puntos <= 2000, 'el servidor no debe creer el puntaje del navegador')
assert.ok(r.cuerpo.puntos > 900, 'el puntaje debe reflejar el 7A0 real')
const puntosGuardados = r.cuerpo.puntos
console.log(`✓ Guardado: 201 con ${puntosGuardados} puntos calculados por el servidor`)

// 7. El ranking compartido devuelve el contrato acordado.
r = await jugador.api('/ranking.php?juegoId=3')
assert.equal(r.estado, 200)
assert.ok(r.cuerpo.length >= 1, 'el ranking debe mostrar el resultado guardado')
const fila = r.cuerpo.find((f) => f.usuarioId === 1)
assert.ok(fila, 'debe aparecer Luna')
assert.deepEqual(Object.keys(fila).sort(), ['alias', 'puntos', 'usuarioId'])
console.log('✓ Ranking con {usuarioId, alias, puntos}')

// 8. El administrador puede retirar; el jugador no.
await admin.api('/csrf.php')
r = await json(admin, '/login.php', { alias: 'Admin3a1', password: CLAVE_ADMIN })
assert.equal(r.estado, 200, `login admin falló: ${JSON.stringify(r.cuerpo)}`)
r = await json(jugador, `/partidas.php?id=${partidaId}`, {}, 'DELETE')
assert.equal(r.estado, 403, 'un jugador NO debe poder borrar')
r = await json(admin, `/partidas.php?id=${partidaId}`, {}, 'DELETE')
assert.equal(r.estado, 200, `DELETE admin falló: ${JSON.stringify(r.cuerpo)}`)
r = await jugador.api('/ranking.php?juegoId=3')
assert.ok(!r.cuerpo.some((f) => f.usuarioId === 1 && f.puntos === puntosGuardados), 'el resultado retirado debe desaparecer')
console.log('✓ DELETE: 403 para jugador, 200 para admin y ranking actualizado')

console.log('\nSistema conectado: todas las comprobaciones pasaron.')
