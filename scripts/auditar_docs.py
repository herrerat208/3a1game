#!/usr/bin/env python3
"""Audita docs/*.docx del juego 3A1: estructura, posiciones, OVR y rarezas.
Uso: python3 scripts/auditar_docs.py  (solo lee, no modifica nada)
"""
import re
import html
import pathlib
import zipfile
from collections import Counter

DOCS = pathlib.Path('/mnt/c/Users/Usuario/OneDrive/Escritorio/repositorios github/laburos/3a1/docs')
POS_VALIDAS = {'ARQ', 'LD', 'LI', 'DFC', 'MD', 'MI', 'MC', 'MCD', 'MCO', 'ED', 'EI', 'DC'}

RE_RIVER_HEAD = re.compile(
    r'^River (\d{4}) \(([^)]+)\)( 🏆 CAMPEÓN)? — OVR equipo base: (\S+) — DT: (.*)$')
RE_RIVAL_HEAD = re.compile(
    r'^(.+?) ((?:19|20)\d{2}(?:/\d{2})?(?: [\w+]+)*(?: \+ [\w ]+)?) \(([^)]+)\):\s*— OVR equipo: (\S+)\s*$')


def lineas(fname):
    z = zipfile.ZipFile(DOCS / fname)
    xml = z.read('word/document.xml').decode()
    out = []
    for pa in re.findall(r'<w:p[ >].*?</w:p>', xml, flags=re.DOTALL):
        ts = re.findall(r'<w:t[^>]*>(.*?)</w:t>', pa)
        line = ''.join(html.unescape(t) for t in ts).strip()
        if line:
            out.append(line)
    return out


def rol_y_limpio(nombre):
    if '⭐' in nombre or 'MVP' in nombre.upper().replace('⭐', ''):
        return 'mvp', nombre.replace('⭐MVP', '').replace('⭐', '').replace('MVP', '').strip()
    if '★' in nombre:
        return 'estrella', nombre.replace('★', '').strip()
    return 'base', nombre.strip()


def ovr_esperado(base, campeon, rol, es_river):
    if es_river:
        return base + (1 if campeon else 0) + (3 if rol == 'mvp' else (2 if rol == 'estrella' else 0))
    return base + (2 if rol == 'mvp' else (1 if rol == 'estrella' else 0))


def parse_river(ls):
    planteles, i, problemas = [], 0, []
    while i < len(ls):
        m = RE_RIVER_HEAD.match(ls[i])
        if not m:
            i += 1
            continue
        anio, form, camp, ovr_eq, dt = m.groups()
        campeon = camp is not None
        # 6 encabezados de columna
        cols = ls[i + 1:i + 7]
        j = i + 7
        jugadores = []
        for _ in range(11):
            cells = ls[j:j + 6]
            if len(cells) < 6:
                problemas.append(f'River {anio}: faltan celdas en jugador #{len(jugadores)+1}: {cells}')
                break
            jugadores.append(cells)
            j += 6
        planteles.append({'club': 'River Plate', 'anio': int(anio), 'form': form,
                          'campeon': campeon, 'ovr_eq': ovr_eq, 'dt': dt, 'jugadores': jugadores})
        i = j
    return planteles, problemas


def parse_rivales(ls):
    planteles, i, problemas = [], 0, []
    while i < len(ls):
        m = RE_RIVAL_HEAD.match(ls[i])
        if not m:
            i += 1
            continue
        club, espec, form, ovr_eq = m.groups()
        anio = int(re.search(r'(19|20)\d{2}', espec).group(0))
        cols = ls[i + 1:i + 6]
        j = i + 6
        jugadores = []
        for _ in range(11):
            cells = ls[j:j + 5]
            if len(cells) < 5:
                problemas.append(f'{club} {espec}: faltan celdas en jugador #{len(jugadores)+1}')
                break
            jugadores.append(cells)
            j += 5
        planteles.append({'club': club.strip(), 'anio': anio, 'espec': espec, 'form': form,
                          'campeon': True, 'ovr_eq': ovr_eq, 'dt': None, 'jugadores': jugadores})
        i = j
    return planteles, problemas


def auditar(planteles, es_river):
    rep = {'n': len(planteles), 'jug': 0, 'mal_count': [], 'pos_malas': Counter(),
           'ovr_mal': [], 'base_mal': [], 'form': Counter(), 'dts': set(), 'clubes': set()}
    for p in planteles:
        rep['form'][p['form']] += 1
        if p.get('dt'):
            rep['dts'].add(p['dt'])
        rep['clubes'].add(p['club'])
        if len(p['jugadores']) != 11:
            rep['mal_count'].append(f"{p['club']} {p['anio']}: {len(p['jugadores'])} jugadores")
        vistos = set()
        for cells in p['jugadores']:
            rep['jug'] += 1
            if es_river:
                nombre, pos, sec, base, bonus, final = cells
            else:
                nombre, pos, base, bonus, final = cells
                sec = ''
            rol, limpio = rol_y_limpio(nombre)
            if limpio in vistos:
                rep['ovr_mal'].append(f"{p['club']} {p['anio']}: nombre repetido '{limpio}'")
            vistos.add(limpio)
            for code in [pos] + [s.strip() for s in sec.split(',') if s.strip() and s.strip() != '—']:
                if code not in POS_VALIDAS:
                    rep['pos_malas'][f"{p['club']} {p['anio']}: '{code}'"] += 1
            try:
                b, f = int(base), int(final)
                esp = ovr_esperado(b, p['campeon'], rol, es_river)
                if f != esp:
                    rep['ovr_mal'].append(
                        f"{p['club']} {p['anio']}: {limpio} base {b} rol {rol} final {f} (esperado {esp})")
            except ValueError:
                rep['base_mal'].append(f"{p['club']} {p['anio']}: {cells}")
    return rep


river = lineas('River-3a1.docx')
riv = lineas('Rivales-3a1.docx')
pr, prob_river = parse_river(river)
pv, prob_riv = parse_rivales(riv)
print(f'River: {len(pr)} planteles | Rivales: {len(pv)} planteles')
print('Problemas de parseo River:', prob_river[:10] or 'ninguno')
print('Problemas de parseo Rivales:', prob_riv[:10] or 'ninguno')
for titulo, pls, erv in [('RIVER', pr, True), ('RIVALES', pv, False)]:
    r = auditar(pls, erv)
    print(f'--- {titulo}: {r["n"]} planteles, {r["jug"]} jugadores ---')
    print('formaciones:', dict(r['form']))
    print('clubes:', len(r['clubes']), sorted(r['clubes'])[:8], '...' if len(r['clubes']) > 8 else '')
    if erv:
        print('DTs distintos:', len(r['dts']))
    print('planteles con !=11:', r['mal_count'] or 'ninguno')
    print('posiciones invalidas:', dict(r['pos_malas']) or 'ninguna')
    print('OVR base no numerico:', len(r['base_mal']))
    for x in r['base_mal'][:10]:
        print('  ', x)
    print('inconsistencias OVR/nombres:', len(r['ovr_mal']))
    for x in r['ovr_mal'][:40]:
        print('  ', x)
