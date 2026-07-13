# ARCHI — Feuille de route

Plateforme d'organisation de PlaZma Esport (League of Legends).
Site statique (GitHub Pages) + Firebase Firestore pour la synchro.
Document de suivi des améliorations et idées à venir.

---

## 🔴 Priorité 1 — Sécurité des données
Le mot de passe (`plazma2026`) ne protège que l'affichage, pas les données.
La clé API Firebase est publique : si les règles Firestore sont ouvertes,
toute la base est lisible/modifiable par n'importe qui.

- [ ] Mettre en place une **authentification Firebase** (email/mot de passe staff).
- [ ] Écrire des **règles de sécurité Firestore** : lecture/écriture réservées
      aux comptes staff connectés.
- [ ] Exception : autoriser uniquement la **création** publique sur
      `plazma-satisfaction` (questionnaire joueur public).

## 🟢 Priorité 2 — Gros gains fonctionnels
- [ ] **Intégration Discord (webhook)** : bouton « Publier sur Discord » sur le
      Planning (programme de la semaine), les CR de scrim (résultat + axes) et le
      Scouting (synthèse adverse). Simple POST, compatible 100 % statique.
- [ ] **Dashboard = centre de commande** : agréger les autres pages (prochains
      créneaux du Planning, dernier CR de scrim, dernière fiche de scouting,
      prochain match).
- [ ] **Boucle Scrim → stats** : un CR de scrim alimente automatiquement le
      W/L et l'ELO du Dashboard (fin de la double saisie).

## 🟣 Priorité 3 — Confort & finitions
- [ ] Glisser-déposer **tactile** (tier list Équipe + scouting) — le DnD natif
      HTML5 ne marche pas sur mobile.
- [ ] **Satisfaction dans le temps** : courbe d'évolution note/ambiance/motivation
      sur plusieurs questionnaires (au lieu d'un instantané).
- [ ] **Timestamps VOD** dans le CR de scrim (lier chaque erreur à un lien horodaté).
- [ ] **Persistance hors-ligne Firestore** (`enablePersistence`) + scripts Firebase
      en `defer` pour un premier rendu plus rapide.
- [ ] **Ordre de draft guidé** dans le simulateur de scénarios (B1→R1→R2… avec
      surlignage du tour).
- [ ] Format du **multisearch OP.GG** à valider selon les régions.

## 🔵 Pour passer un cap (nécessite un petit backend serverless)
- [ ] **API Riot** via proxy (Cloudflare Worker / Vercel, gratuit) : rangs SoloQ
      du roster, historique de matchs, détection de partie en cours — automatisés.
      L'hébergement des pages reste sur GitHub Pages.

---

## 💡 Idées de nouvelles pages

### Compétition
- **Playbook / Compositions** — bibliothèque de nos compos type (drafts) avec win
  condition, qui joue quoi, notes. Complète le simulateur de draft du Scouting.
- **Calendrier compétitif & résultats** — saison des matchs officiels/tournois,
  adversaires (liens vers les fiches de scouting), résultats, classement.
  Distinct du Planning (qui est l'entraînement hebdo).
- **Répertoire adversaires / ligue** — annuaire des équipes de la ligue avec accès
  rapide à leur fiche de scouting et l'historique des confrontations.

### Développement joueur
- **Suivi & objectifs individuels** — objectifs par joueur suivis dans le temps
  (progression %, dates de review), au-delà de la fiche perf ponctuelle.
- **Tracker SoloQ** — évolution du rang/LP et stats champion par joueur (manuel ou
  via API Riot).
- **Bibliothèque VOD / reviews** — liens de reviews (scrims, officiels, soloq) avec
  timestamps, tags et notes. Centralise le film study.

### Pilotage / staff
- **Bilan hebdo automatique** — rapport agrégé (scrims joués, W/L, satisfaction,
  objectifs) exportable / publiable sur Discord.
- **Check-in quotidien** — pouls quotidien joueur (humeur / énergie / dispo), plus
  léger que le questionnaire satisfaction ; vue coach.
- **Journal de coaching** — timeline des décisions, notes de session, points clés.

---

_Généré et maintenu au fil des échanges. Coche les cases au fur et à mesure._
