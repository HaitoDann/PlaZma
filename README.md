<p align="center">
  <img src="assets/logo-plazma.png" width="96" alt="ARCHI — PlaZma Esport">
</p>

<h1 align="center">ARCHI</h1>
<p align="center">Plateforme interne de gestion · PlaZma Esport</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.0-22d3ee?style=flat-square&labelColor=0b0f14" alt="Version">
  <img src="https://img.shields.io/badge/déploiement-GitHub%20Pages-6366f1?style=flat-square&labelColor=0b0f14" alt="GitHub Pages">
  <img src="https://img.shields.io/badge/backend-Firebase-f59e0b?style=flat-square&labelColor=0b0f14" alt="Firebase">
  <img src="https://img.shields.io/badge/statut-production-22c55e?style=flat-square&labelColor=0b0f14" alt="Statut">
</p>

<p align="center">
  <a href="https://haitodann.github.io/PlaZma/index.html"><strong>→ Accéder à ARCHI</strong></a>
</p>

---

## Présentation

ARCHI est l'outil central de l'organisation PlaZma. Il regroupe en un seul endroit la gestion du planning d'entraînement, les comptes-rendus de scrims, l'analyse des équipes adverses, le suivi de l'équipe et les statistiques de champions.

L'accès est restreint — chaque membre dispose d'un compte créé par un administrateur.

---

## Outils disponibles

| Outil | Description |
|---|---|
| **Planning** | Programme d'entraînement hebdomadaire |
| **CR Scrim** | Débriefs et analyses post-scrim |
| **Scouting** | Fiches et synthèses des équipes adverses |
| **Équipe** | Identité de jeu, tier list, style collectif |
| **Dashboard** | Vue d'ensemble — stats, agenda, matchs officiels |
| **Satisfaction** | Ressenti et bien-être des joueurs |
| **Wiki** | Sorts, stats et cooldowns des champions (Data Dragon) |

---

## Accès

L'application est hébergée sur GitHub Pages et requiert une connexion :

```
https://haitodann.github.io/PlaZma/index.html
```

Les comptes sont créés via la page Admin (`/plazma-admin.html`). Chaque compte dispose de droits par module (lecture ou édition).

---

## Stack

- **Frontend** — HTML / CSS / Vanilla JS, sans framework ni bundler
- **Auth & données** — Firebase Auth + Firestore (SDK v9 compat)
- **Hébergement** — GitHub Pages (branche `main`)
- **Assets champions** — Riot Data Dragon (chargé à la volée, aucune donnée stockée)

---

## Déploiement

Tout push sur `main` déclenche automatiquement le déploiement via GitHub Pages. Aucune étape de build.

```bash
git push origin main   # → en production immédiatement
```

Les ressources partagées (`theme.css`, `plazma.js`) sont versionnées via un paramètre `?v=` dans chaque page HTML pour forcer le rechargement du cache navigateur lors des mises à jour.

---

## Changelog

### v1.1.0 — Animations vivantes
- Animation mégaphone 📢 au survol des boutons Discord (shake)
- Animations sémantiques par outil sur l'accueil (loupe, barres, rebond…)
- Halos de fond ambiants animés sur toutes les pages

### v1.0.0 — Navigation sans friction
- Loader premium avec logo et arcs contra-rotatifs
- Cache auth sessionStorage (TTL 30 min) — supprime la vérification à chaque page
- View Transitions CSS natives MPA (Chrome 126+)
- Flash de confirmation au clic sur tous les boutons

### v0.8.0 — Redesign & expérience
- Icônes SVG Lucide sur les cartes outils de l'accueil
- Command palette (Ctrl+K)
- Redesign visuel : glassmorphism, spotlight, animations de sections

### v0.7.0 — Draft simulator
- Simulateur de draft complet avec analyse de composition

### v0.6.0 — Champions autonomes
- Miroir local des icônes champions (Community Dragon)
- Synchro quotidienne automatique via GitHub Actions

### v0.5.0 — Stabilisation
- Solidification de la synchronisation Firestore sur toutes les pages
- Mode lecture seule généralisé, textareas auto-extensibles
- Corrections de bugs majeurs (flexbox, tiroirs, synchro)

### v0.4.0 — Discord & Wiki
- Intégration webhooks Discord (scrim, planning, scouting)
- Avatar ARCHI sur les messages publiés
- Wiki : chiffres précis des sorts par rang (Meraki Analytics)

### v0.3.0 — Scouting & Satisfaction
- Refonte Scouting en outil pro (roster adverse, draft board, scénarios)
- Tier list drag-and-drop par joueur
- Module Satisfaction avec défilement des résultats

### v0.2.0 — Données & Roster
- Planning avec horaires début/fin
- Roster central dynamique
- Sélecteur de champions via Riot Data Dragon

### v0.1.0 — Fondation
- Refonte complète de l'architecture ARCHI
- Système d'authentification Firebase
- Navigation partagée, design system initial
