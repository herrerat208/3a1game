const KEY = 'palmares_3a1'
const KEY_CLASICO = 'clasico_racha'

export function leerPalmares() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function registrarTitulo({ formato, campeon, valla = false, mvp = null }) {
  const lista = leerPalmares()
  lista.push({
    formato,
    campeon,
    valla,
    mvp,
    fecha: new Date().toISOString().slice(0, 10)
  })
  try {
    localStorage.setItem(KEY, JSON.stringify(lista))
  } catch { /* sin storage */ }
  return lista
}

export function resumenPalmares() {
  const lista = leerPalmares()
  const porFormato = {}
  for (const r of lista) {
    const f = porFormato[r.formato] ?? { jugados: 0, titulos: 0, vallas: 0 }
    f.jugados++
    if (r.campeon) f.titulos++
    if (r.valla) f.vallas++
    porFormato[r.formato] = f
  }
  return { total: lista.length, porFormato, lista: lista.slice(-10).reverse() }
}

export function leerRachaClasico() {
  try {
    return JSON.parse(localStorage.getItem(KEY_CLASICO) ?? '{"g":0,"e":0,"p":0}')
  } catch {
    return { g: 0, e: 0, p: 0 }
  }
}

export function registrarClasico(resultado) {
  const r = leerRachaClasico()
  if (resultado === 'g') r.g++
  else if (resultado === 'e') r.e++
  else r.p++
  try {
    localStorage.setItem(KEY_CLASICO, JSON.stringify(r))
  } catch { /* sin storage */ }
  return r
}
