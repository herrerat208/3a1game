// Reglas puras para la narrativa de árbitros, periodistas e hinchas.
// ACÁ NO HAY NOMBRES: las listas vienen de MySQL vía /prensa.php.
// Solo se decide qué nombre toca en cada partido y cómo se escribe la frase.

// Equipo al que pertenece la etiqueta del rival ("Boca 1962/63" → Boca).
export function equipoDe(f) {
  const texto = `${f?.rival ?? f?.etiqueta ?? ''}`.toLowerCase()
  if (texto.includes('boca')) return 'Boca'
  if (texto.includes('river')) return 'River'
  if (texto.includes('racing')) return 'Racing'
  return null
}

// Año de la temporada a partir de una etiqueta tipo "Boca 1962/63".
export function anioDe(f) {
  const texto = `${f?.etiqueta ?? f?.rival ?? f?.temporada ?? ''}`
  const m = texto.match(/\b(19\d{2}|20\d{2})\b/)
  return m ? Number(m[1]) : null
}

// Clave estable del partido. Los calendarios tienen id; el torneo legacy no,
// y ahí alcanza con ronda + rival + fecha.
export function claveDe(f) {
  if (!f) return ''
  const id = f.calendario_id ?? f.id
  if (id !== null && id !== undefined) return `c${id}`
  return [f.ronda ?? f.fase ?? '', f.rival ?? f.etiqueta ?? '', f.fecha_n ?? ''].join('|')
}

function hash(texto) {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function elegir(lista, clave) {
  if (!Array.isArray(lista) || !lista.length) return null
  return lista[hash(clave) % lista.length]
}

function poolPeriodistas(lista, equipoRival) {
  if (!Array.isArray(lista)) return []
  const activos = lista.filter((x) => Number(x.activo))
  const generales = activos.filter((x) => !x.equipoPreferido && !x.soloRiver)
  // "Solo River" se usa en la narrativa del equipo del usuario, que es River.
  const deRiver = activos.filter((x) => x.soloRiver)
  const preferidos = activos.filter((x) => x.equipoPreferido && x.equipoPreferido === equipoRival)
  // duplicamos los preferidos para que aparezcan más seguido contra su equipo
  return [...generales, ...deRiver, ...preferidos, ...preferidos]
}

function poolHinchas(lista, equipoRival) {
  if (!Array.isArray(lista)) return { propios: [], visitantes: [] }
  const activos = lista.filter((x) => Number(x.activo))
  return {
    propios: activos.filter((x) => x.equipo === 'River'),
    visitantes: activos.filter((x) => equipoRival && x.equipo === equipoRival)
  }
}

export function elegirPrensa(datos, f) {
  const clave = claveDe(f)
  const equipoRival = equipoDe(f)
  const arbitro = elegir(datos?.arbitros?.filter((x) => Number(x.activo)), `arb:${clave}`)
  const periodista = elegir(poolPeriodistas(datos?.periodistas, equipoRival), `per:${clave}`)
  const hinchas = poolHinchas(datos?.hinchas, equipoRival)
  const propio = elegir(hinchas.propios, `hin:${clave}:local`)
  const visitante = elegir(hinchas.visitantes, `hin:${clave}:visita`)
  const tribuna = [propio, visitante].filter(Boolean)
  if (!arbitro && !periodista && !tribuna.length) return null
  return { arbitro, periodista, tribuna }
}

function medioDe(periodista, conParentesis) {
  if (!periodista?.medio) return ''
  return conParentesis ? ` (${periodista.medio})` : ` de ${periodista.medio}`
}

function nombresTribuna(tribuna) {
  return (tribuna ?? []).map((h) => `${h.nombre} (${h.equipo})`)
}

// Línea corta para previa y diario.
export function frasePrensa(prensa) {
  if (!prensa) return ''
  const partes = []
  if (prensa.arbitro) partes.push(`Árbitro: ${prensa.arbitro.nombre}`)
  if (prensa.periodista) {
    partes.push(`Crónica: ${prensa.periodista.nombre}${medioDe(prensa.periodista, true)}`)
  }
  return partes.join(' · ')
}

// Línea corta para el post-partido.
export function fraseTribuna(prensa) {
  const nombres = nombresTribuna(prensa?.tribuna)
  return nombres.length ? `En la tribuna: ${nombres.join(' y ')}.` : ''
}

// Líneas que se insertan en el relato del partido.
export function lineasPrensa(prensa) {
  if (!prensa) return []
  const lineas = []
  if (prensa.arbitro) lineas.push(`Árbitro: ${prensa.arbitro.nombre}.`)
  if (prensa.periodista) {
    lineas.push(`La crónica corre por cuenta de ${prensa.periodista.nombre}${medioDe(prensa.periodista, false)}.`)
  }
  const tribuna = fraseTribuna(prensa)
  if (tribuna) lineas.push(tribuna)
  return lineas
}
