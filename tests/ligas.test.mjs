// 3A1 — tests de sorteo por bombos + fixture/tabla (node --test).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  porBombos, sortearRivales, sortearConGarantia, armarZonas, armarGrupos,
  promedioLote, mezclar
} from '../src/game/sorteo_rivales.js'
import {
  fixtureIda, fixtureIdaVuelta, calcularTabla, tablaHasta, desempate, racha, racha5, simularPartidoLiga, probabilidades,
  crucesOctavos, crucesMundial, fixturePremier, armarZonasLiga30, fixtureZonas,
  garantizarClasicoZonas, cruceInterzonal, siguienteRondaPlayoffs, onceRival
} from '../src/game/ligas.js'
import { claveRival } from '../src/game/variedad.js'

// 79 rivales sintéticos con OVR 60..99 aprox.
const rivales = Array.from({ length: 79 }, (_, i) => ({
  temporada_id: i + 1,
  etiqueta: (i % 9 === 0 ? 'Boca ' : 'Rival ') + i,
  ovr_equipo: 70 + (i % 20)
}))

describe('porBombos', () => {
  it('4 bombos ordenados de fuerte a débil', () => {
    const b = porBombos(rivales)
    assert.equal(b.length, 4)
    assert.equal(b.flat().length, 79)
    const top = Math.max(...b[0].map((r) => r.ovr_equipo))
    const bottom = Math.min(...b[3].map((r) => r.ovr_equipo))
    assert.ok(top >= bottom)
    assert.ok(Math.min(...b[0].map((r) => r.ovr_equipo)) >= Math.max(...b[1].map((r) => r.ovr_equipo)))
  })
})

describe('sortearRivales', () => {
  it('reparto proporcional sin repetir', () => {
    for (const n of [19, 29, 31]) {
      const s = sortearRivales(rivales, n)
      assert.equal(s.length, n)
      assert.equal(new Set(s.map((r) => r.temporada_id)).size, n)
    }
    // 19 => 5+5+5+4 por bombo
    const pots = porBombos(rivales)
    const enBombo = (r, i) => pots[i].some((x) => x.temporada_id === r.temporada_id)
    for (let t = 0; t < 20; t++) {
      const s = sortearRivales(rivales, 19)
      const cuenta = [0, 1, 2, 3].map((i) => s.filter((r) => enBombo(r, i)).length)
      assert.deepEqual(cuenta, [5, 5, 5, 4])
    }
  })
  it('balanceado: promedio en banda razonable', () => {
    for (let t = 0; t < 20; t++) {
      const p = promedioLote(sortearRivales(rivales, 19))
      assert.ok(p > 74 && p < 86, `promedio ${p}`)
    }
  })
  it('falla si no hay suficientes', () => {
    assert.throws(() => sortearRivales(rivales.slice(0, 5), 19))
  })
})

describe('sortearConGarantia', () => {
  it('incluye un Boca + 18 por bombos sin repetir', () => {
    const s = sortearConGarantia(rivales, 19, (r) => r.etiqueta.startsWith('Boca'))
    assert.equal(s.length, 19)
    assert.ok(s.some((r) => r.etiqueta.startsWith('Boca')))
    assert.equal(new Set(s.map((r) => r.temporada_id)).size, 19)
  })
})

describe('armarZonas', () => {
  it('snake equilibrado: dif de promedio < 1', () => {
    const eq = Array.from({ length: 30 }, (_, i) => ({ id: i, ovr_equipo: 70 + i }))
    const [A, B] = armarZonas(eq)
    assert.equal(A.length, 15)
    assert.equal(B.length, 15)
    assert.ok(Math.abs(promedioLote(A) - promedioLote(B)) < 1)
  })
})

describe('armarGrupos', () => {
  it('8 grupos de 4, uno por bombo', () => {
    const eq = Array.from({ length: 32 }, (_, i) => ({ id: i, ovr_equipo: 70 + i }))
    const g = armarGrupos(eq)
    assert.equal(g.length, 8)
    for (const grupo of g) assert.equal(grupo.length, 4)
    assert.equal(new Set(g.flat().map((e) => e.id)).size, 32)
  })
  it('exige 32', () => {
    assert.throws(() => armarGrupos([]))
  })
})

