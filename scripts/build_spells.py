#!/usr/bin/env python3
"""
ARCHI — Génération du fichier de sorts pré-résolus (assets/spells.json).

Combine deux sources Riot (les runners GitHub ont accès à Internet) :
  - Data Dragon  : noms, CD/coût/portée, description colorée, étiquettes
    localisées (leveltip) et valeurs héritées (effectBurn).
  - CommunityDragon (v1/champions/{key}) : effectAmounts (montants par rang) et
    coefficients (ratios AP/AD) pour les sorts que Data Dragon n'expose plus.

Pour chaque sort on produit des lignes {étiquette, valeur par rang, couleur} et
la liste des ratios. Le site charge ce fichier local : plus de résolution à la
volée, insensible aux caches.

Limite connue : quelques sorts retravaillés stockent leurs montants uniquement
dans le bin de jeu (ni effectBurn, ni effectAmounts) — ils resteront sans
montant (description seule).

Stdlib uniquement (urllib).
"""
import json
import os
import re
import sys
import urllib.request

DD = 'https://ddragon.leagueoflegends.com'
CD = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions'
MK = 'https://cdn.merakianalytics.com/riot/lol/resources/latest/en/champions'
LANG = 'fr_FR'
OUT = 'assets/spells.json'
UA = {'User-Agent': 'ARCHI-spell-sync (github-actions)'}

SKIP_LABEL = re.compile(r'récup|recharge|cooldown|coût|\bcost\b|mana|énergie|energy|portée|\brange\b|regen', re.I)
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


def fetch_json(url):
    return json.loads(fetch(url))


def as_pct(x):
    try:
        f = float(x)
    except (TypeError, ValueError):
        return str(x)
    if 0 < f <= 3:
        return '%d%%' % round(f * 100)
    return ('%g' % (round(f * 100) / 100))


def num_str(n):
    return ('%g' % (round(float(n) * 100) / 100))


def spell_color(tooltip):
    t = tooltip or ''
    if '<physicalDamage' in t:
        return 'physical'
    if '<magicDamage' in t:
        return 'magic'
    if '<trueDamage' in t:
        return 'true'
    return 'magic'


def row_color(label, base):
    low = label.lower()
    if 'soin' in low or 'heal' in low or 'régén' in low:
        return 'heal'
    if 'bouclier' in low or 'shield' in low:
        return 'shield'
    if 'armure' in low or 'armor' in low or 'résist' in low or 'resist' in low:
        return 'shield'
    return base


def dd_progressions(effburn):
    out = []
    for i in range(1, len(effburn or [])):
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


def cd_progressions(cd_spell, maxrank):
    """effectAmounts non nuls et variables → valeurs par rang (rangs 1..maxrank)."""
    ea = (cd_spell or {}).get('effectAmounts') or {}
    mr = maxrank if maxrank and maxrank > 0 else 5
    out = []
    for i in range(1, 11):
        arr = ea.get('Effect%dAmount' % i)
        if not isinstance(arr, list):
            continue
        vals = arr[1:1 + mr] if len(arr) > mr else arr
        nums = [v for v in vals if isinstance(v, (int, float))]
        if len(nums) >= 2 and any(n != 0 for n in nums) and not all(n == nums[0] for n in nums):
            out.append('/'.join(num_str(n) for n in nums))
    return out


def cd_ratios(cd_spell, color):
    """coefficients CommunityDragon → ratios, libellés par type de dégâts."""
    coeffs = (cd_spell or {}).get('coefficients') or {}
    stat = {'magic': 'AP', 'physical': 'AD', 'true': ''}.get(color, 'AP')
    out = []
    for key in ('coefficient1', 'coefficient2'):
        c = coeffs.get(key)
        if isinstance(c, (int, float)) and c > 0:
            out.append('+%d%%%s' % (round(c * 100), (' ' + stat) if stat else ''))
    return out


