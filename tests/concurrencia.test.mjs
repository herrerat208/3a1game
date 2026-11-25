// 3A1 — los guardados de una fecha van en lotes, sin perder el orden.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { enLotes } from '../src/game/concurrencia.js'

describe('enLotes', () => {
  it('procesa todos los items y devuelve los resultados en orden', async () => {
    const res = await enLotes([1, 2, 3, 4, 5, 6, 7], 3, async (n) => n * 2)
    assert.deepEqual(res, [2, 4, 6, 8, 10, 12, 14])
  })

  it('nunca supera el tamaño del lote', async () => {
    let activos = 0
    let pico = 0
    await enLotes(Array.from({ length: 12 }, (_, i) => i), 4, async () => {
      activos++
      pico = Math.max(pico, activos)
      await Promise.resolve()
      activos--
    })
    assert.equal(pico, 4)
  })

  it('lista vacía no llama a nada', async () => {
    let llamadas = 0
    assert.deepEqual(await enLotes([], 5, async () => { llamadas++ }), [])
    assert.equal(llamadas, 0)
  })
})