describe('fixtureIda', () => {
  it('20 equipos: 19 fechas de 10, todos contra todos 1 vez', () => {
    const eq = Array.from({ length: 20 }, (_, i) => i)
    const f = fixtureIda(eq)
    assert.equal(f.length, 19)
    for (const fecha of f) assert.equal(fecha.length, 10)
    const pares = f.flat().map((p) => [p.local, p.visita].sort((a, b) => a - b).join('-')).sort()
    assert.equal(new Set(pares).size, 190)
  })
  it('impar: uno libre por fecha', () => {
    const f = fixtureIda([1, 2, 3])
    assert.equal(f.length, 3)
    for (const fecha of f) assert.equal(fecha.length, 1)
  })
  it('ida/vuelta invierte localías', () => {
    const f = fixtureIdaVuelta([1, 2, 3, 4])
    assert.equal(f.length, 6)
    const ida = f.slice(0, 3).flat().map((p) => `${p.local}-${p.visita}`).sort()
    const vuelta = f.slice(3).flat().map((p) => `${p.visita}-${p.local}`).sort()
    assert.deepEqual(ida, vuelta)
  })
})

describe('calcularTabla', () => {
  it('puntos, dif y orden canónico', () => {
    const t = calcularTabla([1, 2, 3], [
      { local: 1, visita: 2, gf: 2, gc: 0, jugado: true },
      { local: 2, visita: 3, gf: 1, gc: 1, jugado: true },
      { local: 1, visita: 3, gf: 0, gc: 0, jugado: false }
    ])
    assert.equal(t[0].id, 1)
    assert.equal(t[0].pts, 3)
    assert.equal(t[1].id, 2)
    assert.equal(t[1].pts, 1)
    assert.equal(t[2].id, 3)
    assert.equal(t[2].pts, 1)
    // 2° sobre 3° por diferencia (0 vs -2... 2: 2gf 3gc; 3: 1gf 1gc) => dif decide
    assert.ok(t[1].dif >= t[2].dif)
  })
  it('racha V-E-D', () => {
    const ps = [
      { local: 1, visita: 2, gf: 1, gc: 0, jugado: true },
      { local: 3, visita: 1, gf: 2, gc: 2, jugado: true },
      { local: 1, visita: 4, gf: 0, gc: 3, jugado: true }
    ]
    assert.equal(racha(1, ps), 'VED')
  })
})

describe('cruces', () => {
  it('liga 30: 8 octavos cruzados con los top 8 de cada zona', () => {
    const A = Array.from({ length: 8 }, (_, i) => `a${i + 1}`)
    const B = Array.from({ length: 8 }, (_, i) => `b${i + 1}`)
    const c = crucesOctavos({ A, B })
    assert.equal(c.length, 8)
    assert.deepEqual(c[0], ['a1', 'b8'])
    assert.deepEqual(c[4], ['b1', 'a8'])
    // Cada clasificado juega una sola vez y A siempre cruza con B.
    assert.equal(new Set(c.flat()).size, 16)
    assert.ok(c.every(([x, y]) => x[0] !== y[0]))
    // Ganadores de a 2 → 4 cuartos, 2 semis y 1 final.
    const cuartos = siguienteRondaPlayoffs(c.map((p) => p[0]))
    const semis = siguienteRondaPlayoffs(cuartos.map((p) => p[0]))
    const final = siguienteRondaPlayoffs(semis.map((p) => p[0]))
    assert.equal(cuartos.length, 4)
    assert.equal(semis.length, 2)
    assert.equal(final.length, 1)
    assert.throws(() => crucesOctavos({ A: A.slice(0, 7), B }))
  })
  it('mundial: 8 octavos cruzados', () => {
    const grupos = Object.fromEntries(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((z) => [z, [`1${z}`, `2${z}`]]))
    const c = crucesMundial(grupos)
    assert.equal(c.length, 8)
    assert.deepEqual(c[0], ['1A', '2B'])
    assert.deepEqual(c[4], ['1B', '2A'])
    const todos = c.flat().sort()
    assert.equal(new Set(todos).size, 16)
  })
})

describe('mezclar', () => {
  it('no muta y conserva elementos', () => {
    const a = [1, 2, 3, 4, 5]
    const m = mezclar(a)
    assert.deepEqual(a, [1, 2, 3, 4, 5])
    assert.deepEqual([...m].sort(), [1, 2, 3, 4, 5])
  })
})

