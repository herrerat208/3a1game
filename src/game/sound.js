let ctx = null
let on = true

export function setSonido(v) {
  on = v
}

function beep(freq, ms, delay = 0, type = 'sine', gain = 0.15) {
  if (!on) return
  try {
    ctx = ctx ?? new (window.AudioContext || window.webkitAudioContext)()
    const t = ctx.currentTime + delay
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000)
    o.connect(g)
    g.connect(ctx.destination)
    o.start(t)
    o.stop(t + ms / 1000)
  } catch {
    /* sin audio disponible */
  }
}

export const sonidoConfirmar = () => beep(660, 120)
export const sonidoGol = () => {
  beep(523, 150)
  beep(659, 150, 0.12)
  beep(784, 300, 0.24)
}
export const sonidoSilbato = () => beep(2200, 400, 0, 'square', 0.06)
export const sonidoCampeon = () => {
  ;[523, 659, 784, 1047].forEach((f, i) => beep(f, 250, i * 0.18))
}
export const sonidoError = () => beep(220, 200, 0, 'sawtooth', 0.08)
