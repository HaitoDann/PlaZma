<p align="center">
  <img src="assets/logo-plazma.png" width="96" alt="ARCHI — PlaZma Esport">
</p>

<h1 align="center">ARCHI</h1>
<p align="center">Plateforme interne de gestion · PlaZma Esport</p>

<p align="center">
  <a href="https://haitodann.github.io/PlaZma/index.html">→ Accéder à ARCHI</a>
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
