// 3A1 — tests de la narrativa de árbitros, periodistas e hinchas.
// Los datos son genéricos: los nombres reales viven en MySQL.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { claveDe, elegirPrensa, frasePrensa, fraseTribuna, lineasPrensa } from '../src/game/prensa.js'

const datos = {
  arbitros: [
    { id: 1, nombre: 'A1', activo: 1 },
    { id: 2, nombre: 'A2', activo: 1 }
  ],
  periodistas: [
    { id: 1, nombre: 'P1', medio: null, equipoPreferido: null, soloRiver: 0, activo: 1 },
    { id: 2, nombre: 'P2', medio: null, equipoPreferido: 'Boca', soloRiver: 0, activo: 1 },
    { id: 3, nombre: 'P3', medio: null, equipoPreferido: null, soloRiver: 1, activo: 1 }
  ],
  hinchas: [
    { id: 1, nombre: 'H1', equipo: 'River', activo: 1 },
    { id: 2, nombre: 'H2', equipo: 'Boca', activo: 1 }
  ]
}

describe('claveDe', () => {
  it('usa el id del calendario cuando está disponible', () => {
    assert.equal(claveDe({ id: 7, rival: 'Boca 1962/63' }), 'c7')
    assert.equal(claveDe({ calendario_id: 7, rival: 'Otro' }), 'c7')
  })
  it('cae a ronda + rival + fecha en el torneo legacy', () => {
    assert.equal(claveDe({ ronda: 'Final', rival: 'Boca 1962/63', fecha_n: 3 }), 'Final|Boca 1962/63|3')
  })
})

describe('elegirPrensa', () => {
  it('es determinista para el mismo partido', () => {
    const partido = { id: 42, rival: 'Racing 2018/19' }
    const a = elegirPrensa(datos, partido)
    const b = elegirPrensa(datos, partido)
    assert.equal(a.arbitro.nombre, b.arbitro.nombre)
    assert.equal(a.periodista.nombre, b.periodista.nombre)
    assert.deepEqual(a.tribuna.map((h) => h.nombre), b.tribuna.map((h) => h.nombre))
  })
  it('incluye un hincha del rival cuando juega su equipo', () => {
    const p = elegirPrensa(datos, { id: 9, rival: 'Boca 1962/63' })
    assert.equal(p.tribuna.length, 2)
    assert.ok(p.tribuna.some((h) => h.equipo === 'Boca'))
  })
  it('sin rival conocido solo muestra hinchas propios', () => {
    const p = elegirPrensa(datos, { id: 9, rival: 'Independiente 1994/95' })
    assert.equal(p.tribuna.length, 1)
    assert.equal(p.tribuna[0].equipo, 'River')
  })
  it('no falla sin datos de la API', () => {
    assert.equal(elegirPrensa(null, { id: 1, rival: 'Boca' }), null)
  })
})

describe('frases de prensa', () => {
  const prensa = elegirPrensa(datos, { id: 1, rival: 'Boca 1962/63' })
  it('la previa nombra árbitro y cronista', () => {
    assert.match(frasePrensa(prensa), /^Árbitro: .+ · Crónica: .+$/)
  })
  it('el relato incluye árbitro, cronista y tribuna', () => {
    const lineas = lineasPrensa(prensa)
    assert.equal(lineas.length, 3)
    assert.match(lineas[0], /^Árbitro: /)
    assert.match(lineas[1], /^La crónica corre por cuenta de /)
    assert.match(lineas[2], /^En la tribuna: /)
  })
  it('sin prensa no agrega líneas', () => {
    assert.equal(frasePrensa(null), '')
    assert.equal(fraseTribuna(null), '')
    assert.deepEqual(lineasPrensa(null), [])
  })
})
