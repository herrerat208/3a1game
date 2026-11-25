// 3A1 — tests offline de logros inferidos y piso de medallas (node --test).
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// Storage en memoria: las reglas de recompensas solo leen/escriben localStorage.
const datos = new Map()
globalThis.localStorage = {
  getItem: (k) => (datos.has(k) ? datos.get(k) : null),
  setItem: (k, v) => { datos.set(k, String(v)) },
  removeItem: (k) => { datos.delete(k) },
  clear: () => { datos.clear() }
}

const { logrosDeTorneo } = await import('../src/game/logros.js')
const { registrarMedalla, medallaPrometida, resumenRecompensas } = await import('../src/game/recompensas.js')

beforeEach(() => { datos.clear() })

function gol(jugador, asistencia = null) {
  return { minuto: 10, jugador, asistencia }
}
function partido(gf, gc, goleadores = [], extra = {}) {
  return { gf, gc, fecha_n: 1, fase: 'liga', detalle: { goleadores }, ...extra }
}
const NUEVOS = ['cinco_goles_un_jugador', 'cinco_asistencias', 'torneo_perfecto', 'valla_total', 'clasico_doble']

describe('logrosDeTorneo', () => {
  it('infere los logros nuevos de datos ya guardados', () => {
    const partidos = Array.from({ length: 7 }, (_, i) =>
      partido(1, 0, [gol(i < 5 ? 'Jugador A' : 'Jugador B', 'Asistidor')]))
    const cods = logrosDeTorneo({ campeon: false, partidos })
    for (const cod of ['cinco_goles_un_jugador', 'cinco_asistencias', 'torneo_perfecto', 'valla_total']) {
      assert.ok(cods.includes(cod), `${cod} debería inferirse`)
    }
    assert.ok(!cods.includes('diez_goles')) // 7 goles, no 10
    assert.ok(!cods.includes('clasico_doble')) // ningún partido marcado como clásico
  })

  it('exige 7 partidos oficiales para los logros de temporada', () => {
    const seis = Array.from({ length: 6 }, () => partido(2, 0, [gol('Jugador A', 'Asistidor')]))
    const cods = logrosDeTorneo({ campeon: false, partidos: seis })
    assert.ok(!cods.includes('torneo_perfecto'))
    assert.ok(!cods.includes('valla_total'))
    assert.ok(!cods.includes('cinco_goles_un_jugador'))
    assert.ok(!cods.includes('cinco_asistencias'))

    const amistosos = Array.from({ length: 7 }, () => partido(2, 0, [], { amistoso: true }))
    assert.deepEqual(logrosDeTorneo({ campeon: true, partidos: amistosos }), [])
  })

  it('valla_total requiere todos los partidos sin goles en contra', () => {
    const partidos = Array.from({ length: 7 }, (_, i) => partido(1, i === 3 ? 1 : 0))
    assert.ok(!logrosDeTorneo({ campeon: false, partidos }).includes('valla_total'))
  })

  it('clasico_doble requiere dos victorias marcadas como clásico', () => {
    const dosGanados = [partido(2, 1, [], { clasico: true }), partido(3, 0, [], { clasico: true })]
    assert.ok(logrosDeTorneo({ campeon: false, partidos: dosGanados }).includes('clasico_doble'))
    const unoPerdido = [partido(2, 1, [], { clasico: true }), partido(0, 1, [], { clasico: true })]
    assert.ok(!logrosDeTorneo({ campeon: false, partidos: unoPerdido }).includes('clasico_doble'))
    const sinMarca = [partido(2, 1), partido(3, 0)]
    assert.ok(!logrosDeTorneo({ campeon: false, partidos: sinMarca }).includes('clasico_doble'))
  })
})

describe('recompensas con piso por logro', () => {
  it('medallaPrometida indica el mínimo de cada logro difícil', () => {
    for (const cod of NUEVOS) assert.equal(medallaPrometida(cod)?.clave, 'diamante')
    assert.equal(medallaPrometida('diez_goles')?.clave, 'oro')
    assert.equal(medallaPrometida('primer_campeon'), null)
  })

  it('registrarMedalla elige la mejor entre dificultad y piso', () => {
    datos.set('formato', 'siete') // torneo clásico => bronce
    registrarMedalla('cinco_goles_un_jugador')
    let r = resumenRecompensas()
    assert.equal(r.medalla.clave, 'diamante')
    assert.equal(r.desglose.find((m) => m.clave === 'diamante').cantidad, 1)

    registrarMedalla('diez_goles') // piso oro, por encima del bronce
    r = resumenRecompensas()
    assert.equal(r.desglose.find((m) => m.clave === 'oro').cantidad, 1)

    registrarMedalla('primer_partido') // sin piso: difficulty actual
    r = resumenRecompensas()
    assert.equal(r.desglose.find((m) => m.clave === 'bronce').cantidad, 1)
    assert.equal(r.medallas, 3)
  })

  it('nunca baja la categoría de la partida aunque el logro no tenga piso', () => {
    datos.set('formato', 'liga30') // Argentina => diamante
    registrarMedalla('primer_partido')
    assert.equal(resumenRecompensas().medalla.clave, 'diamante')
    assert.equal(resumenRecompensas().desglose.find((m) => m.clave === 'diamante').cantidad, 1)
  })

  it('conserva las medallas antiguas guardadas sin categoría', () => {
    datos.set('formato', 'siete')
    datos.set('recompensas_3a1', '3')
    registrarMedalla('cinco_asistencias')
    const r = resumenRecompensas()
    assert.equal(r.medallas, 4)
    assert.equal(r.desglose.find((m) => m.clave === 'bronce').cantidad, 3)
    assert.equal(r.desglose.find((m) => m.clave === 'diamante').cantidad, 1)
  })
})
