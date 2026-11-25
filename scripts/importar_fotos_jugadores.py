#!/usr/bin/env python3
"""3A1 — importa fotos de jugadores como avatares WebP centrados en la cara.

Uso:
  python3 scripts/importar_fotos_jugadores.py                 # River
  python3 scripts/importar_fotos_jugadores.py --rivales      # rivales
  python3 scripts/importar_fotos_jugadores.py --dir=RUTA --sql=RUTA
  python3 scripts/importar_fotos_jugadores.py --rivales --limit=20

Qué hace:
  1. Copia las fotos a un temp servido por Vite (canvas necesita mismo origen
     para leer píxeles).
  2. En Chrome headless: detecta la zona de piel (o, para fotos en B&W, la zona
     con más detalle del tercio superior), recorta un cuadrado centrado en la
     cara y lo exporta a WebP de 160x160.
  3. River: guarda en public/jugadores/<nombre>.webp y apunta jugadores.foto_url
     a ese archivo local. Limpia foto_epoca SOLO en temporadas de River.
  4. Rivales: guarda en public/jugadores/rivales/<jugador>-<club>.webp y apunta
     temporada_jugadores.foto_epoca de ESE club/temporada. No toca foto_url
     (así un jugador compartido conserva su foto de River en las temporadas de
     River y usa la del rival en las del rival).
  5. Procesa en lotes para no cargar 600+ imágenes de golpe en Chrome.

Requiere Vite en :5174 y Chrome headless. Sin dependencias Python.
"""

import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_RIVER = Path("/mnt/c/Users/Usuario/OneDrive/Escritorio/Carpeta fotos 3a1/River/Jugadores River")
SRC_RIVALES = Path("/mnt/c/Users/Usuario/OneDrive/Escritorio/Carpeta fotos 3a1/Rivales/Jugadores Rivales")
OUT_RIVER = ROOT / "public" / "jugadores"
OUT_RIVALES = ROOT / "public" / "jugadores" / "rivales"
SQL_RIVER = ROOT / "db" / "fotos_jugadores.sql"
SQL_RIVALES = ROOT / "db" / "fotos_rivales.sql"
TMP = ROOT / "public" / "_fotos_tmp"
CHROME = Path("/mnt/c/Program Files/Google/Chrome/Application/chrome.exe")
SIZE = 160
# Chrome en Windows resuelve "localhost" a IPv4, donde Vite no escucha; [::1]
# apunta al mismo servidor y sirve los archivos temporales sin caer en el
# fallback SPA que devuelve index.html.
BASE_URL = os.environ.get("A1_DEV_URL", "http://[::1]:5174")
EXTS = {"jpg", "jpeg", "jfif", "png", "webp", "avif"}
MYSQL = "/mnt/c/xampp/mysql/bin/mysql.exe"

# Archivos con la grafía vieja -> nombre corregido en la DB (hoja A-Z).
FILE_ALIAS_RIVER = {
    "franco constanzo": "franco costanzo",
    "juan jose borreli": "juan jose borrelli",
    "pablo sarabia": "pedro sarabia",
    "aristobulo deambrossi": "aristobulo deambrosi",
}

CLUB_ALIAS = {
    "boca": "boca", "bpca": "boca", "bo ca": "boca", "b0ca": "boca",
    "independiente": "independiente", "indep": "independiente",
    "velez": "velez", "velz": "velez",
    "sanlo": "san lorenzo", "san lorenzo": "san lorenzo",
    "estudiantes": "estudiantes", "estudiantes lp": "estudiantes",
    "racing": "racing",
    "newells": "newells", "newell s": "newells", "newells old boys": "newells",
    "rosario": "rosario central", "rosario central": "rosario central",
    "argentinos": "argentinos juniors", "argentinos juniors": "argentinos juniors",
    "lanus": "lanus", "ferro": "ferro", "chacarita": "chacarita",
    "belgrano": "belgrano", "quilmes": "quilmes", "huracan": "huracan",
    "arsenal": "arsenal", "banfield": "banfield", "platense": "platense",
    "river": "river plate", "river plate": "river plate",
}

