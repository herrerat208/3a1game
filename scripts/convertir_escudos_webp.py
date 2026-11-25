#!/usr/bin/env python3
"""3A1 — convierte todos los escudos de public/escudos/ a WebP liviano.

Los escudos se muestran a 56px, pero los archivos venían de 800 a 2200px
(11 MB en total). Este script los reescala a 160px y los guarda como WebP
(con transparencia), manteniendo el mismo nombre base.

Uso: python3 scripts/convertir_escudos_webp.py
Requiere Vite en :5174 y Chrome headless. Es idempotente.
"""

import base64
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "public" / "escudos"
TMP = ROOT / "public" / "_webp_escudos.html"
CHROME = Path("/mnt/c/Program Files/Google/Chrome/Application/chrome.exe")
SIZE = 160

HTML = """<!doctype html><meta charset="utf-8"><pre id="out">RUNNING</pre><script>
const files = __FILES__;
const SIZE = __SIZE__;
Promise.all(files.map(name => new Promise(res => {
  const im = new Image();
  im.onload = () => {
    const scale = Math.min(SIZE / im.naturalWidth, SIZE / im.naturalHeight);
    const w = Math.max(1, Math.round(im.naturalWidth * scale));
    const h = Math.max(1, Math.round(im.naturalHeight * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(im, 0, 0, w, h);
    res({name, data: c.toDataURL('image/webp', 0.9).split(',')[1]});
  };
  im.onerror = () => res({name, error:true});
  im.src = '/escudos/' + encodeURIComponent(name);
}))).then(r => { document.getElementById('out').textContent = 'WSTART' + JSON.stringify(r) + 'WEND'; });
</script>"""


def main() -> int:
    files = sorted(f.name for f in DIR.iterdir() if f.is_file())
    if not files:
        print("No hay escudos")
        return 1
    TMP.write_text(HTML.replace("__FILES__", json.dumps(files, ensure_ascii=False)).replace("__SIZE__", str(SIZE)), encoding="utf-8")
    cmd = [str(CHROME), "--headless", "--disable-gpu", "--no-sandbox",
           "--virtual-time-budget=60000", "--dump-dom", "http://localhost:5174/_webp_escudos.html"]
    try:
        dom = subprocess.run(cmd, capture_output=True, text=True, timeout=180).stdout
    finally:
        TMP.unlink(missing_ok=True)
    m = re.search(r"WSTART(.*?)WEND", dom, re.S)
    if not m:
        print("Chrome no devolvió datos")
        return 1
    rows = json.loads(m.group(1))
    antes = sum(f.stat().st_size for f in DIR.iterdir() if f.is_file())
    cambiados = 0
    for r in rows:
        if r.get("error"):
            print("No se pudo convertir:", r["name"])
            continue
        dest = DIR / (r["name"].rsplit(".", 1)[0] + ".webp")
        dest.write_bytes(base64.b64decode(r["data"]))
        if dest.name != r["name"]:
            (DIR / r["name"]).unlink(missing_ok=True)
        cambiados += 1
    despues = sum(f.stat().st_size for f in DIR.iterdir() if f.is_file())
    print(f"Escudos convertidos: {cambiados}/{len(files)}")
    print(f"Tamaño: {antes / 1024 / 1024:.1f} MB -> {despues / 1024 / 1024:.1f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
