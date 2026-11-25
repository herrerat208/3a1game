import { onMounted, ref } from 'vue'
import { obtenerPrensa } from './api.js'
import { elegirPrensa, frasePrensa, fraseTribuna } from '../game/prensa.js'

// Puente entre la API y las reglas puras. Cada vista llama a usePrensa():
// la petición se comparte (caché en api.js) y los nombres siguen viniendo
// de MySQL, nunca hardcodeados en el frontend.
export function usePrensa() {
  const datos = ref(null)
  const cacheTextos = new Map()

  async function cargar() {
    try {
      datos.value = await obtenerPrensa()
    } catch {
      // Sin API la narrativa simplemente no se muestra; el partido sigue igual.
      datos.value = null
    }
    // La primera evaluación del template puede ocurrir antes de que llegue la
    // prensa: descartamos esa caché para no quedarnos con textos vacíos.
    cacheTextos.clear()
  }

  onMounted(cargar)

  function para(partido) {
    const clave = `${partido?.id ?? partido?.rival ?? ''}|${partido?.fecha_n ?? ''}|${partido?.fase ?? ''}|${partido?.local_id ?? ''}|${partido?.visita_id ?? ''}`
    if (!cacheTextos.has(clave)) cacheTextos.set(clave, elegirPrensa(datos.value, partido))
    return cacheTextos.get(clave)
  }
  function texto(partido) {
    const clave = `t:${partido?.id ?? partido?.rival ?? ''}|${partido?.fecha_n ?? ''}|${partido?.fase ?? ''}|${partido?.local_id ?? ''}|${partido?.visita_id ?? ''}`
    if (!cacheTextos.has(clave)) cacheTextos.set(clave, frasePrensa(para(partido)))
    return cacheTextos.get(clave)
  }
  function tribuna(partido) {
    const clave = `c:${partido?.id ?? partido?.rival ?? ''}|${partido?.fecha_n ?? ''}|${partido?.fase ?? ''}|${partido?.local_id ?? ''}|${partido?.visita_id ?? ''}`
    if (!cacheTextos.has(clave)) cacheTextos.set(clave, fraseTribuna(para(partido)))
    return cacheTextos.get(clave)
  }

  return { datos, cargar, para, texto, tribuna }
}
