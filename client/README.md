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

## Configuration (fenêtre)
Lance le client avec l'option **`--setup`** (ou simplement au **premier lancement**) :
une fenêtre s'ouvre dans ton navigateur pour :
- saisir ta **connexion ARCHI** (avec un bouton **« Tester la connexion »**) ;
- choisir **ce que tu partages**, chaque option indiquant son **impact** sur ton PC :
  - **Rang & winrate SoloQ** — impact quasi nul ;
  - **Historique & suivi SoloQ (+ replays .rofl)** — impact léger.

Tes choix sont écrits dans `config.json` (ton mot de passe reste **sur ton PC**).
Pour rouvrir la fenêtre plus tard : relance avec `--setup`.

Pré-requis côté ARCHI : ton compte doit être **lié à ton joueur** (page Comptes,
côté admin) ou être **admin**, sinon l'envoi est refusé par les règles.

## Version `.exe` (sans installer Node) — pour les joueurs
Lien de téléchargement **direct et toujours à jour** (aucun compte GitHub requis) :

> **https://github.com/HaitoDann/PlaZma/releases/latest/download/archi-client.exe**

1. Télécharge `archi-client.exe` et mets-le dans un dossier (ex. `Documents\ARCHI Link`).
2. Double-clique dessus. Au **premier lancement**, une fenêtre s'ouvre pour saisir
   ta connexion ARCHI et choisir ce que tu partages (voir « Configuration (fenêtre) »).
   - Le `config.json` et le dossier `archi-data/` sont créés **à côté de l'exe**.
   - Windows peut afficher « Éditeur inconnu » (exe non signé) :
     **Informations complémentaires → Exécuter quand même**.
3. Après la configuration, ARCHI Link **démarre automatiquement avec Windows**
   (modifiable depuis la page d'état) et tourne en fond, discrètement.

Une **mise à jour** disponible est signalée dans la page d'état (bandeau +
lien de téléchargement). Il suffit de retélécharger l'exe par le lien ci-dessus.

Construire l'exe soi-même (optionnel) : `npm install` puis `npm run build`
(génère `dist/archi-client.exe`). Les Releases publiques sont générées
automatiquement par l'Action à chaque build sur `main`.

## Icône discrète (barre des tâches) & démarrage auto
- L'`.exe` tourne **sans fenêtre** (console masquée). Il apparaît comme une **icône
  dans la barre des tâches** (près de l'horloge).
- **Clic gauche** sur l'icône : ouvre la page d'**état** (ce que fait ARCHI Link,
  journal, partage actif). **Clic droit** : Ouvrir / Configuration / Quitter.
- Le **démarrage automatique avec Windows** est **activé dès la première
  configuration**. La case **« Démarrer automatiquement avec Windows »** de la
  page d'état permet de le retirer (clé de registre HKCU\…\Run).
- Le **chemin du client League est détecté automatiquement** (toutes lettres de
  lecteur, `Program Files`…), donc pas besoin de configurer `lockfile` même si
  League n'est pas sur `C:`.
- Logs dans `archi-data/log.txt`.

> En mode `node` (développement), l'icône tray et le masquage de console ne
> s'appliquent pas (c'est propre à l'`.exe` Windows).

## Reste à faire ensuite
- Historique SoloQ enrichi (courbe de LP sur la durée) et import auto des `.rofl` vers les CR.