HTML = r"""<!doctype html><meta charset="utf-8"><pre id="out">RUNNING</pre><script>
const files = __FILES__;
const ajustes = __AJUSTES__;
const SIZE = __SIZE__;

function focusArea(img) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const sc = Math.min(1, 256 / Math.max(W, H));
  const w = Math.max(8, Math.round(W * sc)), h = Math.max(8, Math.round(H * sc));
  const a = document.createElement('canvas'); a.width = w; a.height = h;
  const ac = a.getContext('2d', {willReadFrequently:true});
  ac.drawImage(img, 0, 0, w, h);
  const d = ac.getImageData(0, 0, w, h).data;

  const GX = 16, GY = 16, grid = new Float32Array(GX * GY);
  let skin = 0, total = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const i = (y * w + x) * 4, r = d[i], g = d[i+1], b = d[i+2];
    total++;
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
    const cb = 128 - 0.168736*r - 0.331264*g + 0.5*b;
    const cr = 128 + 0.5*r - 0.418688*g - 0.081312*b;
    const esPiel = (r > 95 && g > 40 && b > 20 && mx - mn > 15 &&
                    Math.abs(r - g) > 15 && r > g && r > b) ||
                   (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173);
    if (esPiel && y > h * 0.03 && y < h * 0.88) {
      grid[Math.min(GY-1, (y / h * GY)|0) * GX + Math.min(GX-1, (x / w * GX)|0)]++;
      skin++;
    }
  }
  if (skin > total * 0.008) {
    let best = 0, bi = 0;
    for (let k = 0; k < grid.length; k++) if (grid[k] > best) { best = grid[k]; bi = k; }
    const by = (bi / GX)|0, bx = bi % GX;
    let sx = 0, sy = 0, sw = 0;
    for (let gy = Math.max(0, by-2); gy <= Math.min(GY-1, by+2); gy++)
      for (let gx = Math.max(0, bx-2); gx <= Math.min(GX-1, bx+2); gx++) {
        const p = grid[gy*GX+gx];
        sx += (gx + 0.5) / GX * p; sy += (gy + 0.5) / GY * p; sw += p;
      }
    return { x: sx / sw, y: Math.max(0.12, sy / sw - 0.02), modo: 'piel' };
  }

  // Foto en blanco y negro: buscar la fila con más detalle del tercio superior.
  const rows = new Float32Array(h);
  for (let y = 1; y < h; y++) {
    let e = 0, n = 0;
    for (let x = 0; x < w; x += 2) {
      const i = (y*w+x)*4, j = ((y-1)*w+x)*4;
      e += Math.abs(d[i]-d[j]) + Math.abs(d[i+1]-d[j+1]) + Math.abs(d[i+2]-d[j+2]);
      n++;
    }
    rows[y] = e / n;
  }
  const win = Math.max(2, Math.round(h / 14));
  let bestY = Math.round(h * 0.35), bestV = -1;
  for (let y = Math.floor(h*0.10); y < Math.floor(h*0.62); y++) {
    let s = 0;
    for (let k = -win; k <= win; k++) s += rows[Math.max(0, Math.min(h-1, y+k))];
    if (s > bestV) { bestV = s; bestY = y; }
  }
  return { x: 0.5, y: bestY / h, modo: 'detalle' };
}

Promise.all(files.map(name => new Promise(res => {
  const im = new Image();
  im.onload = () => {
    try {
      const W = im.naturalWidth, H = im.naturalHeight;
      const f = focusArea(im);
      const a = ajustes[name] ?? {};
      const side = Math.min(W, H) * (a.zoom ?? 0.98);
      const fx = Math.max(0, Math.min(1, f.x + (a.dx ?? 0)));
      const fy = Math.max(0, Math.min(1, f.y + (a.dy ?? 0)));
      const sx = Math.max(0, Math.min(W - side, fx * W - side / 2));
      const sy = Math.max(0, Math.min(H - side, fy * H - side / 2));
      const c = document.createElement('canvas'); c.width = SIZE; c.height = SIZE;
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(im, sx, sy, side, side, 0, 0, SIZE, SIZE);
      res({name, data: c.toDataURL('image/webp', 0.85).split(',')[1], modo: f.modo,
           from: [W,H], crop: [Math.round(sx),Math.round(sy),Math.round(side)]});
    } catch (e) { res({name, error: String(e)}); }
  };
  im.onerror = () => res({name, error: 'no cargo'});
  im.src = '/_fotos_tmp/' + encodeURIComponent(name);
}))).then(r => { document.getElementById('out').textContent = 'FSTART' + JSON.stringify(r) + 'FEND'; });
</script>"""


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = s.replace("&", " y ")
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"[^a-z0-9/ ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def slug(s: str) -> str:
    return norm(s).replace(" ", "-").replace("/", "-")


def sql(query: str) -> list[list[str]]:
    out = subprocess.run(
        [MYSQL, "-u", "root", "--default-character-set=utf8mb4", "-N", "-B", "-e", query],
        capture_output=True, text=True, check=True,
    ).stdout
    return [line.split("\t") for line in out.splitlines() if line.strip()]


