#!/usr/bin/env python3
"""Fusiona filas duplicadas por mojibake en la base 3a1.
Uso: python3 scripts/fusionar_dupes.py [--apply]
Sin --apply solo reporta. Con --apply ejecuta (hacer backup antes).
"""
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher

APPLY = '--apply' in sys.argv
MYSQL = ['/mnt/c/xampp/mysql/bin/mysql.exe', '-u', 'root', '3a1', '-N', '-e']


def q(s):
    r = subprocess.run(MYSQL + [s], capture_output=True)
    return r.stdout.decode('utf-8', errors='replace')


def norm(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '', s)


repo = '/mnt/c/Users/Usuario/OneDrive/Escritorio/repositorios github/laburos/3a1'
sql = open(repo + '/db/pool_completo.sql', encoding='utf-8').read()
canon_j = set()
for n in re.findall(r"INSERT IGNORE INTO jugadores \(nombre\) VALUES \('((?:[^'\\]|\\.)*)'\);", sql):
    canon_j.add(n.replace("\\'", "'"))
canon_temp = set()
for m in re.finditer(r"FROM clubes c WHERE c\.nombre = '((?:[^'\\]|\\.)*)';", sql):
    pass
# etiquetas canonicas: reconstruir desde INSERTs de temporadas
canon_et = set()
for m in re.finditer(
        r"SELECT c\.id, (\d+), '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)', (\S+?), (TRUE|FALSE), .*?FROM clubes c WHERE c\.nombre = '((?:[^'\\]|\\.)*)';",
        sql):
    anio, et, form, ovr, camp, club = m.groups()
    canon_et.add((club.replace("\\'", "'"), et.replace("\\'", "'")))

# tj: id, temporada, club, etiqueta, jugador
tj = []
for line in q('SELECT tj.id, tj.temporada_id, c.nombre, t.etiqueta, j.nombre, j.id FROM temporada_jugadores tj '
              'JOIN temporadas t ON t.id=tj.temporada_id JOIN clubes c ON c.id=t.club_id '
              'JOIN jugadores j ON j.id=tj.jugador_id;').splitlines():
    if line.strip():
        tjid, tid, club, et, jn, jid = line.split('\t')
        tj.append({'tjid': tjid, 'tid': tid, 'club': club, 'et': et, 'jn': jn, 'jid': jid})

canon_tids = set()
tid_of = {}
for line in q('SELECT t.id, c.nombre, t.etiqueta FROM temporadas t JOIN clubes c ON c.id=t.club_id;').splitlines():
    if line.strip():
        tid, club, et = line.split('\t')
        tid_of[tid] = (club, et)
        if (club, et) in canon_et:
            canon_tids.add(tid)
print(f'temporadas DB con etiqueta canonica exacta: {len(canon_tids)}')

by_temp = defaultdict(list)
for r in tj:
    by_temp[r['tid']].append(r)

def best_in(target_rows, name):
    best, br = None, 0
    for r in target_rows:
        x = SequenceMatcher(None, norm(name), norm(r['jn'])).ratio()
        if x > br:
            best, br = r, x
    return best, br

acciones = []  # (tipo, detalle, sqls)
# 1) temporadas no canonicas -> fusionar en la canonica con mayor solape
for tid, rows in sorted(by_temp.items()):
    if tid in canon_tids:
        continue
    overlap = defaultdict(int)
    cand = defaultdict(list)
    for r in rows:
        for tid2 in canon_tids:
            b, x = best_in(by_temp[tid2], r['jn'])
            if x > 0.85:
                overlap[tid2] += 1
                cand[(tid2, r['tjid'])] = b
    if not overlap:
        acciones.append(('EXTRA_SIN_MATCH', f"temporada {tid} sin candidata", []))
        continue
    dest = max(overlap, key=overlap.get)
    acciones.append(('MERGE_TEMP', f"{tid} -> {dest} (solape {overlap[dest]}/{len(rows)})",
                     [(r['tjid'], cand[(dest, r['tjid'])]) for r in rows if (dest, r['tjid']) in cand]))

print(f'temporadas extra: {sum(1 for t in by_temp if t not in canon_tids)}')
for a in acciones:
    print(' ', a[0], a[1])

# 2) duplicados dentro de canonicas (similitud > 0.9, distinto id)
print('--- duplicados intra-temporada canonica ---')
intra = 0
for tid in sorted(canon_tids):
    rows = by_temp.get(tid, [])
    seen = {}
    for r in rows:
        key = None
        for k in seen:
            if SequenceMatcher(None, norm(k), norm(r['jn'])).ratio() > 0.9 and k != r['jn']:
                key = k
                break
        if key is None:
            seen[r['jn']] = r
        else:
            intra += 1
            keep = seen[key] if seen[key]['jn'] in canon_j else r
            lose = r if keep == seen[key] else seen[key]
            if keep == r:
                seen[key] = r
            print(f'  temp {tid}: KEEP tj={keep["tjid"]} {keep["jn"]!r}  DROP tj={lose["tjid"]} {lose["jn"]!r}')
