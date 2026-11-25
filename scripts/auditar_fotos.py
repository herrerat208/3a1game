#!/usr/bin/env python3
"""3A1 — audita los avatares WebP buscando caras corridas o cortadas.

No necesita ver las imágenes: mide la distribución de piel en cada avatar
(centrado, fracción en el centro y piel tocando los bordes) y devuelve un
reporte JSON con los sospechosos.

Uso: python3 scripts/auditar_fotos.py [--json=/tmp/auditoria.json]
Escribe el reporte de sospechosos en --json (o /tmp/3a1-auditoria-fotos.json)
y todas las mediciones en /tmp/3a1-auditoria-todas.json (para --corregir).
Requiere Vite en :5174 y Chrome headless.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "jugadores"
TMP = ROOT / "public" / "_auditar_fotos.html"
CHROME = Path("/mnt/c/Program Files/Google/Chrome/Application/chrome.exe")

HTML = r"""<!doctype html><meta charset="utf-8"><pre id="out">RUNNING</pre><script>
const files = __FILES__;
Promise.all(files.map(name => new Promise(res => {
  const im = new Image();
  im.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d', {willReadFrequently:true});
      x.drawImage(im, 0, 0);
      const W = c.width, H = c.height;
      const d = x.getImageData(0, 0, W, H).data;
      let total=0, sx=0, sy=0, centro=0, borde=0;
      for (let y=0; y<H; y++) for (let xx=0; xx<W; xx++) {
        const k=(y*W+xx)*4, r=d[k], g=d[k+1], b=d[k+2];
        const cb=128-0.168736*r-0.331264*g+0.5*b;
        const cr=128+0.5*r-0.418688*g-0.081312*b;
        const piel = r>95 && g>40 && b>20 && cb>=77 && cb<=127 && cr>=133 && cr<=173;
        if (!piel) continue;
        total++; sx+=xx; sy+=y;
        const nx=xx/W, ny=y/H;
        if (nx>0.25 && nx<0.75 && ny>0.15 && ny<0.85) centro++;
        if (nx<0.06 || nx>0.94 || ny<0.06 || ny>0.94) borde++;
      }
      const frac = total/(W*H);
      res({name, piel:+frac.toFixed(4),
           cx: total ? +(sx/total/W).toFixed(3) : null,
           cy: total ? +(sy/total/H).toFixed(3) : null,
           centro: total ? +(centro/total).toFixed(3) : null,
           borde: total ? +(borde/total).toFixed(3) : null});
    } catch(e) { res({name, error:String(e)}); }
  };
  im.onerror = () => res({name, error:'no cargo'});
  im.src = '/jugadores/' + encodeURIComponent(name);
}))).then(r => { document.getElementById('out').textContent = 'ASTART' + JSON.stringify(r) + 'AEND'; });
</script>"""


def sospechoso(r: dict) -> bool:
    if r.get("error") or r.get("piel", 0) < 0.02:
        return False
    cx, cy = r["cx"], r["cy"]
    return (
        (r["centro"] is not None and r["centro"] < 0.5)
        or cx is None or cx < 0.38 or cx > 0.62
        or cy is None or cy < 0.30 or cy > 0.72
        or (r["borde"] is not None and r["borde"] > 0.06)
    )


def main() -> int:
    files = sorted(f.name for f in OUT.iterdir() if f.suffix == ".webp")
    TMP.write_text(HTML.replace("__FILES__", json.dumps(files, ensure_ascii=False)), encoding="utf-8")
    cmd = [str(CHROME), "--headless", "--disable-gpu", "--no-sandbox",
           "--virtual-time-budget=120000", "--dump-dom", "http://localhost:5174/_auditar_fotos.html"]
    try:
        dom = subprocess.run(cmd, capture_output=True, text=True, timeout=300).stdout
    finally:
        TMP.unlink(missing_ok=True)
    m = re.search(r"ASTART(.*?)AEND", dom, re.S)
    if not m:
        print("Chrome no devolvió datos (¿Vite caído?)")
        return 1
    filas = json.loads(m.group(1))
    malos = [r for r in filas if sospechoso(r)]
    Path("/tmp/3a1-auditoria-todas.json").write_text(json.dumps(filas, ensure_ascii=False), encoding="utf-8")
    dest = Path(next((a[6:] for a in sys.argv if a.startswith("--json=")), "/tmp/3a1-auditoria-fotos.json"))
    dest.write_text(json.dumps(malos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Analizados: {len(filas)} · sospechosos: {len(malos)}")
    for r in malos[:60]:
        print(f"  {r['name']:<45} piel {r['piel']:.2f} centro {r['centro']} cx {r['cx']} cy {r['cy']} borde {r['borde']}")
    print(f"Reporte: {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
