#!/usr/bin/env python3
"""3A1 — recorta el margen transparente de los escudos de public/escudos/.

Los escudos del dueño vienen con distintos márgenes transparentes. En la UI se
muestran con object-fit: contain, así que un escudo con 25% de margen se ve
notablemente más chico que otro con 0%. Este script los recorta al bounding box
del contenido (con un margen de seguridad del 2%) para que todos se vean parejos.

Uso:  python3 scripts/recortar_escudos.py
Requiere Chrome/Edge en Windows y el servidor Vite levantado en :5174 (para que
las imágenes se carguen same-origin y canvas pueda leer los píxeles).

Es idempotente: si el margen ya es chico no reescribe el archivo.
AVIF no se puede codificar desde canvas: esos dos archivos se convierten a WEBP.
"""

import base64
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
AUDIT = PUBLIC / "_trim_escudos.html"
CHROME = Path("/mnt/c/Program Files/Google/Chrome/Application/chrome.exe")
URL = "http://localhost:5174/_trim_escudos.html"

HTML = """<!doctype html><meta charset="utf-8"><pre id="out">RUNNING</pre><script>
const files = __FILES__;
const MIME = {png:'image/png', webp:'image/webp', jpg:'image/jpeg', jpeg:'image/jpeg', avif:'image/webp'};
function process(img, name) {
  const ext = name.split('.').pop().toLowerCase();
  const w = img.naturalWidth, h = img.naturalHeight;
  const src = document.createElement('canvas'); src.width = w; src.height = h;
  const sx = src.getContext('2d', {willReadFrequently:true}); sx.drawImage(img, 0, 0);
  const d = sx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  const step = Math.max(1, Math.floor(Math.max(w, h) / 900));
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    if (d[(y * w + x) * 4 + 3] > 12) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return {name, changed:false, reason:'sin contenido'};
  const pad = Math.max(minX, minY, w - 1 - maxX, h - 1 - maxY) / Math.max(w, h);
  if (pad < 0.03) return {name, changed:false, pad:+pad.toFixed(3)};
  const margin = Math.max(2, Math.round(0.02 * Math.min(w, h)));
  const x = Math.max(0, minX - margin), y = Math.max(0, minY - margin);
  const cw = Math.min(w, maxX + 1 + margin) - x;
  const ch = Math.min(h, maxY + 1 + margin) - y;
  if (cw < 8 || ch < 8) return {name, changed:false, reason:'recorte invalido'};
  const out = document.createElement('canvas'); out.width = cw; out.height = ch;
  const ox = out.getContext('2d');
  ox.imageSmoothingQuality = 'high';
  ox.drawImage(src, x, y, cw, ch, 0, 0, cw, ch);
  const mime = MIME[ext] || 'image/png';
  const quality = mime === 'image/jpeg' || mime === 'image/webp' ? 0.94 : undefined;
  return {
    name, changed:true, pad:+pad.toFixed(3), from:[w, h], to:[cw, ch],
    mime, data: out.toDataURL(mime, quality).split(',')[1],
  };
}
Promise.all(files.map(name => new Promise(res => {
  const im = new Image();
  im.onload = () => res(process(im, name));
  im.onerror = () => res({name, changed:false, reason:'no cargo'});
  im.src = '/escudos/' + encodeURIComponent(name);
}))).then(r => {
  document.getElementById('out').textContent = 'TRIM_START' + JSON.stringify(r) + 'TRIM_END';
});
</script>""".replace("__FILES__", "[]")


def main() -> int:
    files = sorted(
        f.name for f in (PUBLIC / "escudos").iterdir()
        if f.is_file() and f.suffix.lower().lstrip(".") in {"png", "webp", "jpg", "jpeg", "avif"}
    )
    if not files:
        print("No hay escudos en public/escudos/")
        return 1
    if not CHROME.exists():
        print(f"No se encontró Chrome: {CHROME}")
        return 1

    AUDIT.write_text(HTML.replace("[]", json.dumps(files, ensure_ascii=False)), encoding="utf-8")
    cmd = [
        str(CHROME), "--headless", "--disable-gpu", "--no-sandbox",
        "--virtual-time-budget=30000", "--dump-dom", URL,
    ]
    try:
        dom = subprocess.run(cmd, capture_output=True, text=True, timeout=120).stdout
    finally:
        AUDIT.unlink(missing_ok=True)

    m = re.search(r"TRIM_START(.*?)TRIM_END", dom, re.S)
    if not m:
        print("Chrome no devolvió datos (¿Vite caído?)")
        return 1
    rows = json.loads(m.group(1))

    changed = 0
    renamed = []
    for row in rows:
        if not row.get("changed"):
            continue
        name = row["name"]
        dest_name = name
        if row["mime"] == "image/webp" and not name.lower().endswith(".webp"):
            dest_name = name.rsplit(".", 1)[0] + ".webp"
        dest = PUBLIC / "escudos" / dest_name
        dest.write_bytes(base64.b64decode(row["data"]))
        if dest_name != name:
            (PUBLIC / "escudos" / name).unlink(missing_ok=True)
            renamed.append((name, dest_name))
        changed += 1
        print(f"{name}: {row['from'][0]}x{row['from'][1]} -> {row['to'][0]}x{row['to'][1]} "
              f"(margen {row['pad'] * 100:.1f}%)")
    print(f"\nRecortados: {changed}/{len(files)}")
    for old, new in renamed:
        print(f"  renombrado: {old} -> {new}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