MK_ATTR = {
    'magic damage': 'Dégâts magiques', 'physical damage': 'Dégâts physiques',
    'true damage': 'Dégâts bruts', 'total damage': 'Dégâts',
    'damage': 'Dégâts', 'bonus damage': 'Dégâts bonus',
    'heal': 'Soin', 'healing': 'Soin', 'health restored': 'Soin',
    'shield': 'Bouclier', 'shield strength': 'Bouclier',
    'damage per second': 'Dégâts / s', 'minimum damage': 'Dégâts min',
    'maximum damage': 'Dégâts max', 'monster damage': 'Dégâts (monstres)',
    'slow': 'Ralentissement', 'movement speed': 'Vitesse de déplacement',
    'attack speed': "Vitesse d'attaque", 'bonus attack speed': "Vitesse d'attaque bonus",
    'stun duration': "Durée d'étourdissement", 'duration': 'Durée',
    'range': 'Portée', 'cooldown': 'Récup', 'mana restored': 'Mana rendu',
}
MK_COLOR = [
    ('magic', 'magic'), ('physical', 'physical'), ('true', 'true'),
    ('heal', 'heal'), ('soin', 'heal'), ('shield', 'shield'), ('bouclier', 'shield'),
]


def mk_label(attr):
    a = (attr or '').strip()
    return MK_ATTR.get(a.lower(), a)


def mk_color(attr):
    low = (attr or '').lower()
    for kw, col in MK_COLOR:
        if kw in low:
            return col
    return 'magic'


def mk_stat(unit):
    u = (unit or '').lower()
    if 'ability power' in u or re.search(r'\bap\b', u):
        return 'AP'
    if 'bonus ad' in u or 'bonus attack damage' in u:
        return 'AD bonus'
    if 'attack damage' in u or re.search(r'\bad\b', u):
        return 'AD'
    if 'max' in u and 'health' in u:
        return 'PV max'
    if 'bonus health' in u:
        return 'PV bonus'
    if 'health' in u:
        return 'PV'
    if 'armor' in u:
        return 'armure'
    if 'magic resist' in u:
        return 'RM'
    return u.replace('%', '').strip()


def mk_is_ratio(units):
    for u in units:
        if u and (('%' in u) or re.search(r'[a-zA-Z]', u)):
            return True
    return False


def mk_rows(mk_ability):
    """Sort Meraki (déjà résolu) → lignes {label,value,color} + ratios."""
    if not mk_ability:
        return [], []
    ab = mk_ability[0] if isinstance(mk_ability, list) else mk_ability
    if not isinstance(ab, dict):
        return [], []
    rows, ratios, seen = [], [], set()
    for eff in (ab.get('effects') or []):
        for lv in (eff.get('leveling') or []):
            attr = lv.get('attribute') or ''
            if SKIP_LABEL.search(attr):
                continue
            base_row = None
            for mod in (lv.get('modifiers') or []):
                vals = mod.get('values') or []
                units = mod.get('units') or []
                nums = [v for v in vals if isinstance(v, (int, float))]
                if not nums:
                    continue
                if mk_is_ratio(units):
                    u = next((x for x in units if x), '')
                    stat = mk_stat(u)
                    v0 = nums[0]
                    pct = round(v0) if '%' in u else (round(v0 * 100) if abs(v0) <= 3 else round(v0))
                    out = '+%d%%%s' % (pct, (' ' + stat) if stat else '')
                    if pct and out not in seen:
                        seen.add(out)
                        ratios.append(out)
                elif base_row is None and any(n != 0 for n in nums):
                    if all(n == nums[0] for n in nums):
                        val = num_str(nums[0])
                    else:
                        val = '/'.join(num_str(n) for n in nums)
                    base_row = {'label': mk_label(attr), 'value': val,
                                'color': row_color(mk_label(attr), mk_color(attr))}
            if base_row:
                rows.append(base_row)
    return rows, ratios


def resolve_effect(text, effburn, vmap):
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


