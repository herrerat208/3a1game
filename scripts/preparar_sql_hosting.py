# Genera los .sql listos para importar en un hosting compartido.
# Uso: python3 scripts/preparar_sql_hosting.py NOMBRE_DE_LA_BASE [carpeta_salida]
# Ejemplo: python3 scripts/preparar_sql_hosting.py u123456789_3a1 db/hostinger
import os
import re
import sys

if len(sys.argv) < 2:
    raise SystemExit('Uso: python3 scripts/preparar_sql_hosting.py NOMBRE_DE_LA_BASE [salida]')

db = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else 'db/hostinger'
os.makedirs(out, exist_ok=True)


def adaptar(src, dst, quitar_alter=False):
    txt = open(src, encoding='utf-8').read()
    # La base ya la creó el panel: no hace falta CREATE DATABASE y puede
    # fallar si el usuario no tiene permiso global.
    txt = re.sub(r'CREATE DATABASE IF NOT EXISTS `3a1`.*?COLLATE [^;]+;\s*', '', txt,
                 count=1, flags=re.S)
    txt = txt.replace('USE `3a1`;', f'USE `{db}`;')
    if quitar_alter:
        # Para bases nuevas: schema.sql ya trae estas columnas/índices.
        txt = ''.join(l for l in txt.splitlines(True)
                      if not re.match(r'ALTER TABLE .* ADD COLUMN IF NOT EXISTS ', l)
                      and not re.match(r'ALTER TABLE temporadas DROP INDEX IF EXISTS ', l))
    cabecera = (f'-- Generado para hosting compartido — base `{db}`\n'
                '-- La base ya existe (creada en el panel del proveedor). Sin CREATE DATABASE.\n'
                '-- Si elegiste otro nombre en el panel, reemplazá `%s` en los tres archivos.\n\n' % db)
    with open(dst, 'w', encoding='utf-8') as f:
        f.write(cabecera + txt)
    print('OK', dst)


adaptar('db/schema.sql', f'{out}/01_schema.sql')
adaptar('db/pool_completo.sql', f'{out}/02_pool.sql', quitar_alter=True)
adaptar('db/migracion_ortografia.sql', f'{out}/03_correcciones_nombres.sql')
adaptar('db/fotos_jugadores.sql', f'{out}/04_fotos_jugadores.sql')
adaptar('db/escudos_river.sql', f'{out}/05_escudos_river.sql')
adaptar('db/escudos_rivales.sql', f'{out}/06_escudos_rivales.sql')
adaptar('db/reparar_localia_calendario.sql', f'{out}/07_reparar_localia.sql')
print('Importar en phpMyAdmin en este orden:')
print('  01_schema.sql, 02_pool.sql, 03_correcciones_nombres.sql (ya hechos)')
print('  04_fotos_jugadores.sql, 05_escudos_river.sql, 06_escudos_rivales.sql (nuevos)')
print('  07_reparar_localia.sql (UNA VEZ; arregla partidos ya jugados de visitante)')
print('Ojo: los archivos de imágenes deben estar en htdocs/jugadores/ y htdocs/escudos/.')
