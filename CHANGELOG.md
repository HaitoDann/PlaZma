# Journal des versions — ARCHI

Versionnage sémantique : **MAJEUR.MINEUR.CORRECTIF**
- **MAJEUR** : refonte ou rupture importante.
- **MINEUR** : nouveau lot de fonctionnalités.
- **CORRECTIF** : corrections de bugs / retouches.

La version courante est définie dans `assets/plazma.js` (`VERSION`) et affichée
discrètement en bas de la fenêtre **Paramètres**.

---

## 1.5.0 — Gestion des comptes & roster
- Refonte de la page **Comptes & accès** : avatars à initiales, recherche,
  badges rôle/statut, résumé d'accès lisible, menu d'actions, modales de
  création et de gestion (correction du bug des variables CSS `--line`/`--card`).
- **Catégories de membres** (façon GitHub) : Joueurs titulaires / remplaçants /
  Staff, avec onglets de filtre et regroupement.
- **Lien compte ↔ joueur** du roster.
- **Roster dynamique** : ajout/suppression de joueurs additionnels.
- Affichage discret du **numéro de version** dans Paramètres.

## 1.4.0 — Paramètres, idées & performance
- Fenêtre **Paramètres** accessible partout (qualité visuelle low/medium/high).
- **Boîte à idées** pour les utilisateurs + notification admin (badge non lues).
- Séparation « Comptes & droits » / « Paramètres », masquage des boutons non
  autorisés.
- Optimisations : adaptation automatique aux appareils faibles, réduction des
  particules/étoiles, suppression d'animations permanentes.

## 1.3.0 — Administration du site
- Page **Système** (admins) : vue d'ensemble, jauges réelles Firebase
  (lectures/écritures/suppressions/connexions), activité par utilisateur,
  annonces et maintenance des modules.
- Suivi d'usage Firestore (`plazma/_usage`).

## 1.2.0 — Animations & accueil
- Animation de **formation du logo** (login + accueil).
- Transition douce login → accueil, animations des icônes de cartes.
- Retrait du curseur personnalisé (latence).

## 1.1.0 — Micro-détails de connexion
- Bouton de succès, œil afficher/masquer, toasts flottants empilés en bas à
  droite, animations des boutons déconnexion/paramètres.

## 1.0.0 — Refonte du login
- Nouvelle page de connexion : socle rond, ambiance cyan (étoiles/bulles),
  thème clair/sombre, bouton jour/nuit.

---

_Les versions antérieures à 1.0.0 correspondent à la mise en place initiale
d'ARCHI (modules planning, scrim, scouting, équipe, dashboard, coach,
satisfaction, fiches perf) sur GitHub Pages + Firebase._