def build_rows(dd_spell, cd_spell, mk_ability=None):
    eff = dd_spell.get('effectBurn') or []
    vmap = {v['key']: v for v in (dd_spell.get('vars') or []) if v.get('key')}
    color = spell_color(dd_spell.get('tooltip'))
    maxrank = dd_spell.get('maxrank') or 5

    # Réserve de valeurs par rang : DDragon d'abord, sinon CommunityDragon.
    prog = dd_progressions(eff)
    if not prog:
        prog = cd_progressions(cd_spell, maxrank)
    pptr = 0

    rows = []
    lt = dd_spell.get('leveltip') or {}
    labels = lt.get('label') if isinstance(lt.get('label'), list) else None
    effects = lt.get('effect') if isinstance(lt.get('effect'), list) else None
    if labels and effects:
        for i, raw in enumerate(labels):
            label = re.sub(r'<[^>]+>', '', str(raw or '')).strip()
            if not label or SKIP_LABEL.search(label):
                continue
            val = resolve_effect(effects[i] if i < len(effects) else '', eff, vmap)
            if val is None and pptr < len(prog):
                val = prog[pptr]
                pptr += 1
            if not val:
                continue
            rows.append({'label': label, 'value': val, 'color': row_color(label, color)})

    if not rows and prog:
        for v in prog[:3]:
            rows.append({'label': 'Valeurs / rang', 'value': v, 'color': color})

    # Ratios : vars DDragon + coefficients CommunityDragon
    ratios, seen = [], set()
    for v in (dd_spell.get('vars') or []):
        c = v.get('coeff')
        if isinstance(c, list):
            c = c[0] if c else None
        if c in (None, 0):
            continue
        link = v.get('link') or ''
        lbl = VAR_LINK.get(link) or ('' if link.startswith('@') else link)
        out = '+' + as_pct(c) + ((' ' + lbl) if lbl else '')
        if out not in seen:
            seen.add(out)
            ratios.append(out)
    for r in cd_ratios(cd_spell, color):
        if r not in seen:
            seen.add(r)
            ratios.append(r)

    # Recours Meraki (déjà résolu) : comble les sorts retravaillés dont les
    # montants/ratios ne vivent que dans le bin de jeu (Ahri, Jinx, Garen…).
    if not rows or not ratios:
        mk_r, mk_ratios = mk_rows(mk_ability)
        if not rows and mk_r:
            rows = mk_r
        if not ratios:
            for r in mk_ratios:
                if r not in seen:
                    seen.add(r)
                    ratios.append(r)

    return rows, ratios


def main():
    version = fetch_json(DD + '/api/versions.json')[0]
    champ_list = fetch_json('%s/cdn/%s/data/%s/champion.json' % (DD, version, LANG))['data']
    # id -> clé numérique (pour CommunityDragon)
    key_by_id = {cid: c.get('key') for cid, c in champ_list.items()}
    ids = sorted(champ_list.keys())

    champions = {}
    ok = 0
    for cid in ids:
        try:
            dd = fetch_json('%s/cdn/%s/data/%s/champion/%s.json' % (DD, version, LANG, cid))['data'][cid]
        except Exception as e:
            print('  ! DD %s : %s' % (cid, e), file=sys.stderr)
            continue
        # CommunityDragon (facultatif) : indexé par clé numérique
        cd_spells = []
        try:
            key = key_by_id.get(cid)
            if key:
                cd = fetch_json('%s/%s.json' % (CD, key))
                cd_spells = cd.get('spells') if isinstance(cd, dict) else []
                if not isinstance(cd_spells, list):
                    cd_spells = []
        except Exception as e:
            print('  ~ CD %s : %s' % (cid, e), file=sys.stderr)

        # Meraki (facultatif) : valeurs déjà résolues, indexées par id de champion
        mk_ab = {}
        try:
            mk = fetch_json('%s/%s.json' % (MK, cid))
            if isinstance(mk, dict):
                mk_ab = mk.get('abilities') or {}
        except Exception as e:
            print('  ~ MK %s : %s' % (cid, e), file=sys.stderr)

        keys = ['Q', 'W', 'E', 'R']
        spells = []
        for i, sp in enumerate(dd.get('spells') or []):
            cd_sp = cd_spells[i] if i < len(cd_spells) else None
            mk_sp = mk_ab.get(keys[i]) if i < len(keys) else None
            rows, ratios = build_rows(sp, cd_sp, mk_sp)
            spells.append({
                'key': keys[i] if i < len(keys) else '',
                'name': sp.get('name', ''),
                'cd': sp.get('cooldownBurn', ''),
                'cost': sp.get('costBurn', ''),
                'range': sp.get('rangeBurn', ''),
                'rows': rows,
                'ratios': ratios,
            })
        passive = dd.get('passive') or {}
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