describe('premier 20', () => {
  it('38 fechas de 10, cada par se cruza 2 veces (ida y vuelta)', () => {
    const eq = Array.from({ length: 20 }, (_, i) => i)
    const f = fixturePremier(eq)
    assert.equal(f.length, 38)
    for (const fecha of f) assert.equal(fecha.length, 10)
    const pares = f.flat().map((p) => `${p.local}-${p.visita}`).sort()
    assert.equal(pares.length, 380)
    // Cada par ordenado aparece exactamente 2 veces.
    const sinOrden = f.flat().map((p) => [p.local, p.visita].sort((a, b) => a - b).join('-')).sort()
    assert.equal(new Set(sinOrden).size, 190)
    assert.ok(sinOrden.every((k, i, arr) => arr.filter((x) => x === k).length === 2))
    // Localías invertidas entre mitades.
    const ida = f.slice(0, 19).flat().map((p) => `${p.local}-${p.visita}`).sort()
    const vuelta = f.slice(19).flat().map((p) => `${p.visita}-${p.local}`).sort()
    assert.deepEqual(ida, vuelta)
  })
  it('exige 20', () => {
    assert.throws(() => fixturePremier([1, 2, 3]))
  })
})

describe('liga 30', () => {
  const eq30 = () => Array.from({ length: 30 }, (_, i) => ({ id: i, ovr_equipo: 70 + i }))
  it('2 zonas de 15 con dif de promedio < 1', () => {
    const [A, B] = armarZonasLiga30(eq30())
    assert.equal(A.length, 15)
    assert.equal(B.length, 15)
    assert.ok(Math.abs(promedioLote(A) - promedioLote(B)) < 1)
  })
  it('exige 30', () => {
    assert.throws(() => armarZonasLiga30([1, 2]))
  })
  it('fixture por zona: 15 fechas de 7 (uno libre)', () => {
    const [A, B] = armarZonasLiga30(eq30())
    const { fechasA, fechasB } = fixtureZonas(A.map((e) => e.id), B.map((e) => e.id))
    assert.equal(fechasA.length, 15)
    assert.equal(fechasB.length, 15)
    for (const fecha of [...fechasA, ...fechasB]) assert.equal(fecha.length, 7)
  })
  it('garantizarClasicoZonas separa usuario y Boca', () => {
    const esYo = (e) => e.id === 'yo'
    const esBoca = (e) => e.id === 'boca'
    const base = Array.from({ length: 28 }, (_, i) => ({ id: i, ovr_equipo: 75 + (i % 10) }))
    const zonas = [[{ id: 'yo', ovr_equipo: 85 }, { id: 'boca', ovr_equipo: 84 }, ...base.slice(0, 13)], [...base.slice(13)]]
    const [A, B] = garantizarClasicoZonas(zonas, esYo, esBoca)
    const yoEnA = A.some(esYo)
    const bocaEnA = A.some(esBoca)
    assert.notEqual(yoEnA, bocaEnA)
    assert.equal(A.length + B.length, 30)
  })
  it('interzonal cruza A vs B 1 vez cada uno', () => {
    const A = Array.from({ length: 15 }, (_, i) => `a${i}`)
    const B = Array.from({ length: 15 }, (_, i) => `b${i}`)
    const cruces = cruceInterzonal(A, B)
    assert.equal(cruces.length, 15)
    assert.equal(new Set(cruces.map((c) => c.local)).size, 15)
    assert.equal(new Set(cruces.map((c) => c.visita)).size, 15)
    assert.throws(() => cruceInterzonal([1], [1, 2]))
  })
  it('playoffs: ganadores se aparean de a 2', () => {
    assert.deepEqual(siguienteRondaPlayoffs(['g1', 'g2', 'g3', 'g4']), [['g1', 'g2'], ['g3', 'g4']])
    assert.deepEqual(siguienteRondaPlayoffs(['g1', 'g2']), [['g1', 'g2']])
    assert.deepEqual(siguienteRondaPlayoffs(['g1']), [])
  })
})

