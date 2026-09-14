#!/usr/bin/env python3
"""SONDE TEMPORAIRE — capture la structure CommunityDragon d'Orianna pour
comprendre où sont les montants par rang. Écrit assets/spells.json.
(Sera remplacé par le vrai générateur une fois le schéma connu.)"""
import json
import os
import urllib.request

UA = {'User-Agent': 'ARCHI-probe (github-actions)'}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode('utf-8')


def summarize(obj, depth=0, maxdepth=4):
    """Résumé compact : noms de champs + type + échantillon des tableaux de nombres."""
    if depth > maxdepth:
        return '…'
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            out[k] = summarize(v, depth + 1, maxdepth)
        return out
    if isinstance(obj, list):
        if obj and all(isinstance(x, (int, float)) for x in obj):
            return 'NUMLIST' + str(obj[:8])
        return [summarize(x, depth + 1, maxdepth) for x in obj[:3]]
    if isinstance(obj, str):
        return obj[:120]
    return obj


def main():
    probe = {}
    urls = {
        'raw_v1_61': 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/61.json',
        'cdn_orianna': 'https://cdn.communitydragon.org/latest/champion/Orianna/data',
    }
    for name, url in urls.items():
        try:
            data = json.loads(fetch(url))
            # On cible les sorts
            spells = data.get('spells') if isinstance(data, dict) else None
            probe[name] = {
                'top_keys': list(data.keys())[:40] if isinstance(data, dict) else 'NOT_DICT',
                'spells_type': type(spells).__name__,
                'spell0': summarize(spells[0]) if isinstance(spells, list) and spells else None,
                'spell1': summarize(spells[1]) if isinstance(spells, list) and len(spells) > 1 else None,
            }
        except Exception as e:
            probe[name] = {'error': str(e)}
    os.makedirs('assets', exist_ok=True)
    with open('assets/spells.json', 'w', encoding='utf-8') as f:
        json.dump(probe, f, ensure_ascii=False, indent=1)
    print('probe écrit')


if __name__ == '__main__':
    main()
