// 3A1 — tests del motor (node --test). Sin framework: node:test + assert.
// Correr: npm test
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  RONDAS,
  promedioOvr, sinergias, ovrEfectivo, simularPartido,
  elegirGoleadores, elegirGolesConAsistencias, rankingAportes, mvpAportes,
  simularTanda, simularTorneo, relato,
  goleadorTorneo, calificaciones
} from '../src/game/formations.js'
import { fotoDe, esFotoEpoca, anioFotoDe } from '../src/game/fotos.js'
import { nombreCorto } from '../src/game/nombres.js'

const mk = (ovr, n = 11, club = 'River Plate', anio = 2018, pos = 'MC') =>
  Array.from({ length: n }, (_, i) => ({
    nombre: 'J' + i,
    posicion_natural: pos,
    club,
    anio_orden: anio,
    temporada_jugador_id: i + 1,
    ovr_final: ovr
  }))

describe('nombreCorto', () => {
  it('usa nombre de pila + apellido, no los últimos dos nombres', () => {
    assert.equal(nombreCorto('Guillermo Matías Fernández'), 'Guillermo Fernández')
    assert.equal(nombreCorto('Diego Armando Maradona'), 'Diego Maradona')
    assert.equal(nombreCorto('Enzo Francescoli'), 'Enzo Francescoli')
    assert.equal(nombreCorto('Alfredo Di Stéfano'), 'Alfredo Di Stéfano')
    assert.equal(nombreCorto(''), '')
  })
})

describe('promedioOvr', () => {  it('promedia y redondea a 1 decimal', () => {
    assert.equal(promedioOvr(mk(86)), 86)
    assert.equal(promedioOvr([]), 0)
  })
})

describe('sinergias', () => {
  it('3-4 del mismo plantel dan +1', () => {
    const eq = [...mk(84, 3, 'River Plate', 2018),
      ...[2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008].map((a, i) => mk(84, 1, 'Club' + i, a)).flat()]
    assert.equal(sinergias(eq).bonus, 1)
  })
  it('5+ dan +2 con tope', () => {
    const eq = [...mk(84, 6, 'River Plate', 2018), ...mk(84, 5, 'Boca', 1962)]
    assert.equal(sinergias(eq).bonus, 2)
  })
  it('sueltos no dan nada', () => {
    const eq = [mk(84, 2, 'A', 2000), mk(84, 2, 'B', 2001)].flat()
    assert.equal(sinergias(eq).bonus, 0)
  })
  it('ovrEfectivo suma promedio + bonus', () => {
    assert.equal(ovrEfectivo(mk(84, 11, 'River Plate', 2018)), 86)
  })
})

describe('simularPartido', () => {
  it('goles enteros no negativos', () => {
    for (let i = 0; i < 50; i++) {
      const { favor, contra } = simularPartido(86, 84)
      assert.ok(Number.isInteger(favor) && favor >= 0)
      assert.ok(Number.isInteger(contra) && contra >= 0)
    }
  })
  it('calibra ~2,6 goles totales y permite el 0-0', () => {
    let s = 2026
    const azar = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
    const n = 20000
    let total = 0
    let ceros = 0
    for (let i = 0; i < n; i++) {
      const { favor, contra } = simularPartido(84, 84, 'equilibrado', 11, 'equilibrado', azar)
      total += favor + contra
      if (favor === 0 && contra === 0) ceros++
    }
    const promedio = total / n
    assert.ok(promedio > 2.4 && promedio < 2.9, `promedio ${promedio}`)
    assert.ok(ceros > 0, 'el 0-0 tiene que ser posible')
  })
})

describe('simularTanda', () => {
  it('siempre hay ganador y remates coherentes', () => {
    for (let i = 0; i < 50; i++) {
      const t = simularTanda(86, 84, false)
      assert.ok(t.ganador === (t.mios > t.suyos))
      assert.ok(t.remates.length >= 3 && t.remates.length <= 15)
    }
  })
})

