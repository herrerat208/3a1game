#!/usr/bin/env python3
"""Genera un build 'plano' para hostings con File Manager que no extrae ZIP.

Metemos el CSS y el JS dentro del index.html. Resultado: dist-plano/index.html
es AUTOCONTIENTE: se sube un solo archivo a htdocs/ y la app arranca sin
necesidad de crear la carpeta assets/.

Las fotos/escudos siguen siendo URLs absolutas (/jugadores/..., /escudos/...)
que vienen de la DB; si esas carpetas no están, la UI cae a la inicial.
Para traerlas, crear las carpetas en el File Manager y subir los archivos
(ver instrucciones en el chat). No tocamos public/jugadores ni las fotos.
"""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
OUT = ROOT / 'dist-plano'

html = (DIST / 'index.html').read_text(encoding='utf-8')

css_match = re.search(r'<link rel="stylesheet"[^>]*href="(/assets/[^"]+\.css)"[^>]*>', html)
js_match = re.search(r'<script type="module"[^>]*src="(/assets/[^"]+\.js)"[^>]*></script>', html)
if not css_match or not js_match:
    raise SystemExit('No encontré los tags de CSS/JS en dist/index.html (¿corriste npm run build?)')

css_path = DIST / css_match.group(1).lstrip('/')
js_path = DIST / js_match.group(1).lstrip('/')
css = css_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')

if '</script' in js.lower():
    raise SystemExit('El bundle contiene </script>; hay que escaparlo antes de inlinear.')

html = html.replace(css_match.group(0), '<style>\n' + css + '\n</style>')
html = html.replace(js_match.group(0), '<script type="module">\n' + js + '\n</script>')

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()

# El icono y el logo van en la raíz; se suben tal cual (ya están en dist/).
for nombre in ('favicon.png', 'favicon.svg', 'logo-3a1.webp'):
    src = DIST / nombre
    if src.exists():
        shutil.copy2(src, OUT / nombre)

(OUT / 'index.html').write_text(html, encoding='utf-8')

print(f'Generado: {OUT / "index.html"} ({(OUT / "index.html").stat().st_size / 1024:.0f} KB)')
print('CSS inlining:', css_path.name)
print('JS  inlining:', js_path.name)
print('Archivos para subir:', ', '.join(sorted(p.name for p in OUT.iterdir())))
