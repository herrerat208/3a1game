#!/usr/bin/env python3
"""Regenera el SQL de fotos de rivales para InfinityFree SIN consultar MySQL.

db/fotos_rivales.sql identifica las filas por temporada_jugadores.id, que es
autoincremental y no coincide entre XAMPP y el hosting. Este script lee ese
mismo archivo y convierte cada UPDATE en uno por nombre de jugador + etiqueta
de temporada, que sí es estable entre instalaciones.

El comentario final de cada línea del SQL original trae
`-- Nombre · Club · Etiqueta`. Cuando un mismo par (nombre, etiqueta) aparece
más de una vez (otra toma del mismo retrato), gana la última asignación, igual
que al ejecutar el SQL original en orden.

Uso: python3 scripts/generar_fotos_rivales_desde_sql.py db/infinityfree/08_fotos_rivales.sql
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORIGEN = ROOT / 'db' / 'fotos_rivales.sql'
BASE_DESTINO = 'if0_43478740_3a1'

if len(sys.argv) < 2:
    raise SystemExit('Uso: python3 scripts/generar_fotos_rivales_desde_sql.py SALIDA.sql')
salida = Path(sys.argv[1])

LINEA = re.compile(
    r"^UPDATE temporada_jugadores SET foto_epoca = '(?P<foto>[^']+)', "
    r"foto_fuente = '(?P<fuente>(?:[^']|'')*)', foto_anio = (?P<anio>\d+|NULL) "
    r"WHERE id = \d+; -- (?P<nombre>[^·]+) · (?P<club>[^·]+) · (?P<etiqueta>.+)$"
)

# dict conserva el orden de inserción; asignar de nuevo reemplaza el valor
# pero mantiene la posición, así el orden final es el del archivo original.
por_par = {}
for linea in ORIGEN.read_text(encoding='utf-8').splitlines():
    m = LINEA.match(linea)
    if not m:
        continue
    datos = m.groupdict()
    clave = (datos['nombre'].strip(), datos['etiqueta'].strip())
    por_par[clave] = (datos['foto'], datos['fuente'].replace("''", "'"), datos['anio'])


def esc(s):
    return s.replace('\\', '\\\\').replace("'", "''")


lineas = [
    '-- Generado por scripts/generar_fotos_rivales_desde_sql.py',
    '-- Fotos de rivales por NOMBRE + ETIQUETA (no por id autoincremental).',
    f'-- Base destino: `{BASE_DESTINO}`. No toca fotos de River ni jugadores.foto_url.',
    f'USE `{BASE_DESTINO}`;',
    '',
]
for (nombre, etiqueta), (foto, fuente, anio) in por_par.items():
    fuente_sql = 'NULL' if not fuente or fuente == 'NULL' else "'" + esc(fuente) + "'"
    anio_sql = 'NULL' if anio == 'NULL' else anio
    lineas.append(
        'UPDATE temporada_jugadores tj '
        'JOIN jugadores j ON j.id = tj.jugador_id '
        'JOIN temporadas t ON t.id = tj.temporada_id '
        f"SET tj.foto_epoca = '{esc(foto)}', tj.foto_fuente = {fuente_sql}, tj.foto_anio = {anio_sql} "
        f"WHERE j.nombre = '{esc(nombre)}' AND t.etiqueta = '{esc(etiqueta)}';"
    )

salida.write_text('\n'.join(lineas) + '\n', encoding='utf-8')
print(f'Generado {salida} con {len(por_par)} UPDATEs')
