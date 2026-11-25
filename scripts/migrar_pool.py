#!/usr/bin/env python3
"""Migra docs/*.docx del 3A1 a db/pool_completo.sql (idempotente) + db/report.txt.
Lee celda por celda (inmune a celdas vacias), valida todo y reporta rarezas.
Uso: python3 scripts/migrar_pool.py
"""
import re
import html
import pathlib
import zipfile
from collections import Counter

BASE = pathlib.Path('/mnt/c/Users/Usuario/OneDrive/Escritorio/repositorios github/laburos/3a1')
DOCS = BASE / 'docs'
POS_VALIDAS = {'ARQ', 'LD', 'LI', 'DFC', 'MD', 'MI', 'MC', 'MCD', 'MCO', 'ED', 'EI', 'DC'}

RE_RIVER = re.compile(
    r'^River (\d{4}) \(([^)]+)\)( 🏆 CAMPEÓN)?\s*—\s*OVR equipo base:\s*(\S+)\s*—\s*DT:\s*(.*)$')
RE_RIVAL = re.compile(
    r'^(.*?)((?:19|20)\d{2}.*) \(([^)]+)\):\s*— OVR equipo: (\S+)\s*$')


def doc_tablas(fname):
    """Devuelve [(head_texto, rows)] asociando cada tabla con su header previo."""
    z = zipfile.ZipFile(DOCS / fname)
    xml = z.read('word/document.xml').decode()
    eventos = []  # (offset, kind, payload)
    for m in re.finditer(r'<w:p[ >].*?</w:p>', xml, flags=re.DOTALL):
        ts = re.findall(r'<w:t(?=[ >])[^>]*>(.*?)</w:t>', m.group(0))
        line = ''.join(html.unescape(t) for t in ts).strip()
        if line:
            eventos.append((m.start(), 'head', line))
    for m in re.finditer(r'<w:tbl[ >].*?</w:tbl>', xml, flags=re.DOTALL):
        rows = []
        for tr in re.findall(r'<w:tr[ >].*?</w:tr>', m.group(0), flags=re.DOTALL):
            cells = []
            for tc in re.findall(r'<w:tc[ >].*?</w:tc>', tr, flags=re.DOTALL):
                ts = re.findall(r'<w:t(?=[ >])[^>]*>(.*?)</w:t>', tc)
                cells.append(html.unescape(''.join(ts)).strip())
            rows.append(cells)
        eventos.append((m.start(), 'table', rows))
    eventos.sort()
    out, head = [], None
    for _, kind, payload in eventos:
        if kind == 'head':
            head = payload
        else:
            out.append((head, payload))
            head = None
    return out


def rol_y_limpio(nombre):
    n = nombre
    if '⭐' in n:
        return 'mvp', n.replace('⭐MVP', '').replace('⭐', '').strip()
    if '★' in n:
        return 'estrella', n.replace('★', '').strip()
    return 'base', n.strip()


def sql_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


report = []
planteles = []  # dicts club, anio, etiqueta, form, ovr_eq, campeon, dt, jugadores[(nombre,pos,sec,base,rol)]

# ---- River ----
for head, rows in doc_tablas('River-3a1.docx'):
    m = RE_RIVER.match(head or '')
    if not m:
        continue
    anio, form, camp, ovr_eq, dt = m.groups()
    form = form.strip().rstrip('-')  # '4-5-1-' -> '4-5-1'
    datos = [r for r in rows if r[0] != 'Jugador']
    assert len(datos) == 11, f'River {anio}: {len(datos)} filas'
    jugs = []
    for r in datos:
        nombre, pos, sec, base, bonus, final = r
        rol, limpio = rol_y_limpio(nombre)
        jugs.append((limpio, pos.strip(), sec.replace('—', '').strip(), base, rol, final))
    planteles.append({'club': 'River Plate', 'anio': int(anio), 'etiqueta': f'River {anio}',
                      'form': form, 'ovr_eq': ovr_eq, 'campeon': camp is not None,
                      'dt': dt.strip(), 'jugadores': jugs, 'river': True})
assert len(planteles) == 87, f'River: {len(planteles)}'

