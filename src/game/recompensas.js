// Recompensa de los logros: una medalla por logro nuevo, acumulada en el
// navegador (sigue entre partidas y recargas). La escala aprobada es
// bronce → plata → oro → diamante; la dificultad de la partida/torneo elige
// la categoría de la medalla que se acaba de ganar.
// Compatibilidad: KEY guardaba antes un número suelto con el total de
// medallas. Ese valor se sigue leyendo y se sigue incrementando igual.
const KEY = 'recompensas_3a1'
const KEY_CATEGORIAS = 'recompensas_categorias_3a1'

// Categorías en orden creciente. Las medallas guardadas antes de esta escala
// no tenían categoría: quedan en la base (bronce), sin recalificarlas.
const MEDALLAS = [
  { clave: 'bronce', nombre: 'Bronce', icono: '🥉' },
  { clave: 'plata', nombre: 'Plata', icono: '🥈' },
  { clave: 'oro', nombre: 'Oro', icono: '🥇' },
  { clave: 'diamante', nombre: 'Diamante', icono: '💎' }
]

// Dónde se gana cada categoría, para explicar la próxima sin inventar reglas.
// También lo usa la UI de rangos como requisito visible de cada tarjeta.
export const DIFICULTAD_POR_MEDALLA = {
  bronce: 'Torneo clásico (7 partidos)',
  plata: 'Mundial',
  oro: 'Premier',
  diamante: 'Argentina (o De memoria en Premier/Argentina)'
}

// Piso por código de logro: los logros más difíciles garantizan una medalla
// de valor aunque se consigan en un formato más fácil. Nunca bajan la
// categoría que ya correspondía por la dificultad de la partida.
const PISO_MEDALLA_POR_LOGRO = {
  // Logros nuevos inferidos del detalle guardado: nivel diamante.
  cinco_goles_un_jugador: 'diamante',
  cinco_asistencias: 'diamante',
  torneo_perfecto: 'diamante',
  valla_total: 'diamante',
  clasico_doble: 'diamante',
  // Logros anteriores de dificultad intermedia: piso oro.
  diez_goles: 'oro',
  campeon_invicto: 'oro'
}

// Medalla mínima prometida por un logro. null = sigue solo la dificultad.
// La UI lo usa para mostrar el piso de cada chip; no recalcula nada guardado.
export function medallaPrometida(codigo) {
  const clave = PISO_MEDALLA_POR_LOGRO[codigo]
  return clave ? MEDALLAS.find((m) => m.clave === clave) ?? null : null
}

// Dificultad del torneo: 7 partidos < Mundial < Premier < Argentina.
// De Memoria (sin OVR) sube un escalón, hasta diamante.
const FORMATOS_DIFICULTAD = { siete: 0, copa: 1, premier: 2, liga30: 3 }
export const ETIQUETAS_FORMATO = {
  siete: 'Torneo clásico (7 partidos)',
  copa: 'Mundial',
  premier: 'Premier',
  liga30: 'Argentina'
}

export function leerMedallas() {
  try {
    const n = Number(localStorage.getItem(KEY))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

function leerCategorias() {
  try {
    const raw = localStorage.getItem(KEY_CATEGORIAS)
    if (!raw) return null
    const guardado = JSON.parse(raw)
    if (!guardado || typeof guardado !== 'object') return null
    const limpio = {}
    for (const m of MEDALLAS) {
      const n = Number(guardado[m.clave])
      limpio[m.clave] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
    }
    return limpio
  } catch {
    return null
  }
}

function guardarCategorias(conteo) {
  try { localStorage.setItem(KEY_CATEGORIAS, JSON.stringify(conteo)) } catch { /* sin storage */ }
}

// La dificultad se reconstruye de lo que ya guarda el juego por partida:
// `formato`, `almanaque` y `modo`. No hay login ni tabla de dificultad.
export function dificultadActual() {
  let formato = 'copa'
  let almanaque = false
  let modo = 'normal'
  try {
    formato = localStorage.getItem('formato') || 'copa'
    almanaque = localStorage.getItem('almanaque') === '1'
    modo = localStorage.getItem('modo') || 'normal'
  } catch { /* sin storage */ }
  if (!(formato in FORMATOS_DIFICULTAD)) formato = 'copa'
  const escalon = Math.min(
    MEDALLAS.length - 1,
    FORMATOS_DIFICULTAD[formato] + (almanaque ? 1 : 0)
  )
  const etiqueta = `${ETIQUETAS_FORMATO[formato]} · ${almanaque ? 'De memoria' : 'Clásico'}`
  return {
    formato,
    almanaque,
    modo,
    etiqueta: modo === 'carrera' ? `${etiqueta} · Carrera` : etiqueta,
    medalla: MEDALLAS[escalon]
  }
}

// `codigo` es opcional por compatibilidad: App.vue antes llamaba sin él y
// seguía usando solo la dificultad. Si llega, se combina con el piso del logro.
export function registrarMedalla(codigo = null) {
  const n = leerMedallas() + 1
  const guardadas = leerCategorias()
  const conteo = guardadas ?? Object.fromEntries(MEDALLAS.map((m) => [m.clave, 0]))
  // Las medallas de antes de esta escala no tenían categoría: quedan en la
  // base (bronce) para que el total guardado siga siendo válido.
  if (!guardadas) conteo.bronce += n - 1
  const actual = dificultadActual().medalla
  const piso = medallaPrometida(codigo)
  const indiceActual = MEDALLAS.findIndex((m) => m.clave === actual.clave)
  const indicePiso = piso ? MEDALLAS.findIndex((m) => m.clave === piso.clave) : -1
  // Mejor de las dos categorías: un piso nunca baja la medalla de la partida.
  const medalla = MEDALLAS[Math.max(indiceActual, indicePiso)]
  conteo[medalla.clave] = (conteo[medalla.clave] ?? 0) + 1
  guardarCategorias(conteo)
  try { localStorage.setItem(KEY, String(n)) } catch { /* sin storage */ }
  return n
}

export function resumenRecompensas() {
  const medallas = leerMedallas()
  const guardadas = leerCategorias()
  const desglose = MEDALLAS.map((m) => ({ ...m, cantidad: guardadas?.[m.clave] ?? 0 }))
  // El nivel es la mejor medalla efectivamente ganada, no un rango aparte.
  let idx = 0
  for (let i = 0; i < desglose.length; i++) if (desglose[i].cantidad > 0) idx = i
  const nivel = MEDALLAS[idx]
  const siguiente = MEDALLAS[idx + 1] ?? null
  return {
    medallas,
    nivel: nivel.nombre, // nombre histórico, lo sigue leyendo App.vue
    medalla: nivel,
    siguiente: siguiente?.nombre ?? null,
    siguienteDificultad: siguiente ? DIFICULTAD_POR_MEDALLA[siguiente.clave] : '',
    paraSiguiente: siguiente ? 1 : 0, // un logro en esa dificultad
    desglose,
    clasificadas: Boolean(guardadas),
    sinClasificar: guardadas ? 0 : medallas,
    dificultad: dificultadActual()
  }
}
