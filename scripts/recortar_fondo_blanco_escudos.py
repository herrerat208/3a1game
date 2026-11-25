#!/usr/bin/env python3
"""3A1 — quita el fondo blanco opaco de los escudos de public/escudos/.

`recortar_escudos.py` recorta margen transparente, pero no detecta los archivos
que vinieron achatados sobre fondo blanco: para el navegador son 100% opacos y
parecen una caja blanca alrededor del escudo. Este script hace flood-fill del
blanco conectado al borde, lo vuelve transparente y recorta al contenido.

Es idempotente: los archivos ya transparentes no se reescriben.

Uso:  python3 scripts/recortar_fondo_blanco_escudos.py
Requiere Chrome/Edge en Windows.
"""

import base64
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public" / "escudos"
CHROME = Path("/mnt/c/Program Files/Google/Chrome/Application/chrome.exe")
AUDIT = ROOT / "_blanco_escudos.html"


def win_uri(p: Path) -> str:
    s = str(p).replace("\\", "/")
    if s.startswith("/mnt/c/"):
        s = "C:/" + s[len("/mnt/c/"):]
    return "file:///" + s


HTML = r"""<!doctype html><meta charset="utf-8"><pre id="out">RUNNING</pre><script>
const files = __FILES__;
function process(img, path) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const src = document.createElement('canvas'); src.width = w; src.height = h;
  const sx = src.getContext('2d', {willReadFrequently:true}); sx.drawImage(img, 0, 0);
  const d = sx.getImageData(0, 0, w, h).data;
  const px = (x,y) => (y*w+x)*4;
  let alphaMin = 255;
  for (let i = 3; i < d.length; i += 4) if (d[i] < alphaMin) alphaMin = d[i];
  if (alphaMin < 250) return {name:path.split('/').pop(), changed:false, reason:'ya tiene transparencia'};

  const neutral = (i, threshold, sat) => d[i] >= threshold && d[i+1] >= threshold && d[i+2] >= threshold
    && (Math.max(d[i],d[i+1],d[i+2]) - Math.min(d[i],d[i+1],d[i+2])) <= sat;
  const seen = new Uint8Array(w*h), stack = [];
  const push = (x,y) => {
    if (x<0||y<0||x>=w||y>=h) return;
    const k = y*w+x;
    if (seen[k] || !neutral(px(x,y), 245, 12)) return;
    seen[k] = 1; stack.push([x,y]);
  };
  for (let x=0;x<w;x++) { push(x,0); push(x,h-1); }
  for (let y=0;y<h;y++) { push(0,y); push(w-1,y); }
  while (stack.length) {
    const [x,y] = stack.pop();
    push(x+1,y); push(x-1,y); push(x,y+1); push(x,y-1);
  }
  let bg = 0;
  for (let k=0;k<seen.length;k++) if (seen[k]) bg++;
  const bgPct = 100*bg/(w*h);
  if (bgPct < 2) return {name:path.split('/').pop(), changed:false, bgPct:+bgPct.toFixed(1)};

  // Antialiasing: el borde del fondo suele ser gris claro. Se absorben hasta
  // dos capas de vecinos claros para no dejar un halo blanco alrededor.
  for (let pass=0; pass<2; pass++) {
    const nuevos = [];
    for (let k=0;k<seen.length;k++) {
      if (!seen[k]) continue;
      const x = k % w, y = (k - x) / w;
      for (const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
        if (nx<0||ny<0||nx>=w||ny>=h) continue;
        const nk = ny*w+nx;
        if (seen[nk] || !neutral(px(nx,ny), 232, 18)) continue;
        seen[nk] = 1; nuevos.push([nx,ny]);
      }
    }
    if (!nuevos.length) break;
  }

  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const ox = out.getContext('2d'); ox.drawImage(src, 0, 0);
  const od = ox.getImageData(0, 0, w, h);
  for (let k=0;k<seen.length;k++) if (seen[k]) od.data[k*4+3] = 0;
  ox.putImageData(od, 0, 0);

  let minX=w, minY=h, maxX=-1, maxY=-1;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    if (od.data[px(x,y)+3] <= 12) continue;
    if (x<minX) minX=x; if (x>maxX) maxX=x; if (y<minY) minY=y; if (y>maxY) maxY=y;
  }
  if (maxX < 0) return {name:path.split('/').pop(), changed:false, reason:'sin contenido'};
  const margin = 2;
  const x = Math.max(0, minX-margin), y = Math.max(0, minY-margin);
  const cw = Math.min(w, maxX+1+margin)-x, ch = Math.min(h, maxY+1+margin)-y;
  const crop = document.createElement('canvas'); crop.width = cw; crop.height = ch;
  const cx = crop.getContext('2d');
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(out, x, y, cw, ch, 0, 0, cw, ch);
  return {
    name:path.split('/').pop(), changed:true, bgPct:+bgPct.toFixed(1),
    from:[w,h], to:[cw,ch], data:crop.toDataURL('image/webp', 0.95).split(',')[1],
  };
}
Promise.all(files.map(path => new Promise(res => {
  const im = new Image();
  im.onload = () => res(process(im, path));
  im.onerror = () => res({name:path.split('/').pop(), changed:false, reason:'no cargo'});
  im.src = path;
}))).then(r => { document.getElementById('out').textContent = 'FIX_START' + JSON.stringify(r) + 'FIX_END'; });
</script>""".replace("__FILES__", "[]")


def main() -> int:
    files = sorted(
        p for p in PUBLIC.iterdir()
        if p.is_file() and p.suffix.lower() in {".webp", ".png", ".jpg", ".jpeg", ".avif"}
    )
    if not files:
        print("No hay escudos en public/escudos/")
        return 1
    if not CHROME.exists():
        print(f"No se encontró Chrome: {CHROME}")
        return 1

    AUDIT.write_text(HTML.replace("[]", json.dumps([win_uri(p) for p in files], ensure_ascii=False)), encoding="utf-8")
    cmd = [str(CHROME), "--headless", "--disable-gpu", "--no-sandbox", "--allow-file-access-from-files",
           "--virtual-time-budget=30000", "--dump-dom", win_uri(AUDIT)]
    try:
        dom = subprocess.run(cmd, capture_output=True, text=True, timeout=180).stdout
    finally:
        AUDIT.unlink(missing_ok=True)

    m = re.search(r"FIX_START(.*?)FIX_END", dom, re.S)
    if not m:
        print("Chrome no devolvió datos")
        return 1
    rows = json.loads(m.group(1))
    changed = 0
    for row in rows:
        if not row.get("changed"):
            continue
        dest = PUBLIC / row["name"]
        if dest.suffix.lower() != ".webp":
            dest = dest.with_suffix(".webp")
        dest.write_bytes(base64.b64decode(row["data"]))
        changed += 1
        print(f"{row['name']}: {row['from'][0]}x{row['from'][1]} -> {row['to'][0]}x{row['to'][1]} "
              f"(fondo blanco {row['bgPct']}%)")
    print(f"\nCorregidos: {changed}/{len(files)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
