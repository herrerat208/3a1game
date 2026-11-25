#!/usr/bin/env python3
"""3A1 — convierte todos los escudos WebP a PNG de 160px con fondo transparente.

Los WebP actuales conservan un fondo blanco opaco en varios escudos (incluidos
los de River). Este script genera un PNG con el mismo nombre base, hace
flood-fill desde los bordes sobre píxeles casi blancos (r,g,b >= 240) y les
pone alpha=0. Los blancos internos del escudo NO se tocan: sólo se eliminan los
píxeles conectados al borde de la imagen. El alpha original se respeta.

Al final vuelve a cargar los PNG generados y verifica por muestreo que las
cuatro esquinas quedan transparentes y el centro opaco.

Uso: python3 scripts/convertir_escudos_png.py
Requiere Vite en :5174 (lo arranca si no está) y Chrome headless. Es idempotente:
si el PNG ya es byte-identical no lo reescribe. NO borra los WebP originales.
"""

import base64
import json
import re
import shlex
import subprocess
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "public" / "escudos"
TMP = ROOT / "public" / "_png_escudos.html"
CHROME = Path("/mnt/c/Program Files/Google/Chrome/Application/chrome.exe")
SIZE = 160
BASE_URL = "http://localhost:5174"
DEV_LOG = Path("/tmp/3a1-dev.log")

# Generación: dibuja el WebP en un canvas de hasta 160px, hace flood-fill desde
# el borde y devuelve el PNG en base64 junto con el muestreo de transparencia.
GENERAR_HTML = r"""<!doctype html><meta charset="utf-8"><pre id="out">RUNNING</pre><script>
const files = __FILES__;
const SIZE = __SIZE__;
Promise.all(files.map(name => new Promise(res => {
  const im = new Image();
  im.onload = () => {
    try {
      const scale = Math.min(SIZE / im.naturalWidth, SIZE / im.naturalHeight);
      const w = Math.max(1, Math.round(im.naturalWidth * scale));
      const h = Math.max(1, Math.round(im.naturalHeight * scale));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', {willReadFrequently: true});
      x.imageSmoothingQuality = 'high';
      x.drawImage(im, 0, 0, w, h);
      const img = x.getImageData(0, 0, w, h);
      const d = img.data;
      // Sólo píxeles casi blancos y con alpha original > 0 (no inventamos opacidad).
      const blanco = (o) => d[o] >= 240 && d[o+1] >= 240 && d[o+2] >= 240;
      const seen = new Uint8Array(w * h), stack = [];
      const push = (px, py) => {
        if (px < 0 || py < 0 || px >= w || py >= h) return;
        const k = py * w + px;
        if (seen[k]) return;
        const o = k * 4;
        if (d[o+3] === 0 || !blanco(o)) return;
        seen[k] = 1; stack.push(k);
      };
      for (let px = 0; px < w; px++) { push(px, 0); push(px, h-1); }
      for (let py = 0; py < h; py++) { push(0, py); push(w-1, py); }
      while (stack.length) {
        const k = stack.pop(), px = k % w, py = (k - px) / w;
        push(px+1, py); push(px-1, py); push(px, py+1); push(px, py-1);
      }
      let eliminados = 0;
      for (let k = 0; k < seen.length; k++) if (seen[k]) { d[k*4+3] = 0; eliminados++; }
      x.putImageData(img, 0, 0);
      const alpha = (px, py) => d[(py * w + px) * 4 + 3];
      const esquinas = [[0,0], [w-1,0], [0,h-1], [w-1,h-1]].map(([px,py]) => alpha(px,py));
      const centro = alpha(Math.floor(w/2), Math.floor(h/2));
      res({name, w, h, eliminados, esquinas, centro,
           data: c.toDataURL('image/png').split(',')[1]});
    } catch (e) { res({name, error: String(e)}); }
  };
  im.onerror = () => res({name, error: 'no cargó el WebP'});
  im.src = '/escudos/' + encodeURIComponent(name);
}))).then(r => { document.getElementById('out').textContent = 'PSTART' + JSON.stringify(r) + 'PEND'; });
</script>"""

# Verificación: recarga los PNG ya escritos y muestrea esquinas y centro.
VERIFICAR_HTML = r"""<!doctype html><meta charset="utf-8"><pre id="out">RUNNING</pre><script>
const files = __FILES__;
Promise.all(files.map(name => new Promise(res => {
  const im = new Image();
  im.onload = () => {
    try {
      const w = im.naturalWidth, h = im.naturalHeight;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', {willReadFrequently: true});
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, w, h).data;
      const alpha = (px, py) => d[(py * w + px) * 4 + 3];
      const esquinas = [[0,0], [w-1,0], [0,h-1], [w-1,h-1]].map(([px,py]) => alpha(px,py));
      res({name, w, h, esquinas, centro: alpha(Math.floor(w/2), Math.floor(h/2))});
    } catch (e) { res({name, error: String(e)}); }
  };
  im.onerror = () => res({name, error: 'no cargó el PNG'});
  im.src = '/escudos/' + encodeURIComponent(name);
}))).then(r => { document.getElementById('out').textContent = 'VSTART' + JSON.stringify(r) + 'VEND'; });
</script>"""


