# Journal des versions — ARCHI

Versionnage sémantique : **MAJEUR.MINEUR.CORRECTIF**
- **MAJEUR** : refonte visuelle ou rupture importante.
- **MINEUR** : nouveau lot de fonctionnalités.
- **CORRECTIF** : corrections de bugs / retouches.

La version courante est définie dans `assets/plazma.js` (`VERSION`), affichée
en **badge** dans la barre de navigation (à côté de « ARCHI ») et rappelée en
bas de la fenêtre **Paramètres**.

> Les synchronisations automatiques Data Dragon / CommunityDragon (icônes de
> champions, sorts) ne sont pas des versions : ce sont des mises à jour de
> données quotidiennes.

---

## 2.x — Refonte visuelle & administration

### 2.7.0 — Planning, idées & épuration
- **Drag & drop** dans le planning : glisse un créneau d'un jour à l'autre.
- **Boîte à idées** enrichie : catégories, compteur de caractères et onglet
  « Mes idées » (historique local).
- **Page de maintenance** redessinée (logo animé, carte, cohérence visuelle).
- Retrait de la fenêtre **Paramètres** (qualité), désormais 100 % automatique.
- **Bouton de déconnexion** ajouté sur l'accueil.

### 2.6.0 — Gestion des comptes & roster
- Refonte de la page **Comptes & accès** (avatars, recherche, badges, modales) —
  corrige le bug des variables CSS `--line`/`--card`.
- **Catégories de membres** (titulaire / remplaçant / staff) façon GitHub.
- **Lien compte ↔ joueur** et **roster dynamique** (ajout/suppression de joueurs).
- Introduction du **versionnage** et du badge de version.

### 2.5.0 — Paramètres & Boîte à idées
- Fenêtre **Paramètres** (qualité visuelle low/medium/high) accessible partout.
- **Boîte à idées** + notification admin (badge non lues), boutons masqués
  selon les droits.

### 2.4.0 — Performance
- Densité d'effets **adaptative** (auto selon l'appareil), optimisations de
  rendu, allègement des animations de l'accueil.

### 2.3.0 — Animation du logo
- **Formation du logo** sur le login puis l'accueil, transition douce
  login → accueil, retour au **curseur natif**.

### 2.2.0 — Administration du site
- Page **Système** (admins) : quotas Firebase réels, activité par utilisateur,
  annonces et maintenance des modules ; suivi d'usage Firestore.

### 2.1.0 — Micro-détails de connexion
- Bouton succès, œil afficher/masquer du mot de passe, **toasts** empilés en bas
  à droite, animations des boutons déconnexion/paramètres.

### 2.0.0 — Refonte du login
- Nouvelle page de connexion : socle rond, ambiance cyan (étoiles/bulles),
  thème clair/sombre, **bouton jour/nuit** soleil/lune.

---

## 1.x — Contenu LoL & outils d'analyse

### 1.10.0 — Données de sorts pré-résolues
- `assets/spells.json` généré via GitHub Action (Data Dragon + CommunityDragon :
  dégâts et ratios).

### 1.9.0 — Theorycraft avancé
- Builds A/B comparés (objets, runes), time-to-kill, bascule Solo / Duo,
  sélection complète des runes.

### 1.8.0 — Wiki : statistiques détaillées
- Tableau comparatif des stats de base, dégâts des sorts **par rang**
  (Data Dragon / CommunityDragon), sélecteur de niveau.

### 1.7.0 — Theorycrafting LoL
- Page de theorycraft : eHP, pénétration, DPS, équilibre.

### 1.6.0 — CR Match & champions
- **CR Match** + **Review individuelle** + sélecteur de champions (Data Dragon),
  correction des écritures Firestore parasites.

### 1.5.0 — Thème clair/sombre
- Bascule light/dark, étoiles de fond visibles dans les deux modes.

### 1.4.0 — Fiches perf enrichies
- **Radar chart** sur les fiches joueur.

### 1.3.0 — Encyclopédie Staff
- Nouvelle fiche encyclopédie Staff, curseur personnalisé.

### 1.2.0 — Accueil animé
- Animations & micro-détails de l'accueil, épuration du hero.

### 1.1.0 — Wiki étoffé
- Fiches Tempo, coaching, recrutement, psychologie, Trading, Flow &
  Concentration ; build du wiki automatisé.

### 1.0.0 — Socle ARCHI
- Base de l'outil : modules Planning, Scrim (CR), Scouting, Équipe, Dashboard,
  Coach, Satisfaction, Fiches perf, et l'encyclopédie (wiki), sur
  GitHub Pages + Firebase.

---

_Note : le versionnage a été formalisé rétroactivement à partir de l'historique
Git. Les dates et le détail complet des commits restent consultables via
`git log`._
