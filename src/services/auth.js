import { ref } from 'vue'
import {
  obtenerCsrf, obtenerYo, iniciarSesion, registrarUsuario, cerrarSesion
} from './api.js'

// Un solo estado compartido: la navbar y el juego ven al mismo usuario.
// La identidad siempre vuelve del servidor (/me.php), nunca de localStorage.
export const usuario = ref(null)
export const cargandoSesion = ref(true)
export const errorSesion = ref('')

export async function cargarSesion() {
  cargandoSesion.value = true
  errorSesion.value = ''
  try {
    await obtenerCsrf()
    usuario.value = await obtenerYo()
  } catch (error) {
    errorSesion.value = error.message
  } finally {
    cargandoSesion.value = false
  }
}

export async function ingresar(alias, password) {
  const u = await iniciarSesion(alias, password)
  usuario.value = u
  return u
}

export async function registrar(alias, password) {
  const u = await registrarUsuario(alias, password)
  usuario.value = u
  return u
}

export async function salir() {
  try { await cerrarSesion() } finally { usuario.value = null }
}
