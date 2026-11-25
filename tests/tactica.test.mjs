// 3A1 — tests de táctica visible y su efecto en la simulación.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { coordConTactica } from '../src/game/pitch.js'
import { EFECTO_ANCHO, simularPartido, simularTorneo } from '../src/game/formations.js'

describe('coordConTactica', () => {
  const punto = [35, 22] // un delantero: se ataca hacia Y menor

  it('el estilo corre la formación en profundidad', () => {
    const [xEq, yEq] = coordConTactica(punto, 'equilibrado', 'equilibrado')
    const [xOf, yOf] = coordConTactica(punto, 'ofensivo', 'equilibrado')
    const [xDe, yDe] = coordConTactica(punto, 'defensivo', 'equilibrado')
    assert.equal(xEq, xOf)
    assert.equal(xEq, xDe)
    assert.ok(yOf < yEq, 'ofensivo adelanta')
    assert.ok(yDe > yEq, 'defensivo replega')
  })

  it('el ancho escala las distancias laterales alrededor del centro', () => {
    const [xE] = coordConTactica(punto, 'equilibrado', 'equilibrado')
    const [xS] = coordConTactica(punto, 'equilibrado', 'estrecho')
    const [xA] = coordConTactica(punto, 'equilibrado', 'amplio')
    assert.ok(xS > xE && xE > xA, 'estrecho acerca al centro, amplio lo abre')
    assert.ok(Math.abs(xS - 50) < Math.abs(xE - 50))
    assert.ok(Math.abs(xA - 50) > Math.abs(xE - 50))
  })

  it('nunca saca una ficha de la cancha y tolera posiciones faltantes', () => {
    for (const estilo of ['ofensivo', 'equilibrado', 'defensivo']) {
      for (const ancho of ['estrecho', 'equilibrado', 'amplio']) {
        const [x, y] = coordConTactica([8, 92], estilo, ancho)
        assert.ok(x >= 7 && x <= 93)
        assert.ok(y >= 14 && y <= 90)
      }
    }
    assert.deepEqual(coordConTactica(null), [50, 50])
  })
})

describe('ancho aplicado a la simulación', () => {
  // Con Poisson no alcanza un azar constante: dos medias distintas pueden
  // caer en el mismo entero. Comparamos promedios con una secuencia sembrada.
  function rng(semilla) {
    let s = semilla
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  }
  const base = [86, 84, 'equilibrado', 11]
  function promedio(ancho, muestras = 12000, semilla = 2026) {
    const azar = rng(semilla)
    let favor = 0
    let contra = 0
    for (let i = 0; i < muestras; i++) {
      const r = simularPartido(...base, ancho, azar)
      favor += r.favor
      contra += r.contra
    }
    return { favor: favor / muestras, contra: contra / muestras }
  }

  it('estrecho concede menos goles que equilibrado', () => {
    const estrecho = promedio('estrecho')
    const normal = promedio('equilibrado')
    assert.ok(estrecho.contra < normal.contra, JSON.stringify({ estrecho, normal }))
    assert.ok(estrecho.favor < normal.favor, JSON.stringify({ estrecho, normal }))
  })

  it('amplio genera más goles a favor y en contra', () => {
    const amplio = promedio('amplio')
    const normal = promedio('equilibrado')
    assert.ok(amplio.favor > normal.favor, JSON.stringify({ amplio, normal }))
    assert.ok(amplio.contra > normal.contra, JSON.stringify({ amplio, normal }))
  })

  it('el valor por defecto no cambia el resultado anterior', () => {
    const antes = simularPartido(86, 84, 'equilibrado', 11, 'equilibrado', rng(7))
    const ahora = simularPartido(86, 84, undefined, undefined, undefined, rng(7))
    assert.deepEqual(antes, ahora)
    assert.deepEqual(EFECTO_ANCHO.equilibrado, { favor: 0, contra: 0 })
  })

  it('simularTorneo reenvía el ancho al motor', () => {
    const equipo = [{ ovr_final: 86, posicion_natural: 'DC' }]
    const rivales = [{ ovr_equipo: 84 }]
    function promedioTorneo(ancho, muestras = 4000, semilla = 99) {
      const azar = rng(semilla)
      let favor = 0
      let contra = 0
      for (let i = 0; i < muestras; i++) {
        const t = simularTorneo(equipo, rivales, 'equilibrado', null, 0, ancho, azar)
        favor += t.partidos[0].favor
        contra += t.partidos[0].contra
      }
      return { favor: favor / muestras, contra: contra / muestras }
    }
    const estrecho = promedioTorneo('estrecho')
    const amplio = promedioTorneo('amplio')
    assert.ok(estrecho.contra < amplio.contra, JSON.stringify({ estrecho, amplio }))
    assert.ok(estrecho.favor < amplio.favor, JSON.stringify({ estrecho, amplio }))
  })
})
