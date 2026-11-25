#!/usr/bin/env python3
"""3A1 — convierte los 51 escudos PNG sin fondo a WebP (mismo nombre base).

Los PNG generados por `convertir_escudos_png.py` ya tienen el fondo transparente;
este script los dibuja en un canvas transparente y exporta WebP con alpha,
sobrescribiendo los WebP anteriores (que tenían fondo blanco opaco).

Al final recarga los WebP desde disco y verifica que las cuatro esquinas sigan
transparentes y el centro opaco. Idempotente: si el WebP ya es byte-identical
no lo reescribe. NO borra los PNG: la limpieza se hace aparte.

Uso: python3 scripts/convertir_escudos_webp_transparentes.py
Requiere Chrome headless y Vite en :5174 (lo arranca si no está).
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
TMP = ROOT / "public" / "_webp_transparentes.html"
CHROME = Path("/mnt/c/Program Files/Google/Chrome/Application/chrome.exe")
BASE_URL = "http://localhost:5174"
DEV_LOG = Path("/tmp/3a1-dev.log")

# El canvas arranca transparente: dibujar el PNG conserva su canal alpha.
GENERAR_HTML = r"""<!doctype html><meta charset="utf-8"><pre id="out">RUNNING</pre><script>
const files = __FILES__;
Promise.all(files.map(name => new Promise(res => {
  const im = new Image();
  im.onload = () => {
    try {
      const w = im.naturalWidth, h = im.naturalHeight;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', {willReadFrequently: true});
      x.imageSmoothingQuality = 'high';
      x.drawImage(im, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data;
      const alpha = (px, py) => d[(py * w + px) * 4 + 3];
      const esquinas = [[0,0], [w-1,0], [0,h-1], [w-1,h-1]].map(([px,py]) => alpha(px,py));
      const centro = alpha(Math.floor(w/2), Math.floor(h/2));
      res({name, w, h, esquinas, centro, data: c.toDataURL('image/webp', 0.92).split(',')[1]});
    } catch (e) { res({name, error: String(e)}); }
  };
  im.onerror = () => res({name, error: 'no cargó el PNG'});
  im.src = '/escudos/' + encodeURIComponent(name);
}))).then(r => { document.getElementById('out').textContent = 'PSTART' + JSON.stringify(r) + 'PEND'; });
</script>"""

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
  im.onerror = () => res({name, error: 'no cargó el WebP'});
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


def correr_chrome(inicio: str, fin: str):
    cmd = [str(CHROME), "--headless", "--disable-gpu", "--no-sandbox",
           "--virtual-time-budget=60000", "--dump-dom",
           BASE_URL + "/_webp_transparentes.html"]
    try:
        dom = subprocess.run(cmd, capture_output=True, text=True, timeout=180).stdout
    except subprocess.TimeoutExpired:
        print("Chrome se colgó al procesar los escudos")
        return None
    m = re.search(re.escape(inicio) + r"(.*?)" + re.escape(fin), dom, re.S)
    if not m:
        print("Chrome no devolvió datos")
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as exc:
        print(f"JSON inválido desde Chrome: {exc}")
        return None


def main() -> int:
    archivos = sorted(p.name for p in DIR.iterdir() if p.is_file() and p.suffix.lower() == ".png")
    if not archivos:
        print("No hay escudos PNG en public/escudos/")
        return 1
    if not CHROME.exists():
        print(f"No se encontró Chrome: {CHROME}")
        return 1
    if not asegurar_servidor():
        return 1

    creados = actualizados = identicos = 0
    nombres = []
    try:
        html = GENERAR_HTML.replace("__FILES__", json.dumps(archivos, ensure_ascii=False))
        filas = None
        for intento in range(2):
            TMP.write_text(html, encoding="utf-8")
            filas = correr_chrome("PSTART", "PEND")
            if filas is not None:
                break
            if intento == 0 and not asegurar_servidor():
                return 1
        if filas is None:
            return 1

        for fila in filas:
            if fila.get("error"):
                print(f"No se pudo convertir {fila['name']}: {fila['error']}")
                continue
            datos = base64.b64decode(fila["data"])
            dest = DIR / (fila["name"].rsplit(".", 1)[0] + ".webp")
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
            print(f"{dest.name}: {fila['w']}x{fila['h']}, {len(datos)} bytes, "
                  f"esquinas={fila['esquinas']} centro={fila['centro']}")

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
        print(f"\nWebP generados: {creados}, actualizados: {actualizados}, "
              f"idénticos (sin reescribir): {identicos}, total: {len(nombres)}/{len(archivos)}")
        print(f"Verificación de transparencia: {len(verificadas) - len(fallos)}/{len(verificadas)} correctos")
        for fallo in fallos:
            print("  REVISAR:", fallo)
        return 1 if fallos or len(nombres) != len(archivos) else 0
    finally:
        TMP.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