describe('onceRival', () => {
  const plantel = [
    { nombre: 'ARQ1', posicion_natural: 'ARQ', posiciones_secundarias: '', ovr_final: 85 },
    { nombre: 'DFC1', posicion_natural: 'DFC', posiciones_secundarias: '', ovr_final: 84 },
    { nombre: 'DFC2', posicion_natural: 'DFC', posiciones_secundarias: '', ovr_final: 82 },
    { nombre: 'MC1', posicion_natural: 'MC', posiciones_secundarias: '', ovr_final: 83 },
    { nombre: 'POLI', posicion_natural: 'MD', posiciones_secundarias: 'DC', ovr_final: 80 },
    { nombre: 'DC1', posicion_natural: 'DC', posiciones_secundarias: '', ovr_final: 88 }
  ]
  it('reparte natural > secundaria > mejor libre, sin repetir', () => {
    const once = onceRival(plantel, { ARQ: 'ARQ', DFC1: 'DFC', DFC2: 'DFC', MCD: 'MCD', DC: 'DC' })
    const porSlot = Object.fromEntries(once.map((o) => [o.slot, o.jugador?.nombre]))
    assert.equal(porSlot.ARQ, 'ARQ1')
    assert.equal(porSlot.DFC1, 'DFC1')
    assert.equal(porSlot.DFC2, 'DFC2')
    // El DC natural no se gasta en el MCD: queda para su puesto.
    assert.equal(porSlot.DC, 'DC1')
    // MCD sin natural ni secundaria: va el mejor volante libre.
    assert.equal(porSlot.MCD, 'MC1')
    assert.equal(new Set(once.map((o) => o.jugador?.nombre)).size, 5)
  })
  it('no manda extremos al mediocampo si hay volantes para cubrir', () => {
    // Caso Boca 2022: un solo MC natural, dos volantes MD/MI y dos extremos.
    const boca = [
      { nombre: 'Rossi', posicion_natural: 'ARQ', posiciones_secundarias: '', ovr_final: 84 },
      { nombre: 'Advíncula', posicion_natural: 'LD', posiciones_secundarias: '', ovr_final: 82 },
      { nombre: 'Zambrano', posicion_natural: 'DFC', posiciones_secundarias: '', ovr_final: 81 },
      { nombre: 'Figal', posicion_natural: 'DFC', posiciones_secundarias: '', ovr_final: 83 },
      { nombre: 'Fabra', posicion_natural: 'LI', posiciones_secundarias: '', ovr_final: 82 },
      { nombre: 'Varela', posicion_natural: 'MC', posiciones_secundarias: '', ovr_final: 84 },
      { nombre: 'Fernández', posicion_natural: 'MD', posiciones_secundarias: '', ovr_final: 83 },
      { nombre: 'Ramírez', posicion_natural: 'MI', posiciones_secundarias: '', ovr_final: 82 },
      { nombre: 'Langoni', posicion_natural: 'ED', posiciones_secundarias: '', ovr_final: 82 },
      { nombre: 'Villa', posicion_natural: 'EI', posiciones_secundarias: '', ovr_final: 85 },
      { nombre: 'Benedetto', posicion_natural: 'DC', posiciones_secundarias: '', ovr_final: 84 }
    ]
    const mapa = {
      ARQ: 'ARQ', LD: 'LD', DFC1: 'DFC', DFC2: 'DFC', LI: 'LI',
      MC1: 'MC', MC2: 'MC', MC3: 'MC', ED: 'ED', DC: 'DC', EI: 'EI'
    }
    const porSlot = Object.fromEntries(onceRival(boca, mapa).map((o) => [o.slot, o.jugador?.nombre]))
    assert.equal(porSlot.ED, 'Langoni')
    assert.equal(porSlot.EI, 'Villa')
    assert.equal(porSlot.MC2, 'Varela')
    assert.deepEqual([porSlot.MC1, porSlot.MC3].sort(), ['Fernández', 'Ramírez'])
  })
  it('tolera plantel corto o vacío', () => {
    assert.deepEqual(onceRival([], { ARQ: 'ARQ' }), [{ slot: 'ARQ', pos: 'ARQ', jugador: null }])
    assert.deepEqual(onceRival(null, null), [])
  })
})

describe('variedad del sorteo', () => {
  it('claveRival usa temporada y cae a etiqueta', () => {
    assert.equal(claveRival({ temporada_id: 7, etiqueta: 'Boca' }), 7)
    assert.equal(claveRival({ etiqueta: 'River' }), 'River')
  })
  it('prefiere rivales poco usados dentro de cada bombo', () => {
    const top = porBombos(rivales)[0]
    const castigados = new Set(top.slice(0, 10).map((r) => r.temporada_id))
    const usos = Object.fromEntries([...castigados].map((id) => [id, 9]))
    for (let t = 0; t < 25; t++) {
      const s = sortearRivales(rivales, 19, { usos })
      const delTop = s.filter((r) => top.some((x) => x.temporada_id === r.temporada_id))
      assert.equal(delTop.length, 5)
      assert.ok(delTop.every((r) => !castigados.has(r.temporada_id)), 'eligió un rival ya muy usado')
    }
  })
  it('tope por club: no salen 6 Boca en el mismo torneo', () => {
    const conClub = rivales.map((r, i) => ({
      ...r, club: i % 9 === 0 ? 'Boca' : `Club ${i % 20}`
    }))
    for (let t = 0; t < 50; t++) {
      const s = sortearConGarantia(conClub, 29, (r) => r.club === 'Boca', { maxPorClub: 3 })
      assert.equal(s.length, 29)
      assert.equal(new Set(s.map((r) => r.temporada_id)).size, 29)
      const bocas = s.filter((r) => r.club === 'Boca').length
      assert.ok(bocas >= 1 && bocas <= 3, `Boca: ${bocas}`)
      for (const club of new Set(s.map((r) => r.club))) {
        assert.ok(s.filter((r) => r.club === club).length <= 3, `se pasó en ${club}`)
      }
    }
  })
})