# ---- Rivales ----
n_riv = 0
for head, rows in doc_tablas('Rivales-3a1.docx'):
    if not head or 'equipos rivales' in head:
        continue
    m = RE_RIVAL.match(head)
    assert m, f'header rival no matchea: {head!r}'
    club, espec, form, ovr_eq = (g.strip() for g in m.groups())
    anio = int(re.search(r'(19|20)\d{2}', espec).group(0))
    datos = [r for r in rows if r[0] != 'Jugador']
    assert len(datos) == 11, f'{club} {espec}: {len(datos)} filas'
    jugs = []
    for r in datos:
        nombre, pos, base, bonus, final = r
        rol, limpio = rol_y_limpio(nombre)
        jugs.append((limpio, pos.strip(), '', base, rol, final))
    planteles.append({'club': club, 'anio': anio, 'etiqueta': f'{club} {espec}',
                      'form': form.strip(), 'ovr_eq': ovr_eq, 'campeon': True,
                      'dt': None, 'jugadores': jugs, 'river': False})
    n_riv += 1
assert n_riv == 79, f'Rivales: {n_riv}'


def ovr_esperado(base, campeon, rol, river):
    if river:
        return base + (1 if campeon else 0) + (3 if rol == 'mvp' else (2 if rol == 'estrella' else 0))
    return base + (2 if rol == 'mvp' else (1 if rol == 'estrella' else 0))


# ---- Validación jugador por jugador ----
homonimos = Counter()
for p in planteles:
    for j in p['jugadores']:
        homonimos[j[0]] += 1
for p in planteles:
    vistos = set()
    for (nombre, pos, sec, base, rol, final) in p['jugadores']:
        tag = f"{p['etiqueta']}"
        if nombre in vistos:
            report.append(f'#{tag}: nombre repetido {nombre!r}')
        vistos.add(nombre)
        if pos not in POS_VALIDAS:
            report.append(f'#{tag}: posicion invalida {pos!r} en {nombre}')
        for s in [x.strip() for x in sec.split(',') if x.strip()]:
            if s not in POS_VALIDAS:
                report.append(f'#{tag}: secundaria invalida {s!r} en {nombre}')
        try:
            b, f = int(base), int(final)
        except ValueError:
            report.append(f'#{tag}: OVR no numerico en {nombre}: base={base!r} final={final!r}')
            continue
        if f != ovr_esperado(b, p['campeon'], rol, p['river']):
            report.append(
                f"#{tag}: {nombre} base {b} rol {rol} final {f} "
                f"(esperado {ovr_esperado(b, p['campeon'], rol, p['river'])}) -> se CALCULA, se ignora el doc")

# ---- SQL ----
L = []
L.append('-- ============================================================')
L.append('-- 3A1 — Pool completo: 87 planteles River + 79 rivales (docs/*.docx)')
L.append('-- Generado por scripts/migrar_pool.py. Idempotente (INSERT IGNORE).')
L.append('-- Ejecutar DESPUES de db/schema.sql. Requiere el ALTER de UNIQUE.')
L.append('-- ============================================================')
L.append('USE `3a1`;')
L.append('')
L.append("-- La consigna pedia UNIQUE(club, anio); hay planteles Metro+Nacional")
L.append("-- del mismo club y anio (Estudiantes 1982 / 1982 Nacional, etc.).")
L.append('-- Se pasa a UNIQUE(club, etiqueta). Solo para bases creadas antes.')
L.append('ALTER TABLE temporadas DROP INDEX IF EXISTS `club_id`, ADD UNIQUE KEY IF NOT EXISTS `uq_temp_club_etiqueta` (club_id, etiqueta);')
L.append("ALTER TABLE partidas ADD COLUMN IF NOT EXISTS `estilo` VARCHAR(20) NOT NULL DEFAULT 'equilibrado' AFTER `formacion`;")
L.append('ALTER TABLE resultados ADD COLUMN IF NOT EXISTS `avanzo` BOOLEAN NOT NULL DEFAULT TRUE;')
L.append('ALTER TABLE resultados ADD COLUMN IF NOT EXISTS `detalle` TEXT NULL;')
L.append('ALTER TABLE resultados ADD COLUMN IF NOT EXISTS `amistoso` BOOLEAN NOT NULL DEFAULT FALSE;')
L.append('CREATE TABLE IF NOT EXISTS `logros` (`id` INT AUTO_INCREMENT PRIMARY KEY, `partida_id` INT NOT NULL, `codigo` VARCHAR(40) NOT NULL, `fecha` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY `uq_logro` (`partida_id`, `codigo`), FOREIGN KEY (`partida_id`) REFERENCES `partidas`(`id`));')
L.append('')

clubes = sorted({p['club'] for p in planteles})
L.append('-- Clubes (nombres tal cual el doc; Boca corto se unifica abajo) --')
for c in clubes:
    es = 'TRUE' if c == 'River Plate' else 'FALSE'
    L.append(f"INSERT IGNORE INTO clubes (nombre, es_river) VALUES ({sql_str(c)}, {es});")
