// Corre varias promesas en lotes pequeños. En hosting compartido (InfinityFree)
// una fecha tiene 8-15 partidos: mandarlos de a uno hace esperar 10-20s, y
// mandarlos todos juntos puede disparar el límite de peticiones. Lotes de 5.
export async function enLotes(items, tamano, fn) {
  const resultados = []
  for (let i = 0; i < items.length; i += tamano) {
    resultados.push(...await Promise.all(items.slice(i, i + tamano).map(fn)))
  }
  return resultados
}