describe('simularTorneo', () => {
  const rivales = Array.from({ length: 7 }, (_, i) => ({ etiqueta: 'R' + i, ovr_equipo: 84 }))
  it('respeta invariantes: max 7, goleadores == favor, corta al perder', () => {
    for (let i = 0; i < 30; i++) {
      const t = simularTorneo(mk(86), rivales)
      assert.ok(t.partidos.length >= 1 && t.partidos.length <= 7)
      for (const p of t.partidos) {
        assert.equal(p.goleadores.length, p.favor)
      }
      const ultimo = t.partidos[t.partidos.length - 1]
      if (t.partidos.length < 7) assert.equal(ultimo.avanzo, false)
      if (t.campeon) assert.equal(t.partidos.length, 7)
    }
  })
  it('relato no vacío y goleador consistente', () => {
    const t = simularTorneo(mk(88), rivales)
    for (const p of t.partidos) {
      assert.ok(relato(p, 'X').length >= 2)
    }
    const g = goleadorTorneo(t)
    const total = t.partidos.reduce((a, p) => a + p.favor, 0)
    if (total > 0) {
      assert.ok(g && g.goles > 0)
    }
  })
  it('calificaciones entre 1 y 10', () => {
    const c = calificaciones(simularTorneo(mk(86), rivales))
    assert.ok(c.ataque >= 1 && c.ataque <= 10)
    assert.ok(c.defensa >= 1 && c.defensa <= 10)
  })
  it('offsetRonda asigna la ronda real (juego partido a partido)', () => {
    for (let k = 0; k < 7; k++) {
      const t = simularTorneo(mk(90), [rivales[k]], 'equilibrado', null, k)
      assert.equal(t.partidos.length, 1)
      assert.equal(t.partidos[0].ronda, RONDAS[k])
      assert.equal(t.campeon, false)
    }
    // Sin offset: comportamiento clásico intacto.
    const full = simularTorneo(mk(90), rivales)
    assert.equal(full.partidos[0].ronda, 'Fase de grupos · Fecha 1')
  })
})

describe('goles con asistencias', () => {
  it('tantos goles como se piden, minutos únicos, asistidor distinto', () => {
    for (let i = 0; i < 30; i++) {
      const gs = elegirGolesConAsistencias(mk(86), 4)
      assert.equal(gs.length, 4)
      assert.equal(new Set(gs.map((g) => g.minuto)).size, 4)
      for (const g of gs) {
        assert.ok(g.jugador)
        if (g.asistencia) assert.notEqual(g.asistencia, g.jugador)
      }
    }
    assert.deepEqual(elegirGolesConAsistencias([], 3), [])
    assert.deepEqual(elegirGolesConAsistencias(mk(86, 1), 0), [])
  })
  it('rankingAportes suma g*2+a y mvpAportes devuelve el primero', () => {
    const gs = [
      { jugador: 'A', id: 1, asistencia: 'B', asistenciaId: 2 },
      { jugador: 'A', id: 1, asistencia: null, asistenciaId: null },
      { jugador: 'B', id: 2, asistencia: 'A', asistenciaId: 1 }
    ]
    const r = rankingAportes(gs)
    assert.equal(r[0].jugador, 'A')
    assert.equal(r[0].g, 2)
    assert.equal(r[0].a, 1)
    assert.equal(r[0].pts, 5)
    assert.equal(mvpAportes(gs).jugador, 'A')
    assert.equal(mvpAportes([]), null)
  })
})

describe('fotos de época', () => {
  it('foto_epoca > foto_url > null, con año real', () => {
    assert.equal(fotoDe({ foto_epoca: 'e', foto_url: 'u' }), 'e')
    assert.equal(fotoDe({ foto_epoca: null, foto_url: 'u' }), 'u')
    assert.equal(fotoDe({}), null)
    assert.equal(fotoDe(null), null)
    assert.equal(esFotoEpoca({ foto_epoca: 'e' }), true)
    assert.equal(esFotoEpoca({ foto_url: 'u' }), false)
    assert.equal(anioFotoDe({ foto_anio: 1962 }, 1963), 1962)
    assert.equal(anioFotoDe({}, 1963), 1963)
  })
})

describe('escudoDe', () => {
  it('época > actual > null', async () => {
    const { escudoDe } = await import('../src/game/fotos.js')
    assert.equal(escudoDe({ escudo_epoca: 'e', escudo: 'a' }), 'e')
    assert.equal(escudoDe({ escudo_epoca: null, escudo: 'a' }), 'a')
    assert.equal(escudoDe({}), null)
    assert.equal(escudoDe(null), null)
  })
})
