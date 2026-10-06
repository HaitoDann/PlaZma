# ARCHI — client local (premier jet)

Petit programme Windows qui, **sans aucune clé Riot**, récupère depuis ton PC :

1. **le rang SoloQ** du compte connecté au client League ;
2. **les stats des replays `.rofl`** (champions, KDA, CS, gold, vision, positions…) ;
3. **l'historique du rang SoloQ** dans le temps.

> ⚠️ **Ce premier jet n'envoie rien à ARCHI.** Il écrit tout dans le dossier
> `client/archi-data/` et l'affiche dans la console. But : valider sur un vrai PC
> que les données lues sont correctes **avant** de brancher l'envoi vers ARCHI.

## Vanguard : aucun risque
Le programme lit **l'API locale du client League** (la « LCU ») et des **fichiers
`.rofl`** sur le disque. Il **ne touche jamais au jeu** : pas d'injection, pas de
lecture mémoire, pas d'overlay, pas d'automatisation d'actions. C'est la même
catégorie d'accès que Blitz, Mobalytics, Porofessor ou l'app OP.GG, qui
cohabitent avec Vanguard depuis des années. Il n'y a rien là-dedans que Vanguard
traite comme de la triche.

## Ce qu'il lit / n'écrit pas
- **Lit** : le rang SoloQ, l'identité Riot (pseudo#tag), l'historique de parties
  classées récentes, les fichiers `.rofl` du dossier Replays.
- **N'écrit nulle part sur ton PC** en dehors de son propre dossier `archi-data/`.
- **N'envoie rien sur Internet** dans ce premier jet.

## Prérequis
- Windows avec le **client League** installé.
- **Node.js 18+** : https://nodejs.org (installeur « LTS », Suivant → Suivant).

## Lancer
1. Télécharge le dossier `client/`.
2. (Optionnel) Copie `config.example.json` en `config.json` et ajuste les chemins
   si ton installation n'est pas standard (voir ci-dessous).
3. Ouvre un terminal dans le dossier `client/` et lance :
   ```
   node archi-client.js
   ```
4. **Ouvre le client League** (pas besoin de lancer une partie) : au bout de
   quelques secondes, ton rang SoloQ s'affiche.
5. Pour tester les replays : dans League, **Historique → une partie → Télécharger**
   le replay, puis regarde la console / `archi-data/replays/`.

Laisse la fenêtre ouverte : il relit le rang toutes les 5 minutes et détecte les
nouveaux `.rofl` automatiquement.

## Configuration (`config.json`, facultatif)
| Clé | Défaut | Rôle |
|-----|--------|------|
| `lockfile` | `C:\Riot Games\League of Legends\lockfile` | fichier d'auth local du client |
| `replaysDir` | `%USERPROFILE%\Documents\League of Legends\Replays` | dossier des replays |
| `pollMinutes` | `5` | fréquence de lecture du rang |

Les variables `%USERPROFILE%` etc. sont développées automatiquement.

## Ce que ça produit (`archi-data/`)
- `rank.json` — dernier rang SoloQ lu (tier, division, LP, V/D, winrate) + pseudo#tag.
- `soloq-history.json` — un point à chaque changement de rang (pour les courbes).
- `recent-ranked.json` — dernières parties classées (bonus).
- `replays/<game>.json` — stats parsées de chaque `.rofl`.

## Tester juste le parseur `.rofl`
```
node test-rofl.js "C:\...\Replays\EUW1-1234567890.rofl"
```

## Envoi vers ARCHI (optionnel)
Pour que ton rang s'affiche dans le Dashboard d'ARCHI, active le `push` dans
`config.json` :
```json
"push": { "enabled": true, "username": "<ta connexion ARCHI>", "password": "<ton mot de passe ARCHI>", "playerId": "haito" }
```
Le client se connecte alors à ARCHI comme le site (HTTPS) et écrit **ton** document
`plazma-stats/<playerId>`. Les règles Firestore n'autorisent que ton propre joueur
(ou un admin). Rien d'autre n'est touché.

## Version `.exe` (sans installer Node)
Pour les joueurs qui ne veulent pas installer Node, une version `.exe` est générée
automatiquement :
1. Sur GitHub, onglet **Actions** → dernier run **« Build client Windows (.exe) »**
   → section **Artifacts** → télécharge **archi-client-windows** (contient
   `archi-client.exe`).
2. Mets `archi-client.exe` dans un dossier, place le **`config.json`** (voir plus
   haut) **à côté de l'exe**, puis double-clique sur l'exe.
   - Le dossier `archi-data/` et le `config.json` sont lus/écrits **à côté de l'exe**.
   - Windows SmartScreen peut afficher un avertissement (exe non signé) :
     « Informations complémentaires » → « Exécuter quand même ».

Construire l'exe soi-même (optionnel) : `npm install` puis `npm run build`
(génère `dist/archi-client.exe`).

## Données de jeu (wiki champions)
Quand le client League est ouvert, le client extrait aussi les données de
champions/sorts **directement depuis le client installé** (API locale, sans
intermédiaire ni clé) dans `archi-data/gamedata/` :
- `champion-summary.json` (liste complète) ;
- quelques `champion-<id>.json` d'exemple.
Ces fichiers servent à bâtir le wiki champions dans ARCHI (dégâts, ratios…).

## Reste à faire ensuite
- Historique SoloQ enrichi (courbe de LP sur la durée) et import auto des `.rofl` vers les CR.
- Lancement automatique au démarrage de Windows.
