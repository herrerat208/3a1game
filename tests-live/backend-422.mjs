// 3A1 — test live del backend (requiere Apache + MySQL con la base 3a1).
// Correr: npm run test:backend
// Si el backend no responde, el test se salta (skip) en vez de fallar:
// el CI offline sigue verde con `npm test` (motor).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const API = process.env.API_URL ?? 'http://localhost/3a1-api'

async function api(ruta, opciones) {
  const r = await fetch(`${API}${ruta}`, opciones)
  let datos = null
  try {
    datos = await r.json()
  } catch {
    datos = null
  }
  return { status: r.status, datos }
}

const post = (ruta, body) => api(ruta, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})

let hayBackend = false
try {
  const r = await api('/formaciones.php')
  hayBackend = r.status === 200 && !!r.datos?.formaciones
} catch {
  hayBackend = false
}

describe('backend 3a1 (live)', { skip: !hayBackend && 'sin backend en ' + API }, () => {
  let partidaId = 0
  let formaciones = {}
  let plantel = []
  let temporadaId = 0

  it('formaciones trae 10 elegibles + estilos', async () => {
    const { status, datos } = await api('/formaciones.php')
    assert.equal(status, 200)
    assert.equal(Object.keys(datos.formaciones).length, 10)
    assert.ok(datos.estilos.includes('equilibrado'))
    formaciones = datos.formaciones
  })

  it('crear partida con formación inválida → 422', async () => {
    const { status } = await post('/partidas.php', {
      nombre_equipo: 'TEST-backend',
      formacion: '1-1-1',
      estilo: 'equilibrado'
    })
    assert.equal(status, 422)
  })

  it('modo/formato inválidos → 422; banco SUP fuera de tope → 422', async () => {
    assert.equal((await post('/partidas.php', {
      nombre_equipo: 'TEST-backend', formacion: '4-4-2', modo: 'raro'
    })).status, 422)
    assert.equal((await post('/partidas.php', {
      nombre_equipo: 'TEST-backend', formacion: '4-4-2', formato: 'raro'
    })).status, 422)
    // torneo sin usuario único → 422
    assert.equal((await post('/torneo.php', {
      partida_id: 999999, formato: 'premier', participantes: [], calendario: []
    })).status, 400)
    // goles negativos → 400
    assert.equal((await post('/calendario.php', {
      calendario_id: 1, gf: -1, gc: 0
    })).status, 400)
    // sanción sin datos → 400
    assert.equal((await post('/sanciones.php', { torneo_id: 0, temporada_jugador_id: 0 })).status, 400)
    // intercambio sin datos → 400
    assert.equal((await post('/intercambiar.php', { partida_id: 0, slot_a: 'ARQ', slot_b: 'SUP1' })).status, 400)
  })

  it('flujo feliz: crear partida + guardar jugador', async () => {
    const c = await post('/partidas.php', {
      nombre_equipo: 'TEST-backend ' + new Date().toISOString(),
      formacion: '4-4-2',
      estilo: 'equilibrado'
    })
    assert.equal(c.status, 200)
    partidaId = Number(c.datos.id)
    assert.ok(partidaId > 0)

    const s = await api(`/sorteo.php?partida_id=${partidaId}&solo_river=1`)
    assert.equal(s.status, 200)
    temporadaId = s.datos.temporada_id

    const j = await api(`/jugadores.php?temporada_id=${temporadaId}`)
    assert.equal(j.status, 200)
    assert.ok(j.datos.length > 0)
    plantel = j.datos
  })

  it('slot inexistente → 422', async () => {
    const { status } = await post('/guardar_jugador.php', {
      partida_id: partidaId,
      temporada_jugador_id: plantel[0].temporada_jugador_id,
      slot: 'ARCO_FALSO'
    })
    assert.equal(status, 422)
  })

  it('jugador incompatible → 422 y compatible → 200', async () => {
    const mapa442 = formaciones['4-4-2']
    const slots = Object.entries(mapa442)
    // Buscar un jugador y un slot incompatibles entre sí.
    let caso422 = null
    outer: for (const cand of plantel) {
      const sec = String(cand.posiciones_secundarias ?? '').split(',').map((x) => x.trim())
      for (const [slot, pos] of slots) {
        if (cand.posicion_natural !== pos && !sec.includes(pos)) {
          caso422 = { tj: cand.temporada_jugador_id, slot }
          break outer
        }
      }
    }
    assert.ok(caso422, 'el plantel debería tener algún jugador incompatible con algún slot')
    const r422 = await post('/guardar_jugador.php', {
      partida_id: partidaId,
      temporada_jugador_id: caso422.tj,
      slot: caso422.slot
    })
    assert.equal(r422.status, 422)

    // Compatible: buscar slot libre que acepte al primer jugador compatible.
    const equipo = await api(`/equipo.php?partida_id=${partidaId}`)
    assert.equal(equipo.status, 200)
    const usados = new Set(equipo.datos.map((x) => x.temporada_jugador_id))
    const libre = plantel.find((x) => !usados.has(x.temporada_jugador_id))
    const sec = String(libre.posiciones_secundarias ?? '').split(',').map((x) => x.trim())
    const slotOk = slots.find(([slot, pos]) =>
      (libre.posicion_natural === pos || sec.includes(pos)) &&
      !equipo.datos.some((x) => x.slot === slot))?.[0]
    assert.ok(slotOk, 'debería haber un slot compatible libre')
    const ok = await post('/guardar_jugador.php', {
      partida_id: partidaId,
      temporada_jugador_id: libre.temporada_jugador_id,
      slot: slotOk
    })
    assert.equal(ok.status, 200)

    // Repetir el mismo jugador en otro slot COMPATIBLE → 409
    // (si el slot fuera incompatible el 422 taparía el duplicado).
    const otroSlot = slots.find(([slot, pos]) =>
      slot !== slotOk &&
      (libre.posicion_natural === pos || sec.includes(pos)) &&
      !equipo.datos.some((x) => x.slot === slot))?.[0]
    if (otroSlot) {
      const dup = await post('/guardar_jugador.php', {
        partida_id: partidaId,
        temporada_jugador_id: libre.temporada_jugador_id,
        slot: otroSlot
      })
      assert.equal(dup.status, 409)
      assert.match(dup.datos.error, /ya fue elegido/)
    }
  })

  it('banco con cobertura: incompatible → 422, 3er mismo puesto → 422', async () => {
    const mapa442 = formaciones['4-4-2']
    const codigos = [...new Set(Object.values(mapa442))]
    const equipo = (await api(`/equipo.php?partida_id=${partidaId}`)).datos
    const usados = new Set(equipo.map((x) => x.temporada_jugador_id))
    const secDe = (c) => String(c.posiciones_secundarias ?? '').split(',').map((x) => x.trim())
    const cubre = (c) => codigos.some((pos) => c.posicion_natural === pos || secDe(c).includes(pos))
    // Suplente que no cubre ningún puesto del 4-4-2 → 422.
    // El plantel sorteado puede no traer especialistas: probar otros sorteos.
    let pidCobertura = partidaId
    let sinCobertura = plantel.find((c) => !usados.has(c.temporada_jugador_id) && !cubre(c))
    for (let intento = 0; intento < 8 && !sinCobertura; intento++) {
      const p2 = await post('/partidas.php', {
        nombre_equipo: 'TEST-cobertura ' + Date.now() + '-' + intento,
        formacion: '4-4-2', estilo: 'equilibrado'
      })
      if (p2.status !== 200) continue
      const s2 = await api(`/sorteo.php?partida_id=${p2.datos.id}&solo_river=1`)
      if (s2.status !== 200) continue
      const j2 = await api(`/jugadores.php?temporada_id=${s2.datos.temporada_id}`)
      if (j2.status !== 200) continue
      sinCobertura = (j2.datos ?? []).find((c) => !cubre(c))
      if (sinCobertura) pidCobertura = Number(p2.datos.id)
    }
    assert.ok(sinCobertura, 'ningún plantel trajo un especialista sin cobertura en 4-4-2')
    const rCobertura = await post('/guardar_jugador.php', {
      partida_id: pidCobertura,
      temporada_jugador_id: sinCobertura.temporada_jugador_id,
      slot: 'SUP1'
    })
    assert.equal(rCobertura.status, 422)
    assert.match(rCobertura.datos.error, /no cubre/)
    // 2 del mismo puesto natural entran; el 3ero → 422.
    // Buscar un plantel con 3+ del mismo puesto (puede no salir a la primera).
    let pidTrio = partidaId
    let trio = null
    const buscarTrio = (lista) => {
      const porPuesto = {}
      for (const c of lista) {
        if (!cubre(c)) continue
        ;(porPuesto[c.posicion_natural] ??= []).push(c)
      }
      return Object.values(porPuesto).find((g) => g.length >= 3) ?? null
    }
    trio = buscarTrio(plantel.filter((c) => !usados.has(c.temporada_jugador_id)))
    for (let intento = 0; intento < 8 && !trio; intento++) {
      const p3 = await post('/partidas.php', {
        nombre_equipo: 'TEST-trio ' + Date.now() + '-' + intento,
        formacion: '4-4-2', estilo: 'equilibrado'
      })
      if (p3.status !== 200) continue
      const s3 = await api(`/sorteo.php?partida_id=${p3.datos.id}&solo_river=1`)
      if (s3.status !== 200) continue
      const j3 = await api(`/jugadores.php?temporada_id=${s3.datos.temporada_id}`)
      if (j3.status !== 200) continue
      trio = buscarTrio(j3.datos ?? [])
      if (trio) pidTrio = Number(p3.datos.id)
    }
    assert.ok(trio, 'ningún plantel trajo 3+ del mismo puesto con cobertura')
    assert.equal((await post('/guardar_jugador.php', {
      partida_id: pidTrio, temporada_jugador_id: trio[0].temporada_jugador_id, slot: 'SUP1'
    })).status, 200)
    assert.equal((await post('/guardar_jugador.php', {
      partida_id: pidTrio, temporada_jugador_id: trio[1].temporada_jugador_id, slot: 'SUP2'
    })).status, 200)
    const tercero = await post('/guardar_jugador.php', {
      partida_id: pidTrio, temporada_jugador_id: trio[2].temporada_jugador_id, slot: 'SUP3'
    })
    assert.equal(tercero.status, 422)
    assert.match(tercero.datos.error, /2 suplentes/)
  })

  it('dorsales: 0/100 → 422, slot vacío → 404, duplicado → 409, liberar → 200', async () => {
    const dorsal = (body) => post('/setear_dorsal.php', { partida_id: partidaId, ...body })
    const eq = (await api(`/equipo.php?partida_id=${partidaId}`)).datos
    assert.ok(eq.length >= 1)
    const slot1 = eq[0].slot
    assert.equal((await dorsal({ slot: slot1, dorsal: 0 })).status, 422)
    assert.equal((await dorsal({ slot: slot1, dorsal: 100 })).status, 422)
    assert.equal((await dorsal({ slot: 'LIBRE_X', dorsal: 5 })).status, 404)
    assert.equal((await dorsal({ slot: slot1, dorsal: 10 })).status, 200)
    const eq2 = (await api(`/equipo.php?partida_id=${partidaId}`)).datos
    assert.equal(eq2.find((x) => x.slot === slot1).dorsal_elegido, 10)

    // Segundo jugador para probar duplicado.
    const mapa = formaciones['4-4-2']
    const slots = Object.entries(mapa)
    const usados = new Set(eq2.map((x) => x.temporada_jugador_id))
    const cand = plantel.find((x) => !usados.has(x.temporada_jugador_id))
    if (cand) {
      const sec = String(cand.posiciones_secundarias ?? '').split(',').map((x) => x.trim())
      const slot2 = slots.find(([slot, pos]) =>
        (cand.posicion_natural === pos || sec.includes(pos)) &&
        !eq2.some((x) => x.slot === slot))?.[0]
      if (slot2) {
        assert.equal((await post('/guardar_jugador.php', {
          partida_id: partidaId, temporada_jugador_id: cand.temporada_jugador_id, slot: slot2
        })).status, 200)
        assert.equal((await dorsal({ slot: slot2, dorsal: 10 })).status, 409)
        assert.equal((await dorsal({ slot: slot2, dorsal: 11 })).status, 200)
      }
    }
    // Liberar.
    assert.equal((await dorsal({ slot: slot1, dorsal: null })).status, 200)
    const eq3 = (await api(`/equipo.php?partida_id=${partidaId}`)).datos
    assert.equal(eq3.find((x) => x.slot === slot1).dorsal_elegido, null)
  })
})