def sql_str(s: str) -> str:
    return (s or "").replace("\\", "\\\\").replace("'", "''")


def files_in(path: Path) -> list[Path]:
    return sorted(f for f in path.iterdir() if f.is_file() and f.suffix.lower().lstrip(".") in EXTS)


def score_name(a: str, b: str) -> float:
    from difflib import SequenceMatcher
    na, nb = norm(a), norm(b)
    base = SequenceMatcher(None, na, nb).ratio()
    ta, tb = {t for t in na.split() if len(t) > 1}, {t for t in nb.split() if len(t) > 1}
    if not ta or not tb:
        return base
    overlap = len(ta & tb) / max(len(ta), len(tb))
    contain = 1.0 if (ta <= tb or tb <= ta) else 0.0
    return max(base, 0.55 * base + 0.45 * overlap, 0.70 * base + 0.30 * contain)


def crop_batch(files: list[Path], ajustes: dict, chunk: int) -> list[dict]:
    results = []
    for i in range(0, len(files), chunk):
        batch = files[i:i + chunk]
        shutil.rmtree(TMP, ignore_errors=True)
        TMP.mkdir(parents=True, exist_ok=True)
        for f in batch:
            shutil.copy2(f, TMP / f.name)
        names = [f.name for f in batch]
        page = ROOT / "public" / "_importar_fotos.html"
        page.write_text(
            HTML.replace("__FILES__", json.dumps(names, ensure_ascii=False))
                .replace("__AJUSTES__", json.dumps(ajustes, ensure_ascii=False))
                .replace("__SIZE__", str(SIZE)),
            encoding="utf-8",
        )
        # Perfil propio: si el dueño tiene Chrome abierto, el perfil por defecto
        # hace que --dump-dom se delegue a esa instancia y no devuelva nada.
        perfil = tempfile.mkdtemp(prefix="3a1-crop-", dir="/tmp/opencode")
        cmd = [str(CHROME), "--headless", "--disable-gpu", "--no-sandbox",
               f"--user-data-dir={perfil}",
               "--virtual-time-budget=240000", "--dump-dom",
               f"{BASE_URL}/_importar_fotos.html"]
        try:
            dom = subprocess.run(cmd, capture_output=True, text=True, timeout=900).stdout
        finally:
            page.unlink(missing_ok=True)
            shutil.rmtree(perfil, ignore_errors=True)
        m = re.search(r"FSTART(.*?)FEND", dom, re.S)
        if not m:
            raise RuntimeError("Chrome no devolvió datos (¿Vite caído?)")
        results.extend(json.loads(m.group(1)))
        print(f"  lote {i // chunk + 1}/{(len(files) + chunk - 1) // chunk}: "
              f"{len(batch)} fotos procesadas", flush=True)
    shutil.rmtree(TMP, ignore_errors=True)
    return results


