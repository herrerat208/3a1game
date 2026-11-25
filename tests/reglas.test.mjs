// 3A1 — tests de reglas de partida y sanciones (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { modoDePartida } from '../src/game/partida.js'
import { suspensionPorAmarilla } from '../src/game/sanciones.js'
import { logrosDeTorneo } from '../src/game/logros.js'

describe('logros de torneo', () => {
  it('lee pases gol, hat-trick, 10 goles e invicto del detalle guardado', () => {
    const partidos = [
      {
        gf: 5, gc: 1,
        detalle: {
          goleadores: [
            { jugador: 'A', asistencia: 'B' }, { jugador: 'A' }, { jugador: 'A' },
            { jugador: 'B' }, { jugador: 'C' }
          ]
        }
      },
      { gf: 5, gc: 0, detalle: { goleadores: Array.from({ length: 5 }, () => ({ jugador: 'D' })) } }
    ]
    const cods = logrosDeTorneo({ campeon: true, partidos })
    assert.deepEqual([...cods].sort(), ['asistencia', 'campeon_invicto', 'diez_goles', 'hat_trick'])
  })
  it('sin partidos no inventa logros', () => {
    assert.deepEqual(logrosDeTorneo({ campeon: true, partidos: [] }), [])
  })
})

describe('modoDePartida', () => {
  it('las partidas viejas del desafío diario se leen como normales', () => {
    assert.equal(modoDePartida('Diario 2026-11-17'), 'normal')
  })
  it('reconoce la carrera por el sufijo de temporada', () => {
    assert.equal(modoDePartida('Tu River Plate · T3'), 'carrera')
    assert.equal(modoDePartida('Tu River Plate · T12'), 'carrera')
  })
  it('todo lo demás es modo normal', () => {
    assert.equal(modoDePartida('Tu River Plate'), 'normal')
    assert.equal(modoDePartida('Diario'), 'normal')
    assert.equal(modoDePartida('Tu River Plate · Tx'), 'normal')
    assert.equal(modoDePartida(undefined), 'normal')
  })
})

describe('suspensionPorAmarilla', () => {
  it('la primera amarilla no suspende', () => {
    assert.equal(suspensionPorAmarilla(0, 3), 0)
  })
  it('la segunda amarilla suspende la fecha siguiente', () => {
    assert.equal(suspensionPorAmarilla(1, 3), 4)
  })
  it('no resetea el contador: la tercera no suspende y la cuarta sí', () => {
    assert.equal(suspensionPorAmarilla(2, 5), 0)
    assert.equal(suspensionPorAmarilla(3, 6), 7)
  })
  it('acepta valores persistidos como texto', () => {
    assert.equal(suspensionPorAmarilla('1', '3'), 4)
  })
})
