// Etiqueta breve para fichas y alineaciones: nombre de pila + apellido.
// No alcanza con cortar el primer nombre: "Guillermo Matías Fernández" debe
// mostrarse como "Guillermo Fernández", no como "Matías Fernández".
const PARTICULAS = new Set(['de', 'del', 'di', 'da', 'das', 'do', 'dos', 'van', 'von', 'la', 'le'])

export function nombreCorto(nombre) {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 2) return partes.join(' ')
  const penultimo = partes[partes.length - 2].toLowerCase()
  const desde = PARTICULAS.has(penultimo) ? partes.length - 2 : partes.length - 1
  return `${partes[0]} ${partes.slice(desde).join(' ')}`
}