def escribir_webp(results: list[dict], out_dir: Path, por_archivo: dict[str, str]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    modos = defaultdict(int)
    for r in results:
        if r.get("error"):
            print("  ERROR", r["name"], r["error"])
            continue
        destino = por_archivo[r["name"]]
        (ROOT / "public" / destino.lstrip("/")).parent.mkdir(parents=True, exist_ok=True)
        (ROOT / "public" / destino.lstrip("/")).write_bytes(base64.b64decode(r["data"]))
        modos[r.get("modo", "?")] += 1
    print(f"  WebP escritos: {sum(modos.values())}  (piel {modos.get('piel',0)}, "
          f"B&W {modos.get('detalle',0)})")


# ---------------------------------------------------------------- River
def importar_river(src: Path, sql_path: Path, limit: int | None, chunk: int) -> int:
    filas = sql("""USE 3a1;
        SELECT DISTINCT j.id, j.nombre FROM jugadores j
        JOIN temporada_jugadores tj ON tj.jugador_id=j.id
        JOIN temporadas t ON t.id=tj.temporada_id
        JOIN clubes c ON c.id=t.club_id WHERE c.es_river=1;""")
    jugadores = [{"id": int(r[0]), "nombre": r[1]} for r in filas]
    por_norm = {norm(j["nombre"]): j for j in jugadores}

    files = files_in(src)
    if limit:
        files = files[:limit]
    mapa: dict[str, dict] = {}
    sobran = []
    for f in files:
        key = norm(f.stem)
        key = FILE_ALIAS_RIVER.get(key, key)
        if key in por_norm:
            mapa[f.name] = por_norm[key]
            continue
        candidatos = sorted(((score_name(f.stem, j["nombre"]), j) for j in jugadores),
                            key=lambda t: t[0], reverse=True)
        if candidatos and candidatos[0][0] >= 0.90:
            mapa[f.name] = candidatos[0][1]
        else:
            sobran.append(f.name)

    print(f"River: {len(jugadores)} jugadores · {len(files)} archivos · "
          f"{len(mapa)} mapeados · {len(sobran)} sin jugador")
    for n in sobran:
        print("  SOBRA", n)

    # Un archivo -> un jugador. Si dos archivos caen en el mismo jugador, el
    # primero gana y el segundo se reporta (caso Ricardo Ismael Rojas).
    elegido: dict[int, str] = {}
    for f in files:
        j = mapa.get(f.name)
        if not j:
            continue
        if j["id"] in elegido:
            print("  YA TIENE FOTO", j["nombre"], "->", elegido[j["id"]], "(ignoro", f.name + ")")
            continue
        elegido[j["id"]] = f.name

    # El recorte se hace por archivo, pero el WebP se nombra por jugador.
    por_archivo = {}
    for f in files:
        j = mapa.get(f.name)
        if j and elegido.get(j["id"]) == f.name:
            por_archivo[f.name] = f"/jugadores/{slug(j['nombre'])}.webp"

    results = crop_batch([f for f in files if f.name in por_archivo], {}, chunk)
    escribir_webp(results, OUT_RIVER, por_archivo)

    lineas = [
        "-- ============================================================",
        "-- 3A1 — Fotos de River del dueño (generado por importar_fotos_jugadores.py)",
        f"-- {len(por_archivo)} avatares locales en public/jugadores/.",
        "-- Solo limpia foto_epoca de temporadas de River; las de rivales",
        "-- (foto_epoca propia) se conservan.",
        "-- ============================================================",
        "USE `3a1`;",
        "",
    ]
    for jid, archivo in sorted(elegido.items(), key=lambda kv: kv[1]):
        if archivo not in por_archivo:
            continue
        nombre = next(j["nombre"] for j in jugadores if j["id"] == jid)
        lineas.append(f"UPDATE jugadores SET foto_url = '{sql_str(por_archivo[archivo])}' "
                      f"WHERE id = {jid}; -- {sql_str(nombre)}")
    lineas += [
        "",
        "UPDATE temporada_jugadores tj",
        "JOIN temporadas t ON t.id = tj.temporada_id",
        "JOIN clubes c ON c.id = t.club_id",
        "SET tj.foto_epoca = NULL, tj.foto_fuente = NULL, tj.foto_anio = NULL",
        "WHERE c.es_river = 1",
        "  AND tj.jugador_id IN (",
        "    " + ",".join(str(j["id"]) for j in jugadores if j["id"] in elegido) + ")",
        ";",
        "",
    ]
    sql_path.write_text("\n".join(lineas), encoding="utf-8")
    print(f"  SQL: {sql_path}")
    return 0


# ---------------------------------------------------------------- Rivales
def importar_rivales(src: Path, sql_path: Path, limit: int | None, chunk: int) -> int:
    filas = sql("""USE 3a1;
        SELECT tj.id, j.id, j.nombre, c.nombre, t.etiqueta, t.anio_orden
        FROM temporada_jugadores tj
        JOIN jugadores j ON j.id=tj.jugador_id
        JOIN temporadas t ON t.id=tj.temporada_id
        JOIN clubes c ON c.id=t.club_id
        WHERE c.es_river=0
        ORDER BY j.nombre, c.nombre, t.anio_orden;""")
    rows = [{"tj": int(r[0]), "jid": int(r[1]), "nombre": r[2], "club": r[3],
             "etiqueta": r[4], "anio": int(r[5])} for r in filas]
    por_nombre_club = defaultdict(list)
    por_norm = defaultdict(set)
    for r in rows:
        por_nombre_club[(norm(r["nombre"]), norm(r["club"]))].append(r)
        por_norm[norm(r["nombre"])].add(r["club"])

    files = files_in(src)
    if limit:
        files = files[:limit]
    mapa: dict[str, list[dict]] = {}
    sobran = []
    for f in files:
        stem = f.stem
        if "-" not in stem:
            # Caso Ariel Cuffaro Russo: sin club en el nombre.
            clave = norm(stem)
            candidatos = sorted(((score_name(stem, n), n) for n in por_norm),
                                key=lambda t: t[0], reverse=True)
            if candidatos and candidatos[0][0] >= 0.90:
                nombre = candidatos[0][1]
                destino = []
                for club in por_norm[nombre]:
                    destino += por_nombre_club[(nombre, club)]
                mapa[f.name] = destino
            else:
                sobran.append((f.name, "sin club en el nombre"))
            continue

        name_part, club_part = stem.rsplit("-", 1)
        club_key = CLUB_ALIAS.get(norm(club_part), norm(club_part))
        name_key = norm(name_part)
        destino = por_nombre_club.get((name_key, club_key))
        if destino:
            mapa[f.name] = destino
            continue

        # Fuzzy solo dentro del mismo club.
        candidatos = sorted(((score_name(name_part, r["nombre"]), r) for r in rows
                             if norm(r["club"]) == club_key),
                            key=lambda t: t[0], reverse=True)
        if candidatos and candidatos[0][0] >= 0.90:
            nombre = candidatos[0][1]["nombre"]
            mapa[f.name] = [r for r in rows
                            if norm(r["nombre"]) == norm(nombre) and norm(r["club"]) == club_key]
            continue

        # El nombre existe en otro club: probable sufijo de club equivocado.
        if name_key in por_norm:
            clubs = "/".join(sorted(por_norm[name_key]))
            sobran.append((f.name, f"club {club_key} no coincide; DB: {clubs}"))
        else:
            mejor = candidatos[0][0] if candidatos else 0
            sobran.append((f.name, f"sin jugador en {club_key} (mejor {mejor:.2f})"))

    print(f"Rivales: {len(rows)} participaciones · {len(files)} archivos · "
          f"{len(mapa)} mapeados · {len(sobran)} sin match")
    for n, why in sobran:
        print("  SOBRA", n, "|", why)

    # Un archivo -> todas las temporadas de ese jugador en ese club.
    # Slug: jugador-club. Si hay dos archivos para el mismo jugador+club, -2.
    por_archivo: dict[str, str] = {}
    usados = defaultdict(int)
    asignaciones: list[dict] = []
    for f in files:
        destino = mapa.get(f.name)
        if not destino:
            continue
        muestra = destino[0]
        base = f"{slug(muestra['nombre'])}-{slug(muestra['club'])}"
        usados[base] += 1
        nombre_archivo = base + ("" if usados[base] == 1 else f"-{usados[base]}") + ".webp"
        url = f"/jugadores/rivales/{nombre_archivo}"
        por_archivo[f.name] = url
        for r in destino:
            asignaciones.append({**r, "url": url, "archivo": f.name})

    results = crop_batch([f for f in files if f.name in por_archivo], {}, chunk)
    escribir_webp(results, OUT_RIVALES, por_archivo)

    # Una UPDATE por participación (foto_anio = año de la temporada).
    lineas = [
        "-- ============================================================",
        "-- 3A1 — Fotos de rivales del dueño (generado por importar_fotos_jugadores.py)",
        f"-- {len(asignaciones)} participaciones con foto_epoca local.",
        "-- No toca jugadores.foto_url: un jugador compartido conserva la foto",
        "-- de River en sus temporadas de River.",
        "-- ============================================================",
        "USE `3a1`;",
        "",
    ]
    for a in asignaciones:
        lineas.append(
            "UPDATE temporada_jugadores SET "
            f"foto_epoca = '{sql_str(a['url'])}', "
            f"foto_fuente = '{sql_str(a['archivo'])}', "
            f"foto_anio = {a['anio']} "
            f"WHERE id = {a['tj']}; -- {sql_str(a['nombre'])} · {sql_str(a['club'])} · {sql_str(a['etiqueta'])}"
        )
    lineas.append("")
    sql_path.write_text("\n".join(lineas), encoding="utf-8")
    print(f"  SQL: {sql_path}")
    return 0


def main() -> int:
    rivales = "--rivales" in sys.argv
    dir_override = next((a[6:] for a in sys.argv if a.startswith("--dir=")), None)
    sql_override = next((a[6:] for a in sys.argv if a.startswith("--sql=")), None)
    limit = next((int(a[8:]) for a in sys.argv if a.startswith("--limit=")), None)
    chunk = int(next((a[8:] for a in sys.argv if a.startswith("--chunk=")), "80"))
    if not CHROME.exists():
        print(f"No se encontró Chrome: {CHROME}")
        return 1
    src = Path(dir_override) if dir_override else (SRC_RIVALES if rivales else SRC_RIVER)
    if not src.is_dir():
        print(f"No se encontró la carpeta: {src}")
        return 1
    sql_path = Path(sql_override) if sql_override else (SQL_RIVALES if rivales else SQL_RIVER)
    if rivales:
        return importar_rivales(src, sql_path, limit, chunk)
    return importar_river(src, sql_path, limit, chunk)


if __name__ == "__main__":
    raise SystemExit(main())
