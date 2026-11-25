<script setup>
import { ref } from 'vue'
import { registrar, ingresar } from '../services/auth.js'

const emit = defineEmits(['cerrar'])
const modo = ref('ingresar')
const alias = ref('')
const password = ref('')
const error = ref('')
const ocupado = ref(false)

async function enviar() {
  if (ocupado.value) return
  error.value = ''
  if (!alias.value.trim() || !password.value) {
    error.value = 'Completá el alias y la contraseña.'
    return
  }
  ocupado.value = true
  try {
    if (modo.value === 'registrar') await registrar(alias.value.trim(), password.value)
    else await ingresar(alias.value.trim(), password.value)
    emit('cerrar')
  } catch (e) {
    error.value = e.message
  } finally {
    ocupado.value = false
  }
}
function cerrar() { if (!ocupado.value) emit('cerrar') }
</script>

<template>
  <div class="auth-velo" @click.self="cerrar">
    <div class="auth-caja" role="dialog" aria-modal="true" aria-label="Ingresar a 3A1">
      <button class="auth-x" type="button" aria-label="Cerrar" @click="cerrar">×</button>
      <span class="auth-eyebrow">Sistema conectado</span>
      <h2>{{ modo === 'ingresar' ? 'Ingresá' : 'Creá tu cuenta' }}</h2>
      <p class="auth-intro">
        Tu partida se guarda con tu alias y aparece en el ranking compartido.
      </p>

      <div class="auth-tabs" role="tablist">
        <button type="button" role="tab" :aria-selected="modo === 'ingresar'"
                :class="{ on: modo === 'ingresar' }" @click="modo = 'ingresar'; error = ''">Ingresar</button>
        <button type="button" role="tab" :aria-selected="modo === 'registrar'"
                :class="{ on: modo === 'registrar' }" @click="modo = 'registrar'; error = ''">Crear cuenta</button>
      </div>

      <form @submit.prevent="enviar">
        <label for="auth-alias">Alias</label>
        <input id="auth-alias" v-model="alias" type="text" autocomplete="username"
               minlength="3" maxlength="40" required />
        <label for="auth-clave">Contraseña</label>
        <input id="auth-clave" v-model="password" type="password"
               :autocomplete="modo === 'registrar' ? 'new-password' : 'current-password'"
               minlength="8" required />
        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
        <button class="auth-enviar" type="submit" :disabled="ocupado">
          {{ ocupado ? 'Un momento…' : modo === 'ingresar' ? 'Ingresar' : 'Crear cuenta y entrar' }}
        </button>
      </form>
      <p class="auth-nota">El permiso de administrador se asigna en el servidor, no se elige acá.</p>
    </div>
  </div>
</template>

<style scoped>
.auth-velo {
  position: fixed; inset: 0; z-index: 90;
  display: grid; place-items: center; padding: 16px;
  background: rgba(28, 24, 20, .52);
}
.auth-caja {
  position: relative; width: min(420px, 100%);
  padding: 28px; background: var(--superficie, #f7f4ec);
  border: 1px solid var(--linea, #d5cec0); border-top: 4px solid var(--rojo, #b3122b);
  box-shadow: 0 24px 60px rgba(0, 0, 0, .25);
}
.auth-x {
  position: absolute; top: 8px; right: 10px; width: 32px; height: 32px;
  border: 0; background: transparent; color: var(--texto-suave, #6e675d);
  font-size: 24px; cursor: pointer;
}
.auth-eyebrow { font: 600 10px var(--label, sans-serif); letter-spacing: .14em; text-transform: uppercase; color: var(--texto-suave, #6e675d); }
.auth-caja h2 { margin: 8px 0 6px; font: 700 34px/.95 var(--display, sans-serif); text-transform: uppercase; color: var(--tinta, #1f1d1a); }
.auth-intro { margin: 0 0 18px; font-size: 13px; line-height: 1.5; color: var(--texto-suave, #6e675d); }
.auth-tabs { display: flex; gap: 4px; margin-bottom: 16px; }
.auth-tabs button {
  flex: 1; min-height: 38px; border: 1px solid var(--linea, #d5cec0);
  background: var(--fondo, #ece8dc); color: var(--texto-suave, #6e675d);
  font: 600 12px var(--texto, sans-serif); cursor: pointer;
}
.auth-tabs button.on { border-color: var(--rojo, #b3122b); background: var(--rojo, #b3122b); color: #fff; }
.auth-caja form { display: flex; flex-direction: column; gap: 6px; }
.auth-caja label { font: 600 10px var(--label, sans-serif); letter-spacing: .1em; text-transform: uppercase; color: var(--texto-suave, #6e675d); }
.auth-caja input {
  min-height: 42px; padding: 0 10px; margin-bottom: 6px;
  border: 1px solid var(--linea, #d5cec0); background: var(--fondo, #ece8dc);
  color: var(--tinta, #1f1d1a); font: 500 14px var(--texto, sans-serif);
}
.auth-error { margin: 4px 0; color: var(--rojo, #b3122b); font-size: 12px; }
.auth-enviar {
  min-height: 44px; margin-top: 6px; border: 0;
  background: var(--tinta, #1f1d1a); color: var(--fondo, #ece8dc);
  font: 700 13px var(--texto, sans-serif); cursor: pointer;
}
.auth-enviar:disabled { opacity: .55; cursor: wait; }
.auth-nota { margin: 14px 0 0; font-size: 11px; color: var(--texto-tenue, #999); }
</style>
