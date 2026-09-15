#!/usr/bin/env python3
"""ARCHI — Génération de assets/spells.json.

Data Dragon fournit les métadonnées Riot (noms FR, CD, coût, portée, description).
Meraki fournit une structure d'aptitudes bien plus exploitable pour les valeurs
par rang et les ratios. CommunityDragon reste un secours limité.

Important : les `coefficients` génériques de CommunityDragon ne sont PAS traités
comme des ratios AP/AD : cette hypothèse produisait de faux résultats, notamment
Aatrox R +100% AP.
"""
import json
import os
import re
import sys
import urllib.request

DD = 'https://ddragon.leagueoflegends.com'
CD = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions'
MERAKI = 'https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions'
LANG = 'fr_FR'
OUT = 'assets/spells.json'
UA = {'User-Agent': 'ARCHI-spell-sync (github-actions)'}

SKIP_ATTR = re.compile(r'cooldown|recharge|cost|mana|energy|range|portée|duration|durée|slow|stun|root|movement speed|vitesse de déplacement|attack speed|vitesse d.?attaque|projectile|radius|rayon|angle|width|largeur|targets|cibles', re.I)
RATIO_UNIT = re.compile(r'%.*(?:ability power|attack damage|bonus attack damage|total attack damage|bonus health|maximum health|missing health|armor|magic resistance)', re.I)
ATTR_FR = {
    'Damage': 'Dégâts', 'Magic Damage': 'Dégâts magiques', 'Physical Damage': 'Dégâts physiques',
    'True Damage': 'Dégâts bruts', 'Bonus Damage': 'Dégâts bonus', 'Total Damage': 'Dégâts totaux',
    'Damage Reduction': 'Réduction des dégâts', 'Damage Taken': 'Dégâts subis',
    'Healing': 'Soin', 'Heal': 'Soin', 'Shield': 'Bouclier',
    'Magic Shield': 'Bouclier magique', 'Physical Shield': 'Bouclier physique',
}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode('utf-8')


def fetch_json(url):
    return json.loads(fetch(url))


def num(v):
    try:
        return str(round(float(v), 4)).rstrip('0').rstrip('.')
    except (TypeError, ValueError):
        return str(v)


def fmt_values(values):
    vals = [num(v) for v in values if isinstance(v, (int, float))]
    return '/'.join(vals) if vals else ''


def unit_fr(unit):
    if not unit:
        return ''
    u = str(unit)
    for pattern, repl in [
        (r'% of ability power', "% d'AP"), (r'% of attack damage', "% d'AD"),
        (r'% bonus attack damage', '% AD bonus'), (r'% bonus ability power', '% AP bonus'),
        (r'% total attack damage', '% AD total'), (r'% bonus health', '% PV bonus'),
        (r'% maximum health', '% PV max'), (r'% target.?s maximum health', '% PV max cible'),
        (r'% missing health', '% PV manquants'), (r'% current health', '% PV actuels'),
        (r'ability power', 'AP'), (r'attack damage', 'AD'), (r'bonus health', 'PV bonus'),
        (r'maximum health', 'PV max'), (r'per second', '/s'), (r'seconds?', 's'),
    ]:
        u = re.sub(pattern, repl, u, flags=re.I)
    return u


def modifier_text(mod):
    values = mod.get('values') if isinstance(mod, dict) else None
    units = mod.get('units') if isinstance(mod, dict) else None
    if not isinstance(values, list):
        return ''
    nums = [v for v in values if isinstance(v, (int, float))]
    if not nums:
        return ''
    unit = unit_fr((units or [''])[0]) if isinstance(units, list) else ''
    text = fmt_values(nums)
    return text + (unit if unit.startswith('%') else (' ' + unit if unit else ''))


def attr_label(attr):
    if attr in ATTR_FR:
        return ATTR_FR[attr]
    low = str(attr or '').lower()
    if 'magic damage' in low: return 'Dégâts magiques'
    if 'physical damage' in low: return 'Dégâts physiques'
    if 'true damage' in low: return 'Dégâts bruts'
    if 'damage' in low or 'dégât' in low or 'degat' in low: return 'Dégâts'
    if 'heal' in low or 'soin' in low: return 'Soin'
    if 'shield' in low or 'bouclier' in low: return 'Bouclier'
    return str(attr or '')


def row_color(label):
    low = label.lower()
    if 'soin' in low or 'heal' in low: return 'heal'
    if 'bouclier' in low or 'shield' in low: return 'shield'
    if 'phys' in low: return 'physical'
    if 'brut' in low or 'true' in low: return 'true'
    return 'magic'


