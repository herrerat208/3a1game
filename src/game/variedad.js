// Historial local de rivales usados. Solo preferencias: nunca bloquea un rival,
// así un sorteo siempre puede completarse aunque ya se usaron todos.
const KEY = 'rivales_usados_3a1'

export function claveRival(rival) {
  return rival?.temporada_id ?? rival?.id ?? rival?.etiqueta ?? ''
}

export function leerUsosRivales() {
  try {
    const usos = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return usos && typeof usos === 'object' && !Array.isArray(usos) ? usos : {}
  } catch {
    return {}
  }
}

export function registrarRivales(rivales) {
  const usos = leerUsosRivales()
  for (const r of rivales ?? []) {
    const k = claveRival(r)
    if (k) usos[k] = (usos[k] ?? 0) + 1
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(usos))
  } catch { /* sin storage */ }
  return usos
}

// Menos usados primero; dentro de igual uso el orden ya viene mezclado.
export function ordenPorVariedad(rivales, usos = {}) {
  return [...rivales].sort((a, b) =>
    (usos[claveRival(a)] ?? 0) - (usos[claveRival(b)] ?? 0))
}
