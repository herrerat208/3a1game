export const PITCH_COORDS = {
  '4-4-2': {
    ARQ: [50, 92], LD: [85, 72], DFC1: [38, 74], DFC2: [62, 74], LI: [15, 72],
    MD: [88, 48], MC1: [38, 50], MC2: [62, 50], MI: [12, 48],
    DC1: [35, 22], DC2: [65, 22]
  },
  '4-3-3': {
    ARQ: [50, 92], LD: [85, 72], DFC1: [38, 74], DFC2: [62, 74], LI: [15, 72],
    MC1: [25, 50], MC2: [50, 52], MC3: [75, 50],
    ED: [85, 22], DC: [50, 18], EI: [15, 22]
  },
  '4-2-3-1': {
    ARQ: [50, 92], LD: [85, 72], DFC1: [38, 74], DFC2: [62, 74], LI: [15, 72],
    MCD1: [38, 62], MCD2: [62, 62], ED: [85, 38], MCO: [50, 36], EI: [15, 38],
    DC: [50, 16]
  },
  '4-2-4': {
    ARQ: [50, 92], LD: [85, 72], DFC1: [38, 74], DFC2: [62, 74], LI: [15, 72],
    MC1: [38, 58], MC2: [62, 58],
    ED: [88, 30], DC1: [38, 24], DC2: [62, 24], EI: [12, 30]
  },
  '3-5-2': {
    ARQ: [50, 92], DFC1: [25, 74], DFC2: [50, 76], DFC3: [75, 74],
    MD: [92, 50], MC1: [32, 52], MC2: [50, 54], MC3: [68, 52], MI: [8, 50],
    DC1: [35, 22], DC2: [65, 22]
  },
  '5-3-2': {
    ARQ: [50, 92], LD: [92, 68], DFC1: [30, 74], DFC2: [50, 76], DFC3: [70, 74], LI: [8, 68],
    MC1: [30, 50], MC2: [50, 52], MC3: [70, 50],
    DC1: [35, 22], DC2: [65, 22]
  },
  '4-5-1': {
    ARQ: [50, 92], LD: [85, 72], DFC1: [38, 74], DFC2: [62, 74], LI: [15, 72],
    MD: [92, 48], MC1: [30, 50], MC2: [50, 52], MC3: [70, 50], MI: [8, 48],
    DC: [50, 18]
  },
  '3-4-3': {
    ARQ: [50, 92], DFC1: [25, 74], DFC2: [50, 76], DFC3: [75, 74],
    MD: [88, 52], MC1: [38, 54], MC2: [62, 54], MI: [12, 52],
    ED: [85, 24], DC: [50, 18], EI: [15, 24]
  },
  '2-3-5': {
    ARQ: [50, 92], DFC1: [35, 74], DFC2: [65, 74],
    MD: [80, 52], MC: [50, 54], MI: [20, 52],
    ED: [92, 26], DC1: [32, 20], DC2: [50, 18], DC3: [68, 20], EI: [8, 26]
  },
  '3-2-5': {
    ARQ: [50, 92], DFC1: [25, 74], DFC2: [50, 76], DFC3: [75, 74],
    MC1: [35, 54], MC2: [65, 54],
    ED: [92, 26], DC1: [32, 20], DC2: [50, 18], DC3: [68, 20], EI: [8, 26]
  },
  '4-3-1-2': {
    ARQ: [50, 92], LD: [85, 72], DFC1: [38, 74], DFC2: [62, 74], LI: [15, 72],
    MC1: [25, 52], MC2: [50, 54], MC3: [75, 52], MCO: [50, 36],
    DC1: [35, 20], DC2: [65, 20]
  },
  '4-1-2-1-2': {
    ARQ: [50, 92], LD: [85, 72], DFC1: [38, 74], DFC2: [62, 74], LI: [15, 72],
    MCD: [50, 64], MC1: [35, 52], MC2: [65, 52], MCO: [50, 38],
    DC1: [35, 22], DC2: [65, 22]
  },
  '4-2-2-2': {
    ARQ: [50, 92], LD: [85, 72], DFC1: [38, 74], DFC2: [62, 74], LI: [15, 72],
    MCD1: [38, 62], MCD2: [62, 62], MD: [85, 42], MI: [15, 42],
    DC1: [35, 22], DC2: [65, 22]
  },
  '4-3-2-1': {
    ARQ: [50, 92], LD: [85, 72], DFC1: [38, 74], DFC2: [62, 74], LI: [15, 72],
    MC1: [25, 52], MC2: [50, 54], MC3: [75, 52], MCO1: [35, 36], MCO2: [65, 36],
    DC: [50, 18]
  },
  '4-1-4-1': {
    ARQ: [50, 92], LD: [85, 72], DFC1: [38, 74], DFC2: [62, 74], LI: [15, 72],
    MCD: [50, 64], MD: [88, 46], MC1: [36, 48], MC2: [64, 48], MI: [12, 46],
    DC: [50, 18]
  },
  '3-4-2-1': {
    ARQ: [50, 92], DFC1: [25, 74], DFC2: [50, 76], DFC3: [75, 74],
    MD: [88, 52], MC1: [38, 54], MC2: [62, 54], MI: [12, 52],
    MCO1: [35, 34], MCO2: [65, 34], DC: [50, 16]
  }
}

export const ATAQUE_POS = ['ED', 'EI', 'DC', 'MCO', 'MD', 'MI']
export const DEFENSA_POS = ['ARQ', 'LD', 'DFC', 'LI', 'MCD', 'MC']

export function promedioLinea(equipo, posiciones, posDe) {
  const js = equipo.filter((j) => posiciones.includes(posDe(j.slot)))
  if (!js.length) return 0
  return Math.round((js.reduce((a, j) => a + Number(j.ovr_final), 0) / js.length) * 10) / 10
}

// Táctica visible: el estilo corre el bloque en profundidad (se ataca hacia
// arriba, Y menor) y el ancho escala las distancias laterales alrededor del
// centro. Son reglas de dibujo, no datos de jugadores.
export const AJUSTE_Y_ESTILO = { ofensivo: -7, equilibrado: 0, defensivo: 7 }
export const ESCALA_X_ANCHO = { estrecho: 0.85, equilibrado: 1, amplio: 1.12 }

export function coordConTactica(coords, estilo = 'equilibrado', anchura = 'equilibrado') {
  const [x, y] = coords ?? [50, 50]
  const escala = ESCALA_X_ANCHO[anchura] ?? ESCALA_X_ANCHO.equilibrado
  const correr = AJUSTE_Y_ESTILO[estilo] ?? AJUSTE_Y_ESTILO.equilibrado
  return [
    Math.min(93, Math.max(7, 50 + (x - 50) * escala)),
    Math.min(90, Math.max(14, y + correr))
  ]
}
