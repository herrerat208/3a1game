#!/usr/bin/env python3
"""3A1 — genera los 5 avatares WebP de River que faltaron en la importación.

Los 288 WebP ya generados NO se tocan. Este script solo procesa los archivos
fuente del dueño que no tenían derivado, reutilizando el recorte facial del
importador principal (Chrome headless + canvas, sin Pillow/OpenCV y sin MySQL).

Uso:
  python3 scripts/importar_fotos_river_faltantes.py
  python3 scripts/importar_fotos_river_faltantes.py --forzar   # sobrescribe

Requiere Vite en http://localhost:5174 y Chrome headless.
"""

import base64
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from importar_fotos_jugadores import (  # noqa: E402
    CHROME, HTML, ROOT, SIZE, TMP, escribir_webp,
)

SRC = Path("/mnt/c/Users/Usuario/OneDrive/Escritorio/Carpeta fotos 3a1/River/Jugadores River")
PAGE = ROOT / "public" / "_importar_fotos.html"
# archivo fuente del dueño -> WebP destino (slug del nombre vigente en la DB)
FALTANTES = {
    "Marcos Acuña.jfif": "/jugadores/marcos-acuna.webp",
    "Matias Abeleiras.jfif": "/jugadores/matias-abelairas.webp",
    "Oscar Ahumada.jfif": "/jugadores/oscar-ahumada.webp",
    "Pablo Aimar.jfif": "/jugadores/pablo-aimar.webp",
    "Walter Acevedo.jfif": "/jugadores/walter-acevedo.webp",
}


def recortar(archivos: list[Path]) -> list[dict]:
    """Igual que crop_batch(), pero con un budget de Chrome que sí devuelve datos."""
    shutil.rmtree(TMP, ignore_errors=True)
    TMP.mkdir(parents=True, exist_ok=True)
    for fuente in archivos:
        shutil.copy2(fuente, TMP / fuente.name)
    nombres = [f.name for f in archivos]
    PAGE.write_text(
        HTML.replace("__FILES__", json.dumps(nombres, ensure_ascii=False))
            .replace("__AJUSTES__", "{}")
            .replace("__SIZE__", str(SIZE)),
        encoding="utf-8",
    )
    comando = [
        str(CHROME), "--headless", "--disable-gpu", "--no-sandbox",
        "--virtual-time-budget=30000", "--dump-dom",
        "http://localhost:5174/_importar_fotos.html",
    ]
    try:
        dom = subprocess.run(comando, capture_output=True, text=True, timeout=300).stdout
    finally:
        PAGE.unlink(missing_ok=True)
        shutil.rmtree(TMP, ignore_errors=True)
    m = re.search(r"FSTART(.*?)FEND", dom, re.S)
    if not m:
        raise RuntimeError("Chrome no devolvió datos (¿Vite caído?)")
    return json.loads(m.group(1))


def main() -> None:
    forzar = "--forzar" in sys.argv
    archivos = []
    for nombre in FALTANTES:
        fuente = SRC / nombre
        if not fuente.exists():
            raise SystemExit(f"Falta el archivo fuente: {fuente}")
        archivos.append(fuente)

    if not forzar:
        existentes = [d for d in FALTANTES.values() if (ROOT / "public" / d.lstrip("/")).exists()]
        if existentes:
            raise SystemExit("Ya existen los WebP: " + ", ".join(existentes) + " (usá --forzar)")

    print(f"Procesando {len(archivos)} fotos fuente sin derivado...", flush=True)
    resultados = recortar(archivos)
    escribir_webp(resultados, ROOT / "public" / "jugadores", FALTANTES)
    for destino in FALTANTES.values():
        p = ROOT / "public" / destino.lstrip("/")
        print(f"  {destino} -> {p.stat().st_size} bytes" if p.exists() else f"  FALLO: {destino}")


if __name__ == "__main__":
    main()