def meraki_rows(ability):
    rows, ratios, seen_rows, seen_ratios = [], [], set(), set()
    for effect in ability.get('effects') or []:
        for leveling in effect.get('leveling') or []:
            attr = leveling.get('attribute')
            if not attr or SKIP_ATTR.search(str(attr)):
                continue
            texts = []
            for mod in leveling.get('modifiers') or []:
                text = modifier_text(mod)
                if not text:
                    continue
                texts.append(text)
                units = mod.get('units') or []
                for u in units:
                    if not isinstance(u, str) or not RATIO_UNIT.search(u):
                        continue
                    vals = mod.get('values') or []
                    ratio_text = fmt_values(vals)
                    if not ratio_text:
                        continue
                    nums = [v for v in vals if isinstance(v, (int, float))]
                    if nums and all(v == nums[0] for v in nums):
                        ratio_text = num(nums[0])
                    ratio = ratio_text + unit_fr(u)
                    if ratio not in seen_ratios:
                        seen_ratios.add(ratio)
                        ratios.append(ratio)
            if texts:
                label = attr_label(attr)
                value = ' + '.join(texts)
                key = label + '|' + value
                if key not in seen_rows:
                    seen_rows.add(key)
                    rows.append({'label': label, 'value': value, 'color': row_color(label)})
    return rows, ratios


def dd_vars_ratios(dd_spell):
    out, seen = [], set()
    for v in dd_spell.get('vars') or []:
        coeff = v.get('coeff')
        if isinstance(coeff, list):
            coeff = coeff[0] if coeff else None
        if coeff in (None, 0):
            continue
        stat = {'spelldamage': 'AP', 'abilitypower': 'AP', 'attackdamage': 'AD', 'bonusattackdamage': 'AD bonus'}.get(str(v.get('link') or ''))
        if not stat:
            continue
        value = float(coeff) * 100 if abs(float(coeff)) <= 3 else float(coeff)
        text = '+%g%% %s' % (round(value, 2), stat)
        if text not in seen:
            seen.add(text)
            out.append(text)
    return out


def cd_fallback_rows(cd_spell):
    if not cd_spell:
        return [], []
    rows = []
    for key in sorted(cd_spell.get('effectAmounts') or {}):
        vals = cd_spell['effectAmounts'][key]
        if not isinstance(vals, list):
            continue
        nums = [v for v in (vals[1:] if len(vals) > 1 else vals) if isinstance(v, (int, float))]
        if len(nums) >= 2 and any(v != 0 for v in nums):
            rows.append({'label': 'Valeur / rang', 'value': fmt_values(nums), 'color': 'magic'})
    return rows[:4], []


def build_spell(dd_spell, cd_spell, mk_ability):
    rows, ratios = meraki_rows(mk_ability) if mk_ability else ([], [])
    if not rows:
        rows, _ = cd_fallback_rows(cd_spell)
    for ratio in dd_vars_ratios(dd_spell):
        if ratio not in ratios:
            ratios.append(ratio)
    return rows, ratios


def main():
    version = fetch_json(DD + '/api/versions.json')[0]
    champ_list = fetch_json('%s/cdn/%s/data/%s/champion.json' % (DD, version, LANG))['data']
    key_by_id = {cid: c.get('key') for cid, c in champ_list.items()}
    champions, ok, meraki_ok = {}, 0, 0

    for cid in sorted(champ_list.keys()):
        try:
            dd = fetch_json('%s/cdn/%s/data/%s/champion/%s.json' % (DD, version, LANG, cid))['data'][cid]
        except Exception as e:
            print('! DD %s : %s' % (cid, e), file=sys.stderr)
            continue

        cd_spells = []
        try:
            key = key_by_id.get(cid)
            if key:
                cd = fetch_json('%s/%s.json' % (CD, key))
                cd_spells = cd.get('spells') if isinstance(cd, dict) else []
                if not isinstance(cd_spells, list): cd_spells = []
        except Exception as e:
            print('~ CDragon %s : %s' % (cid, e), file=sys.stderr)

        mk = None
        try:
            candidate = fetch_json('%s/%s.json' % (MERAKI, cid))
            if isinstance(candidate, dict) and candidate.get('abilities'):
                mk, meraki_ok = candidate, meraki_ok + 1
        except Exception as e:
            print('~ Meraki %s : %s' % (cid, e), file=sys.stderr)

        spells, keys = [], ['Q', 'W', 'E', 'R']
        mk_abilities = (mk or {}).get('abilities') or {}
        for i, sp in enumerate(dd.get('spells') or []):
            slot = keys[i] if i < len(keys) else ''
            cd_sp = cd_spells[i] if i < len(cd_spells) else None
            mk_list = mk_abilities.get(slot) or []
            mk_ability = mk_list[0] if mk_list and isinstance(mk_list[0], dict) else None
            rows, ratios = build_spell(sp, cd_sp, mk_ability)
            spells.append({'key': slot, 'name': sp.get('name', ''), 'cd': sp.get('cooldownBurn', ''), 'cost': sp.get('costBurn', ''), 'range': sp.get('rangeBurn', ''), 'rows': rows, 'ratios': ratios})

        passive = dd.get('passive') or {}
        champions[cid] = {'passive': {'name': passive.get('name', ''), 'desc': passive.get('description', '')}, 'spells': spells}
        ok += 1

    out = {'version': version, 'count': ok, 'numericSource': 'Meraki Analytics when available; CommunityDragon/Data Dragon fallback', 'merakiChampions': meraki_ok, 'champions': champions}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print('spells.json : %d champions (patch %s, Meraki %d)' % (ok, version, meraki_ok))


if __name__ == '__main__':
    main()
