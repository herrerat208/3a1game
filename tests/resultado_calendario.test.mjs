// 3A1 — el resultado guardado debe respetar local/visita de calendario.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { golesParaCalendario, golesDesdeMiPerspectiva } from '../src/game/resultado_calendario.js'

describe('goles del simulador → calendario', () => {
  it('si el usuario es local, favor/contra quedan como gf/gc', () => {
    assert.deepEqual(golesParaCalendario('local', 2, 1), { gf: 2, gc: 1 })
  })

  it('si el usuario es visitante, se invierten (bug del 2-1 que daba derrota)', () => {
    assert.deepEqual(golesParaCalendario('visita', 2, 1), { gf: 1, gc: 2 })
  })

  it('un empate sigue siendo empate en ambos lados', () => {
    assert.deepEqual(golesParaCalendario('local', 0, 0), { gf: 0, gc: 0 })
    assert.deepEqual(golesParaCalendario('visita', 0, 0), { gf: 0, gc: 0 })
  })

  it('la lectura desde mi perspectiva revierte la conversión', () => {
    for (const lado of ['local', 'visita']) {
      const guardado = golesParaCalendario(lado, 3, 1)
      assert.deepEqual(golesDesdeMiPerspectiva(lado, guardado), { favor: 3, contra: 1 })
    }
  })
})