describe('racha5', () => {
  it('devuelve siempre 5 casillas, más vieja a más nueva', () => {
    const ps = [
      { local: 1, visita: 2, gf: 1, gc: 0, jugado: true },
      { local: 2, visita: 1, gf: 2, gc: 2, jugado: true },
      { local: 1, visita: 3, gf: 0, gc: 3, jugado: true }
    ]
    assert.deepEqual(racha5(1, ps), ['', '', 'V', 'E', 'D'])
  })
  it('sin partidos son 5 vacíos', () => {
    assert.deepEqual(racha5(9, []), ['', '', '', '', ''])
  })
})

describe('simularPartidoLiga', () => {
  it('el favorito puede perder (no queda invicto por OVR)', () => {
    const vals = [0.05, 0.95, 0.1, 0.9]
    let i = 0
    const r = simularPartidoLiga(95, 75, { azar: () => vals[i++ % vals.length] })
    assert.ok(r.contra > r.favor, JSON.stringify(r))
  })
  it('empate de OVR no favorece artificialmente al local', () => {
    const r = simularPartidoLiga(84, 84, { local: true, azar: () => 0.5 })
    assert.ok(Math.abs(r.favor - r.contra) <= 1, JSON.stringify(r))
  })
  it('siempre devuelve goles válidos', () => {
    for (let t = 0; t < 200; t++) {
      const r = simularPartidoLiga(70 + (t % 30), 70 + ((t * 7) % 30))
      assert.ok(Number.isInteger(r.favor) && r.favor >= 0)
      assert.ok(Number.isInteger(r.contra) && r.contra >= 0)
    }
  })
})

describe('tablaHasta (reproductor de temporada)', () => {
  const ps = [
    { local: 1, visita: 2, gf: 2, gc: 0, jugado: true, fecha_n: 1 },
    { local: 3, visita: 4, gf: 1, gc: 1, jugado: true, fecha_n: 1 },
    { local: 1, visita: 3, gf: 0, gc: 1, jugado: true, fecha_n: 2 },
    { local: 2, visita: 4, gf: 3, gc: 0, jugado: false, fecha_n: 2 }
  ]
  it('solo cuenta partidos hasta la fecha pedida', () => {
    const t1 = tablaHasta([1, 2, 3, 4], ps, { fecha: 1 })
    assert.equal(t1.find((f) => f.id === 1).pts, 3)
    assert.equal(t1.find((f) => f.id === 2).pts, 0)
    const t2 = tablaHasta([1, 2, 3, 4], ps, { fecha: 2 })
    assert.equal(t2.find((f) => f.id === 3).pts, 4)
    assert.equal(t2.find((f) => f.id === 1).pts, 3)
  })
  it('desempata igual que la API: puntos → dif → GF → fair play → id', () => {
    const filas = [
      { id: 1, pts: 4, dif: 1, gf: 3, fp: 0 },
      { id: 2, pts: 4, dif: 1, gf: 3, fp: 1 },
      { id: 3, pts: 4, dif: 2, gf: 2, fp: 0 }
    ]
    const orden = [...filas].sort(desempate).map((f) => f.id)
    // El fair play es ASC en api/tabla.php: gana quien tiene menos faltas.
    assert.deepEqual(orden, [3, 1, 2])
  })
})

describe('probabilidades (casas de apuestas)', () => {
  // PRNG determinista para que el test no sea flaky.
  function rng(semilla) {
    let s = semilla
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  }
  it('suman 100 y favorecen al más fuerte', () => {
    const p = probabilidades(95, 75, { n: 2000, azar: rng(7) })
    assert.equal(p.local + p.empate + p.visita, 100)
    assert.ok(p.local > p.visita, JSON.stringify(p))
  })
  it('OVR parejo no da una ventaja absurda', () => {
    const p = probabilidades(84, 84, { n: 2000, azar: rng(11) })
    assert.ok(Math.abs(p.local - p.visita) <= 12, JSON.stringify(p))
  })
})