print('grupos intra:', intra)
print('MODO:', 'APLICANDO' if APPLY else 'DRY-RUN (nada ejecutado)')

if not APPLY:
    raise SystemExit


def run(sqls):
    for s in sqls:
        r = subprocess.run(MYSQL + [s], capture_output=True, text=True)
        if r.returncode != 0:
            print('SQL ERROR:', r.stderr.strip()[:200], '>>', s[:120])
            raise SystemExit(1)


# Reconstruir pares (loser_tj -> keeper_tj)
pares = []
# extras -> canon
for tid, rows in sorted(by_temp.items()):
    if tid in canon_tids:
        continue
    overlap = defaultdict(int)
    cand = {}
    for r in rows:
        for tid2 in canon_tids:
            b, x = best_in(by_temp[tid2], r['jn'])
            if x > 0.85:
                overlap[tid2] += 1
                cand[(tid2, r['tjid'])] = b
    if not overlap:
        print('EXTRA_SIN_MATCH, se conserva:', tid)
        continue
    dest = max(overlap, key=overlap.get)
    for r in rows:
        if (dest, r['tjid']) in cand:
            pares.append((r['tjid'], cand[(dest, r['tjid'])]['tjid']))
# intra canon
for tid in sorted(canon_tids):
    rows = by_temp.get(tid, [])
    seen = {}
    for r in rows:
        key = None
        for k in seen:
            if k != r['jn'] and SequenceMatcher(None, norm(k), norm(r['jn'])).ratio() > 0.9:
                key = k
                break
        if key is None:
            seen[r['jn']] = r
        else:
            keep = seen[key] if seen[key]['jn'] in canon_j else r
            lose = r if keep == seen[key] else seen[key]
            if keep == r:
                seen[key] = r
            pares.append((lose['tjid'], keep['tjid']))

print(f'pares a fusionar: {len(pares)}')
perdidas = 0
for loser, keeper in pares:
    # ¿la partida ya tiene al keeper? (mismo jugador dos veces) -> se borra el pick duplicado
    dup = q(f'SELECT pj.id FROM partida_jugadores pj WHERE pj.temporada_jugador_id={loser} '
            f'AND EXISTS (SELECT 1 FROM partida_jugadores q2 WHERE q2.partida_id=pj.partida_id '
            f'AND q2.temporada_jugador_id={keeper});').strip()
    if dup:
        for pid in dup.splitlines():
            run([f'DELETE FROM partida_jugadores WHERE id={pid.strip()};'])
            perdidas += 1
    run([f'UPDATE partida_jugadores SET temporada_jugador_id={keeper} WHERE temporada_jugador_id={loser};',
         f'DELETE FROM temporada_jugadores WHERE id={loser};'])
print(f'picks duplicados eliminados: {perdidas}')

# temporadas extra vacías -> borrar
run(['DELETE t FROM temporadas t LEFT JOIN temporada_jugadores tj ON tj.temporada_id=t.id '
     'WHERE tj.id IS NULL;'])
# jugadores huerfanos no canonicos -> borrar
canon_list = ','.join("'" + n.replace("'", "\\'") + "'" for n in canon_j)
run([f'DELETE FROM jugadores WHERE nombre NOT IN ({canon_list}) AND id NOT IN '
     '(SELECT jugador_id FROM temporada_jugadores);'])
# clubes vacíos no canonicos -> borrar
run(["DELETE c FROM clubes c LEFT JOIN temporadas t ON t.club_id=c.id WHERE t.id IS NULL "
     "AND c.nombre NOT IN ('River Plate','Boca','Independiente','Racing','Estudiantes','San Lorenzo','Vélez',"
     "'Chacarita','Rosario Central','Huracán','Newell’s','Quilmes','Ferro','Argentinos Juniors','Lanús',"
     "'Banfield','Arsenal','Platense','Belgrano');"])
print('--- conteo final ---')
print(q('SELECT (SELECT COUNT(*) FROM temporadas) t, (SELECT COUNT(*) FROM jugadores) j, '
        '(SELECT COUNT(*) FROM temporada_jugadores) tj, (SELECT COUNT(*) FROM clubes) c, '
        '(SELECT COUNT(*) FROM partidas) p;'))
