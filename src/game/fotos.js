export function fotoDe(j) {
  if (!j) return null
  return j.foto_epoca ?? j.foto_url ?? null
}

export function esFotoEpoca(j) {
  return !!j?.foto_epoca
}

export function anioFotoDe(j, anioTemporada = null) {
  return j?.foto_anio ?? anioTemporada
}

// Escudo elegido para "River Plate" (siempre es el mismo equipo: no hay otro
// River en el juego). Se guarda en localStorage y es reactivo entre vistas.
import { ref } from 'vue'

const CLAVE_ESCUDO_MIO = '3a1:escudoMio'
export const ESCUDO_MIO_DEFAULT = '/escudos/river-2021-a-actualidad.webp'

// Todos los escudos son WebP sin fondo. Los elegidos durante el cambio previo
// quedaron en .png en localStorage: se migran de vuelta al WebP transparente.
function migrarEscudoWebp(url) {
  return url && url.endsWith('.png') ? url.replace(/\.png$/, '.webp') : url
}
function leerEscudoMio() {
  try {
    const guardado = localStorage.getItem(CLAVE_ESCUDO_MIO)
    const url = migrarEscudoWebp(guardado) || ESCUDO_MIO_DEFAULT
    if (guardado && guardado !== url) localStorage.setItem(CLAVE_ESCUDO_MIO, url)
    return url
  } catch {
    return ESCUDO_MIO_DEFAULT
  }
}
export const escudoMioUrl = ref(leerEscudoMio())
export function escudoMio() { return escudoMioUrl.value }
export function elegirEscudoMio(url) {
  if (!url) return
  const migrado = migrarEscudoWebp(url)
  escudoMioUrl.value = migrado
  try { localStorage.setItem(CLAVE_ESCUDO_MIO, migrado) } catch { /* sin storage */ }
}

// Escudo histórico del año, sin reemplazar por el elegido. Sirve para mostrar
// de qué época de River salió el plantel sorteado.
export function escudoEpocaDe(e) {
  if (!e) return null
  return e.escudo_epoca ?? e.escudo ?? null
}

export function escudoDe(e) {
  if (!e) return null
  // Todo River es el equipo del usuario: usa el escudo elegido.
  if (e.es_usuario || e.es_river || e.club === 'River Plate' || /^(?:Tu\s+)?River\b/i.test(String(e.etiqueta ?? ''))) {
    return escudoMioUrl.value
  }
  return e.escudo_epoca ?? e.escudo ?? null
}

// Si una foto (local o remota) falla, mostrar la inicial en vez de dejar un
// hueco en la lista. Mantiene las clases que ya estiliza cada componente.
export function fallbackInicial(evento, jugador, clase = 'ini') {
  const img = evento.target
  const span = document.createElement('span')
  span.className = clase
  span.textContent = jugador?.nombre?.charAt(0) ?? '·'
  img.replaceWith(span)
}
