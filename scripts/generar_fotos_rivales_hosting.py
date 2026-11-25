#!/usr/bin/env python3
"""Genera el SQL de fotos de rivales para la base del hosting.

db/fotos_rivales.sql identifica cada fila por temporada_jugadores.id, que es
autoincremento: el id de XAMPP no coincide con el de InfinityFree. Este script
lee las fotos ya cargadas en la base local y genera UPDATEs por nombre de
jugador + etiqueta de temporada, que sí son estables entre instalaciones.

No modifica db/fotos_rivales.sql, public/jugadores/ ni ninguna imagen.
Uso: python3 scripts/generar_fotos_rivales_hosting.py BASE_DESTINO SALIDA.sql
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

if len(sys.argv) < 3:
    raise SystemExit('Uso: python3 scripts/generar_fotos_rivales_hosting.py BASE_DESTINO SALIDA.sql')

db_destino, salida = sys.argv[1], Path(sys.argv[2])

SQL = """
SELECT j.nombre, t.etiqueta, tj.foto_epoca, tj.foto_fuente, tj.foto_anio
FROM temporada_jugadores tj
JOIN jugadores j ON j.id = tj.jugador_id
JOIN temporadas t ON t.id = tj.temporada_id
WHERE tj.foto_epoca LIKE '/jugadores/rivales/%'
ORDER BY j.nombre, t.etiqueta
"""

mysql = Path('/mnt/c/xampp/mysql/bin/mysql.exe')
proc = subprocess.run(
    [str(mysql), '-uroot', '--default-character-set=utf8mb4', '-N', '-B', '-D', '3a1'],
    input=SQL, text=True, capture_output=True
)
if proc.returncode:
    raise SystemExit('Error leyendo la base local: ' + proc.stderr.strip())


def esc(s):
    return s.replace('\\', '\\\\').replace("'", "''")


filas = []
vistos = set()
for linea in proc.stdout.splitlines():
    partes = linea.split('\t')
    if len(partes) != 5:
        continue
    nombre, etiqueta, foto, fuente, anio = partes
    clave = (nombre, etiqueta, foto, fuente, anio)
    if clave in vistos:
        continue
    vistos.add(clave)
    filas.append((nombre, etiqueta, foto, fuente, anio))

lineas = [
    '-- Generado por scripts/generar_fotos_rivales_hosting.py',
    f'-- Fotos de rivales por NOMBRE + ETIQUETA (no por id autoincremental).',
    f'-- Base destino: `{db_destino}`. No toca fotos de River ni jugadores.foto_url.',
    f'USE `{db_destino}`;',
    '',
]
for nombre, etiqueta, foto, fuente, anio in filas:
    fuente_sql = 'NULL' if fuente in ('', 'NULL') else "'" + esc(fuente) + "'"
    anio_sql = 'NULL' if anio in ('', 'NULL') else anio
    lineas.append(
        "UPDATE temporada_jugadores tj "
        "JOIN jugadores j ON j.id = tj.jugador_id "
        "JOIN temporadas t ON t.id = tj.temporada_id "
        f"SET tj.foto_epoca = '{esc(foto)}', tj.foto_fuente = {fuente_sql}, tj.foto_anio = {anio_sql} "
        f"WHERE j.nombre = '{esc(nombre)}' AND t.etiqueta = '{esc(etiqueta)}';"
    )

salida.write_text('\n'.join(lineas) + '\n', encoding='utf-8')
print(f'Generado {salida} con {len(filas)} UPDATEs')