L.append('-- Unificar Boca Juniors (base vieja) con Boca (doc) --')
L.append("UPDATE IGNORE temporadas t JOIN clubes c_old ON c_old.id = t.club_id "
         "JOIN clubes c_new ON c_new.nombre = 'Boca' "
         "SET t.club_id = c_new.id WHERE c_old.nombre = 'Boca Juniors';")
L.append("DELETE FROM clubes WHERE nombre = 'Boca Juniors' AND NOT EXISTS "
         "(SELECT 1 FROM temporadas WHERE temporadas.club_id = clubes.id);")
L.append('')

dts = sorted({p['dt'] for p in planteles if p['dt']})
L.append(f'-- Tecnicos ({len(dts)}) --')
for d in dts:
    L.append(f"INSERT IGNORE INTO tecnicos (nombre) VALUES ({sql_str(d)});")
L.append('')

L.append('-- Temporadas --')
for p in planteles:
    try:
        ovr = int(p['ovr_eq'])
        ovr_sql = str(ovr) if 60 <= ovr <= 99 else 'NULL'
        if ovr_sql == 'NULL':
            report.append(f"#{p['etiqueta']}: ovr_equipo sospechoso {p['ovr_eq']!r} -> NULL")
    except ValueError:
        ovr_sql = 'NULL'
        report.append(f"#{p['etiqueta']}: ovr_equipo no numerico {p['ovr_eq']!r} -> NULL")
    dt_sel = ("(SELECT id FROM tecnicos WHERE nombre = %s)" % sql_str(p['dt'])) if p['dt'] else 'NULL'
    L.append(
        'INSERT IGNORE INTO temporadas (club_id, anio_orden, etiqueta, formacion, ovr_equipo, campeon, tecnico_id) '
        f"SELECT c.id, {p['anio']}, {sql_str(p['etiqueta'])}, {sql_str(p['form'])}, {ovr_sql}, "
        f"{'TRUE' if p['campeon'] else 'FALSE'}, {dt_sel} FROM clubes c WHERE c.nombre = {sql_str(p['club'])};")
L.append('')

nombres = sorted({j[0] for p in planteles for j in p['jugadores']})
L.append(f'-- Jugadores ({len(nombres)} unicos) --')
for n in nombres:
    L.append(f"INSERT IGNORE INTO jugadores (nombre) VALUES ({sql_str(n)});")
L.append('')

total = 0
L.append('-- Temporada_jugadores --')
for p in planteles:
    for (nombre, pos, sec, base, rol, final) in p['jugadores']:
        try:
            b = int(base)
        except ValueError:
            continue  # ya reportado; sin base no hay fila valida
        sec_csv = ','.join(x.strip() for x in sec.split(',') if x.strip())
        L.append(
            'INSERT IGNORE INTO temporada_jugadores '
            '(temporada_id, jugador_id, posicion_natural, posiciones_secundarias, ovr_base, es_estrella, es_mvp) '
            'SELECT t.id, j.id, %s, %s, %d, %s, %s FROM temporadas t '
            'JOIN clubes c ON c.id = t.club_id JOIN jugadores j ON j.nombre = %s '
            'WHERE c.nombre = %s AND t.etiqueta = %s;'
            % (sql_str(pos), sql_str(sec_csv), b,
               'TRUE' if rol == 'estrella' else 'FALSE', 'TRUE' if rol == 'mvp' else 'FALSE',
               sql_str(nombre), sql_str(p['club']), sql_str(p['etiqueta'])))
        total += 1

multi = sorted(n for n, c in homonimos.items() if c > 1)
report.append(f'INFO: {len(nombres)} nombres unicos; {len(multi)} aparecen en >1 temporada (misma fila jugador, correcto).')

(BASE / 'db' / 'pool_completo.sql').write_text('\n'.join(L) + '\n', encoding='utf-8')
rep_txt = [f'3A1 — report migracion pool completo',
           f'Planteles: {len(planteles)} (87 River + 79 rivales esperados)',
           f'Filas temporada_jugadores: {total}',
           '', '--- INCONSISTENCIAS (el SQL las resuelve calculando; el doc se ignora) ---'] + report
(BASE / 'db' / 'report.txt').write_text('\n'.join(rep_txt) + '\n', encoding='utf-8')
print(f'planteles={len(planteles)} jugadores_unicos={len(nombres)} filas={total} report={len(report)}')
for r in report:
    print(r)
