// 3A1 — Regla de amarillas: cada 2 amarillas se pierde la fecha siguiente.
// No se resetea el contador: el total se conserva para el fair play de la tabla.
export const AMARILLAS_POR_SUSPENSION = 2

export function suspensionPorAmarilla(previas, fechaActual) {
  const total = Number(previas ?? 0) + 1
  return total % AMARILLAS_POR_SUSPENSION === 0 ? Number(fechaActual) + 1 : 0
}
