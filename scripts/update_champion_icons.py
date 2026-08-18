#!/usr/bin/env python3
"""
ARCHI — Synchronisation locale des icônes de champions (Data Dragon).

Télécharge les icônes carrées de tous les champions dans assets/champions/ et
écrit un manifeste (assets/champions/manifest.json). Exécuté par une GitHub
Action une fois par jour : le site sert alors des icônes hébergées sur le repo
(rapides, même origine, insensibles à une panne de Data Dragon).

- Ré-télécharge toutes les icônes quand le patch change (l'art peut évoluer).
- Sinon, ne récupère que les icônes manquantes (nouveaux champions).
Stdlib uniquement (urllib) : aucune dépendance à installer.
"""
import datetime
import json
import os
import sys
import urllib.request

DD = 'https://ddragon.leagueoflegends.com'
OUT = 'assets/champions'
UA = {'User-Agent': 'ARCHI-icon-sync (github-actions)'}


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        data = r.read()
    return data if binary else data.decode('utf-8')


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest_path = os.path.join(OUT, 'manifest.json')

    versions = json.loads(fetch(DD + '/api/versions.json'))
    version = versions[0]
    champ = json.loads(fetch('%s/cdn/%s/data/fr_FR/champion.json' % (DD, version)))
    data = champ['data']

    old = None
    if os.path.exists(manifest_path):
        try:
            old = json.load(open(manifest_path, encoding='utf-8'))
        except Exception:
            old = None
    version_changed = (not old) or old.get('version') != version

    champions, downloaded, failed = [], 0, 0
    for cid, c in sorted(data.items(), key=lambda kv: kv[1]['name']):
        champions.append({
            'id': c['id'], 'name': c['name'], 'key': c['key'],
            'title': c.get('title', ''), 'tags': c.get('tags', []),
        })
        dest = os.path.join(OUT, c['id'] + '.png')
        if version_changed or not os.path.exists(dest):
            try:
                open(dest, 'wb').write(fetch('%s/cdn/%s/img/champion/%s.png' % (DD, version, c['id']), binary=True))
                downloaded += 1
            except Exception as e:
                failed += 1
                print('WARN icône %s : %s' % (cid, e), file=sys.stderr)

    manifest = {
        'version': version,
        'updated': datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z',
        'count': len(champions),
        'champions': champions,
    }
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'))

    print('Patch %s · %d champions · %d icônes téléchargées · %d échecs'
          % (version, len(champions), downloaded, failed))
    if failed:
        # Un échec ponctuel ne doit pas casser la synchro (secours CDN côté client).
        print('Certaines icônes ont échoué mais le manifeste reste valide.', file=sys.stderr)


if __name__ == '__main__':
    main()