def servidor_activo() -> bool:
    try:
        with urllib.request.urlopen(BASE_URL + "/", timeout=2) as resp:
            return resp.status < 500
    except Exception:
        return False


def asegurar_servidor() -> bool:
    """Arranca Vite en :5174 si no está, con polling y log en /tmp/3a1-dev.log."""
    if servidor_activo():
        return True
    DEV_LOG.parent.mkdir(parents=True, exist_ok=True)
    cmd = ("CHOKIDAR_USEPOLLING=1 nohup npm run dev -- --host --port 5174 "
           ">> " + shlex.quote(str(DEV_LOG)) + " 2>&1 &")
    subprocess.run(cmd, shell=True, cwd=ROOT, check=False)
    for _ in range(60):
        if servidor_activo():
            return True
        time.sleep(0.5)
    print(f"No se pudo arrancar Vite en :5174 (ver {DEV_LOG})")
    return False


def correr_chrome(marcador_inicio: str, marcador_fin: str):
    """Escribe el HTML temporal, lo abre con Chrome y devuelve las filas JSON."""
    cmd = [str(CHROME), "--headless", "--disable-gpu", "--no-sandbox",
           "--virtual-time-budget=60000", "--dump-dom",
           BASE_URL + "/_png_escudos.html"]
    try:
        dom = subprocess.run(cmd, capture_output=True, text=True, timeout=180).stdout
    except subprocess.TimeoutExpired:
        print("Chrome se colgó al procesar los escudos")
        return None
    m = re.search(re.escape(marcador_inicio) + r"(.*?)" + re.escape(marcador_fin), dom, re.S)
    if not m:
        print("Chrome no devolvió datos (¿Vite sirviendo el HTML temporal?)")
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as exc:
        print(f"JSON inválido desde Chrome: {exc}")
        return None


def main() -> int:
    archivos = sorted(p.name for p in DIR.iterdir() if p.is_file() and p.suffix.lower() == ".webp")
    if not archivos:
        print("No hay escudos WebP en public/escudos/")
        return 1
    if not CHROME.exists():
        print(f"No se encontró Chrome: {CHROME}")
        return 1
    if not asegurar_servidor():
        return 1

    creados = actualizados = identicos = 0
    nombres = []
    try:
        # 1) Conversión + flood-fill + muestreo en el canvas ya procesado.
        html = GENERAR_HTML.replace("__FILES__", json.dumps(archivos, ensure_ascii=False))
        html = html.replace("__SIZE__", str(SIZE))
        filas = None
        for intento in range(2):
            TMP.write_text(html, encoding="utf-8")
            filas = correr_chrome("PSTART", "PEND")
            if filas is not None:
                break
            # El Vite arrancado desde este proceso puede caer al terminar el
            # comando padre: se levanta una vez más y se reintenta.
            if intento == 0 and not asegurar_servidor():
                return 1
        if filas is None:
            return 1
        for fila in filas:
            if fila.get("error"):
                print(f"No se pudo convertir {fila['name']}: {fila['error']}")
                continue
            datos = base64.b64decode(fila["data"])
            dest = DIR / (fila["name"].rsplit(".", 1)[0] + ".png")
            existia = dest.exists()
            if existia and dest.read_bytes() == datos:
                identicos += 1
            else:
                dest.write_bytes(datos)
                if existia:
                    actualizados += 1
                else:
                    creados += 1
            nombres.append(dest.name)
            muestreo = f"esquinas={fila['esquinas']} centro={fila['centro']}"
            print(f"{dest.name}: {fila['w']}x{fila['h']}, "
                  f"{fila['eliminados']} px de fondo quitados, {muestreo}")

        # 2) Verificación leyendo los PNG desde disco (otra carga, otro canvas).
        html = VERIFICAR_HTML.replace("__FILES__", json.dumps(nombres, ensure_ascii=False))
        verificadas = None
        for intento in range(2):
            TMP.write_text(html, encoding="utf-8")
            verificadas = correr_chrome("VSTART", "VEND")
            if verificadas is not None:
                break
            if intento == 0 and not asegurar_servidor():
                return 1
        if verificadas is None:
            return 1
        fallos = []
        for fila in verificadas:
            if fila.get("error"):
                fallos.append(f"{fila['name']}: {fila['error']}")
                continue
            ok = all(a == 0 for a in fila["esquinas"]) and fila["centro"] > 0
            if not ok:
                fallos.append(f"{fila['name']}: esquinas={fila['esquinas']} centro={fila['centro']}")
        print(f"\nPNG generados: {creados}, actualizados: {actualizados}, "
              f"idénticos (sin reescribir): {identicos}, total: {len(nombres)}/{len(archivos)}")
        print(f"Verificación de píxeles: {len(verificadas) - len(fallos)}/{len(verificadas)} correctos")
        for fallo in fallos:
            print("  REVISAR:", fallo)
        return 1 if fallos or len(nombres) != len(archivos) else 0
    finally:
        TMP.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
