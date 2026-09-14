#!/usr/bin/env python3
"""
ARCHI — Génération du fichier de sorts pré-résolus (assets/spells.json).

Pour chaque champion, télécharge les données Data Dragon (champion/{id}.json) et
en extrait, DÉJÀ RÉSOLU :
  - le passif (nom + description avec balises de couleur Riot) ;
  - chaque sort : nom, CD/coût/portée, description, et surtout les MONTANTS par
    rang (Dégâts / Soin / Bouclier…) associés à leur étiquette, plus les ratios
    (AP/AD) quand Data Dragon les fournit.

Le site charge ensuite ce fichier local : plus aucune résolution à la volée,
insensible aux caches et aux formats de tooltip.

Exécuté par une GitHub Action (les runners GitHub ont accès à Internet).
Stdlib uniquement (urllib) : aucune dépendance.
"""
import json
import os
import re
import sys
import urllib.request

DD = 'https://ddragon.leagueoflegends.com'
LANG = 'fr_FR'
OUT = 'assets/spells.json'
UA = {'User-Agent': 'ARCHI-spell-sync (github-actions)'}

# Étiquettes de leveling à ignorer (déjà affichées dans la méta du sort)
SKIP_LABEL = re.compile(r'récup|recharge|cooldown|coût|\bcost\b|mana|énergie|energy|portée|\brange\b|regen', re.I)
# Traduction des liens de ratio → libellé court
VAR_LINK = {
    'spelldamage': 'AP', 'abilitypower': 'AP',
    'attackdamage': 'AD', 'bonusattackdamage': 'AD bonus',
    'armor': 'armure', 'bonusarmor': 'armure bonus',
    'health': 'PV', 'bonushealth': 'PV bonus', 'spellblock': 'RM',
}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode('utf-8')


def as_pct(x):
    try:
        f = float(x)
    except (TypeError, ValueError):
        return str(x)
    if 0 < f <= 3:
        return '%d%%' % round(f * 100)
    return ('%g' % (round(f * 100) / 100))


def resolve_effect(text, effburn, vmap):
    """Résout {{ eN }} (effectBurn) et {{ aN }} (vars). Renvoie la valeur par
    rang ou None si le token n'est pas résoluble (tokens nommés modernes)."""
    if not text:
        return None
    def sub_e(m):
        n = int(m.group(1))
        if 0 <= n < len(effburn) and effburn[n] not in (None, ''):
            return str(effburn[n])
        return m.group(0)
    s = re.sub(r'\{\{\s*e(\d+)\s*\}\}', sub_e, text, flags=re.I)

    def sub_v(m):
        v = vmap.get(m.group(1))
        if not v:
            return m.group(0)
        c = v.get('coeff')
        if isinstance(c, list):
            return '/'.join(as_pct(x) for x in c)
        return as_pct(c)
    s = re.sub(r'\{\{\s*([a-z]+\d+)\s*\}\}', sub_v, s, flags=re.I)

    s = re.split(r'->|→', s)[0]
    s = re.sub(r'<[^>]+>', '', s).strip()
    if not s or '{{' in s:
        return None
    return s


def progressions(effburn):
    """Tableaux effectBurn qui varient par rang (= valeurs de leveling)."""
    out = []
    for i in range(1, len(effburn)):
        b = effburn[i]
        if b in (None, '', '0'):
            continue
        parts = str(b).split('/')
        try:
            nums = [float(p) for p in parts]
        except ValueError:
            continue
        if len(nums) >= 2 and not all(n == nums[0] for n in nums):
            out.append(str(b))
    return out


def spell_damage_color(tooltip):
    """Type de dégâts dominant d'un sort d'après les balises Riot."""
    t = tooltip or ''
    if '<physicalDamage' in t:
        return 'physical'
    if '<magicDamage' in t:
        return 'magic'
    if '<trueDamage' in t:
        return 'true'
    return 'magic'


def row_color(label, spell_color):
    low = label.lower()
    if 'soin' in low or 'heal' in low or 'régén' in low:
        return 'heal'
    if 'bouclier' in low or 'shield' in low:
        return 'shield'
    return spell_color


def build_rows(spell):
    eff = spell.get('effectBurn') or []
    vmap = {}
    for v in (spell.get('vars') or []):
        if v.get('key'):
            vmap[v['key']] = v
    color = spell_damage_color(spell.get('tooltip'))

    prog = progressions(eff)
    pptr = 0
    rows = []
    lt = spell.get('leveltip') or {}
    labels = lt.get('label') if isinstance(lt.get('label'), list) else None
    effects = lt.get('effect') if isinstance(lt.get('effect'), list) else None
    if labels and effects:
        for i, raw_label in enumerate(labels):
            label = re.sub(r'<[^>]+>', '', str(raw_label or '')).strip()
            if not label or SKIP_LABEL.search(label):
                continue
            val = resolve_effect(effects[i] if i < len(effects) else '', eff, vmap)
            if val is None and pptr < len(prog):
                val = prog[pptr]
                pptr += 1
            if not val:
                continue
            rows.append({'label': label, 'value': val, 'color': row_color(label, color)})

    # Repli : pas de leveltip exploitable mais des progressions
    if not rows and prog:
        for v in prog[:3]:
            rows.append({'label': 'Valeurs / rang', 'value': v, 'color': color})

    # Ratios (vars)
    ratios, seen = [], set()
    for v in (spell.get('vars') or []):
        c = v.get('coeff')
        if isinstance(c, list):
            c = c[0] if c else None
        if c in (None, 0):
            continue
        pct = as_pct(c)
        link = v.get('link') or ''
        lbl = VAR_LINK.get(link) or ('' if link.startswith('@') else link)
        out = '+' + pct + ((' ' + lbl) if lbl else '')
        if out not in seen:
            seen.add(out)
            ratios.append(out)

    return rows, ratios


def main():
    versions = json.loads(fetch(DD + '/api/versions.json'))
    version = versions[0]
    champ_list = json.loads(fetch('%s/cdn/%s/data/%s/champion.json' % (DD, version, LANG)))
    ids = sorted(champ_list['data'].keys())

    champions = {}
    ok = 0
    for cid in ids:
        try:
            data = json.loads(fetch('%s/cdn/%s/data/%s/champion/%s.json' % (DD, version, LANG, cid)))
            c = data['data'][cid]
        except Exception as e:
            print('  ! %s : %s' % (cid, e), file=sys.stderr)
            continue
        keys = ['Q', 'W', 'E', 'R']
        spells = []
        for i, sp in enumerate(c.get('spells') or []):
            rows, ratios = build_rows(sp)
            spells.append({
                'key': keys[i] if i < len(keys) else '',
                'name': sp.get('name', ''),
                'cd': sp.get('cooldownBurn', ''),
                'cost': sp.get('costBurn', ''),
                'range': sp.get('rangeBurn', ''),
                'tooltip': sp.get('tooltip') or sp.get('description') or '',
                'rows': rows,
                'ratios': ratios,
            })
        passive = c.get('passive') or {}
        champions[cid] = {
            'passive': {'name': passive.get('name', ''), 'desc': passive.get('description', '')},
            'spells': spells,
        }
        ok += 1

    out = {'version': version, 'count': ok, 'champions': champions}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print('spells.json : %d champions (patch %s)' % (ok, version))


if __name__ == '__main__':
    main()
