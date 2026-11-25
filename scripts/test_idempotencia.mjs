// Test LIVE de idempotencia de crearTorneo. No corre en npm test: ESCRIBE en la BD.
// Uso: PARTIDA_ID=123 API_URL=http://localhost/3a1-api node scripts/test_idempotencia.mjs
// La primera llamada crea el torneo; la segunda debe devolver ya_existia=true.
const partidaId = Number(process.env.PARTIDA_ID)
const base = (process.env.API_URL || 'http://localhost/3a1-api').replace(/\/$/, '')

if (!partidaId) {
  console.log('Skip: definí PARTIDA_ID (y opcionalmente API_URL) para correr el test live.')
  process.exit(0)
}

const cuerpo = {
  partida_id: partidaId,
  formato: 'premier',
  participantes: [
    { temporada_id: null, zona: null, es_usuario: true }
  ],
  calendario: []
}

async function crear() {
  const r = await fetch(`${base}/torneo.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo)
  })
  const datos = await r.json()
  if (!r.ok) throw new Error(datos.error ?? `HTTP ${r.status}`)
  return datos
}

const primero = await crear()
const segundo = await crear()
if (!segundo.ya_existia || segundo.id !== primero.id) {
  console.error('FALLÓ: el segundo torneo no fue idempotente', { primero, segundo })
  process.exit(1)
}
console.log(`OK: torneo ${primero.id} reutilizado, ya_existia=true en la segunda llamada.`)
