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

### 2.11.0 — Pilotage du club (vue hors-terrain)
- **Nouvelle page admin `Pilotage du club`** (`plazma-club.html`) : regroupe
  tout le hors-sportif en 6 domaines — Organisation, Compétition, Équipe,
  Infrastructure, Visibilité, Ressources. Chaque domaine est une checklist
  vivante d'objectifs à 3 états (à faire / en cours / atteint), avec barre de
  progression par domaine, résumé global (anneau + compteurs) et notes.
- Objectifs de départ pré-remplis (base crédible d'un club esport), éditables,
  ajoutables et supprimables. Sauvegarde automatique et partagée entre admins
  (doc Firestore `plazma/club-vision`, réservé aux administrateurs).
- Accès via un **bouton dédié** sur l'accueil (visible uniquement pour les
  admins) et gate admin dans `plazma.js`.
- ⚠️ **Règles Firestore** mises à jour (`club-vision` en admin) : à redéployer
  manuellement dans la console Firebase.

### 2.10.2 — Crayon, monogrammes, perf & nettoyage
- **Correctif accents** : `index.html` avait été ré-encodé par erreur (les
  accents s'affichaient « Ã‰quipe »). Encodage UTF-8 rétabli.
- **Icône « Nouveau »** : le « + » est remplacé par un **crayon** propre qui
  glisse en traçant un trait au survol (animation revue, plus fluide).
- **Fiches joueurs/staff** : les emojis d'avatar laissent place à un
  **monogramme** (initiales) dans la couleur du rôle — plus sobre et pro.
- **Perf accueil** : `champions.js` (Data Dragon) n'est plus chargé sur
  l'accueil (il ne servait qu'au wiki) et la barre de progression du scroll est
  throttlée en `requestAnimationFrame` (fin du layout thrashing qui faisait
  ramer la page).
- **Wiki champions retiré** : page `plazma-wiki.html`, section de recherche de
  l'accueil, carte outil et lien de navigation supprimés. L'« Encyclopédie »
  (wiki-perf) est conservée.

### 2.10.1 — Fiches accueil, animations & renommage des comptes
- **Correctif page Système** : l'icône du titre « Vue d'ensemble » n'avait pas
  de dimensions (SVG `.ib` hors bouton) et s'étirait, poussant les indicateurs
  tout en bas. Les icônes `.ib` ont désormais une taille par défaut.
- **Fiches joueurs/staff de l'accueil** revues : liseré de rôle, halo coloré et
  avatar animé au survol, flèche « Voir la fiche » qui glisse.
- **Bouton « + Nouveau »** : le « + » qui tournait est remplacé par un **stylo
  qui écrit** une ligne au survol.
- **Pastille « Synchronisé »** : animation plus riche (cœur qui respire + double
  onde verte ; anneau ambre qui tourne pendant la sauvegarde).
- **Comptes** : possibilité de **renommer** le nom affiché d'un membre depuis
  « Gérer le membre » (le pseudo de connexion reste fixe).

### 2.10.0 — Bascule thème animée & épuration
- **Bascule clair/sombre** en révélation circulaire **depuis le bouton**
  (View Transitions API), repli propre si non supporté / reduced-motion.
- Retrait des boutons **Backup**, **Export PNG** et **Import** sur toutes les
  pages (peu utiles) — barres d'outils allégées.

### 2.9.0 — Passe « de-slop » (identité visuelle)
- Suppression des marqueurs « design IA » : plus de dégradé cyan→violet,
  cartes/panneaux **sans bordure** (hiérarchie par fond + ombre), retrait du
  **glassmorphism** (topbar/cartes opaques), filets colorés de KPI enlevés.
- Typographie d'identité : **Space Grotesk** (titres) + **JetBrains Mono**
  (chiffres/timers), Manrope conservé pour le texte.
- Eyebrows en casse normale (fin du tracking majuscule générique).
- `DESIGN.md` : règles verrouillées pour ne plus re-dériver vers la moyenne.

### 2.8.0 — Données croisées : schéma scrim, cockpit & présence
- **Scrim → données structurées** : chaque erreur porte désormais une
  **gravité** (Faible/Moyenne/Haute) et un **responsable** (joueur ou équipe),
  en plus du timer et de la catégorie — base de l'analyse agrégée.
- **Dashboard « Aujourd'hui »** : panneau cockpit sobre (prochain créneau 21h,
  dispo de l'effectif, forme, adversaire, point à travailler) qui fait parler
  Planning + Scrims + Scouting entre eux.
- **Disponibilités & présence** (créneau 21h) dans le Planning : chaque joueur
  saisit ses dispos (self-service), le staff renseigne la présence réelle ;
  total collectif par jour.

### 2.7.1 — Fluidité des animations
- Barre de progression du scroll et soulignement de nav animés en
  `transform: scaleX` (au lieu de `width`) : rendu GPU, plus fluide (règle
  « transform only »).

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
