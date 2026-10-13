---
date: 2026-10-13
---

# Le Rôle du Data Analyst dans une Équipe

> « Faire parler les données, ce n'est qu'une facette du travail — et même pas celle qui prend le plus de temps. Aujourd'hui, le point sur lequel je me concentre le plus, c'est de créer des outils pour les équipes. » — Xenesis, data analyst chez Karmine Corp

*Sources : Entretien avec Benjamin « Xenesis », data analyst LoL/Valorant chez Karmine Corp (2025) · Evil Geniuses — Esports Data Analyst job listing (Hitmarker, 2021) · Team Liquid — LoL Analyst job listings (Hitmarker) · wecoach.gg — « Comment devenir analyste League of Legends ? » · TL Kayy's on his role as analyst (Inven Global) · How Brentford's data revolution turned the Premier League upside down (Sports Illustrated) · Brentford FC: The Data-Driven Revolution (Dream Data Ball) · From Esports to Sports Predictions: The Shared Language of Analytics (OutOf.Games, 2025)*

---

## À retenir

- L'analyste « classique » **fait parler des données que d'autres récupèrent pour lui** ; en esport, il gère **toute la chaîne** — collecte, base de données, outillage, puis analyse.
- Le métier glisse de plus en plus vers le **développement** : construire des outils qui font gagner du temps au staff et aux joueurs vaut souvent plus que l'analyse brute.
- **Être fort en maths n'est plus un prérequis** — l'IA et les surcouches techniques ont rendu le métier très accessible et beaucoup plus axé « produit ».
- La compétence la plus rentable n'est pas technique : c'est **comprendre le besoin réel** du coach ou du joueur avant de coder quoi que ce soit.
- En recrutement, on pense en **tier lists**, pas en classements : trancher entre deux joueurs proches dépend ensuite du profil, de la langue, du fit d'équipe.
- On peut **faire dire aux chiffres presque n'importe quoi** : l'enjeu éthique est de ne pas les faire mentir quand il y a un vrai impact.
- Prouver son impact est difficile et long ; le facteur décisif d'une carrière reste la **persévérance**, pas le niveau technique.

---

## 1. Définir le métier : deux réalités

### L'analyste « traditionnel »

Dans une entreprise classique — ou une structure esport mature — le data analyst est **celui qui fait parler les données**. Il récupère des données que d'autres ont souvent collectées pour lui, puis en sort des **rapports, des analyses, des insights** et parfois des **stratégies**. C'est un métier de domaine : ce sont souvent des gens qui **connaissaient déjà le métier ou le secteur** qui deviennent analystes, plus que des purs matheux qui finiraient par analyser des données « peu importe lesquelles ».

> ✅ C'est l'archétype décrit dans la fiche de poste de l'[[Structure_du_Staff_et_Roles|Analyste Performance]] : VOD review, scouting reports, win rates par composition, préparation du draft, veille meta.

### L'analyste esport « complet »

En esport, un pan entier disparaît : **personne ne récupère les données à ta place**. L'analyste s'occupe donc de **toute la partie technique en amont** — collecte, structuration de la base de données, outillage — avant même de commencer à analyser. Résultat : « faire parler les données » n'est qu'une facette, et rarement celle qui occupe le plus de temps.

| Dimension | Analyste traditionnel | Analyste esport complet |
|---|---|---|
| Collecte de données | Déléguée (data engineers, prestataires) | À sa charge (API, scraping, base maison) |
| Cœur de métier | Analyse & reporting | Développement d'outils + analyse |
| Compétences dominantes | Stats, visualisation, métier | Dev, architecture de données, produit |
| Livrable principal | Rapports & insights | Une **application** utilisée au quotidien |

---

## 2. Un métier qui glisse vers le développement

Le point sur lequel l'analyste « complet » se concentre le plus aujourd'hui, c'est **créer des outils pour les équipes** : des choses qui font gagner du temps, qui donnent l'information plus vite et plus efficacement, et qui « parlent » mieux aux joueurs et au staff.

C'est **plus un travail de développeur** qu'un travail de data analyst à proprement parler. Or, pour développer, **il n'est plus nécessaire d'être très bon en maths** — plus besoin de résoudre des intégrales. Le métier est devenu très accessible pour deux raisons :

1. **Très bien documenté en ligne** — on peut s'y former en autodidacte (OpenClassrooms et équivalents) beaucoup plus facilement que dans d'autres domaines.
2. **L'IA** — une transformation « radicale mais pas mortelle » du métier.

### L'IA au quotidien

| Usage de l'IA | Détail |
|---|---|
| **Sortir des features plus vite** | Développer des fonctionnalités bien plus rapidement qu'à la main |
| **Paralléliser les tâches** | Faire travailler l'IA sur plusieurs features en même temps — rare pour un dev humain seul |
| **Ce qu'on ne lui donne JAMAIS** | **Les analyses.** L'IA sert au développement de fonctionnalités, pas à l'interprétation des chiffres |

> 💡 **L'avantage du dev sur le non-technique :** savoir coder la feature soi-même permet de **dire exactement à l'IA quoi faire**. Sinon, quand l'IA s'organise seule, elle « s'emmêle les pinceaux », le code devient du spaghetti et on perd la main. Une **base solide et flexible**, construite avant l'arrivée des IA, reste le socle sur lequel tout s'appuie.

---

## 3. Le cœur analytique : le modèle de scoring

Même si le développement domine, le socle analytique reste un **modèle de scoring** maison (stable depuis ~2021). Il repose sur deux métriques :

| Métrique | Définition |
|---|---|
| **Performance (P)** | Score brut calculé à partir de nombreuses métriques différentes |
| **Relative Performance (RP)** | Écart entre la performance réelle et la performance **attendue au vu du win rate** du joueur |

**Ce que la RP révèle :** elle identifie les joueurs qui **« surnagent » dans une équipe moyenne** — ceux dont les résultats de l'équipe tiennent presque uniquement à eux (une RP « abusément haute »). C'est un détecteur de talents sous-cotés, appliqué à la **solo queue, au haut elo/challenger et au compétitif**.

> L'analyse de la **forme du moment** se lit aussi dans ces métriques, mais l'usage le plus précieux reste la détection de profils sous-évalués.

---

## 4. La base de données : le piège fondateur

« Se planter » pour un analyste, c'est souvent une **erreur d'architecture de données** — et personne ne vient prévenir avant la faute. Exemple vécu lors du passage de Google Sheets à une vraie application :

| Mauvaise conception | Conséquence |
|---|---|
| Champions stockés en **chaîne de caractères** | Impossible de dire « ce champion est un tank / un mêlée / un range » → fonctionnalités bloquées |
| Pas d'objet « joueur actuel » | Impossible de sortir le **roster courant** d'une équipe avant que le nouveau joueur n'ait disputé un match |

Il a fallu **refaire toute la base de données plusieurs fois**. Depuis que les bonnes erreurs ont été identifiées, les **fondations ne bougent plus** (stables depuis 2-3 ans), là où elles changeaient tous les 6 mois. La leçon : **modéliser les entités comme des objets reliés**, pas comme du texte plat.

> ⚠️ **Google Sheets atteint vite ses limites** : au-delà d'un certain volume de parties stockées, les images ne s'actualisent plus, et changer une ligne met « 10 ans » à tout recalculer. Le passage à une application dédiée devient inévitable.

---

## 5. La vraie compétence : comprendre le besoin

> « Quand on commence, on a plein d'idées de modèles. Et là où le besoin, c'est peut-être juste de pouvoir regarder les pathings d'un jungler sur ses games précédentes. »

La compétence la **plus bénéfique** dans la progression d'un analyste n'est pas de savoir faire des modèles compliqués, mais de **comprendre le besoin réel**. Une fois le besoin bien cerné, la réalisation devient l'étape facile.

### Mesurer l'impact par l'usage

Faute de feedback explicite (un coach ne dit presque jamais qu'une présentation était mauvaise… ni qu'elle était bonne), l'analyste a introduit un **suivi d'utilisation** : qui utilise l'application, quelles fonctionnalités, à quelle fréquence. En cherchant à **maximiser cet usage**, il a produit des outils plus pertinents → plus utilisés → qui améliorent réellement le workflow et créent de la valeur.

> **À retenir :** « On te resigne » ou « ton travail est super » ne sont **pas de vrais indicateurs**. L'usage réel de tes outils, si.

---

## 6. L'analyste dans le mercato

Contrairement à l'idée reçue, on ne fait **pas un classement** de joueurs, mais une **tier list**.

| Approche | Pourquoi |
|---|---|
| **Classement strict** | Trop sensible à la subjectivité (style, équipe supportée, champion préféré) ; « qui est meilleur entre X et Y ? » n'a pas de réponse propre |
| **Tier list** | Beaucoup plus simple et robuste : on regroupe les joueurs par tiers, et avoir **une seule** option du tier le plus haut est déjà exceptionnel |

**Le processus type :**

1. Récupérer les données de tous les candidats (solo queue, haut elo, compétitif) — souvent via un **formulaire d'inscription** croisé avec la base existante.
2. Sortir ~10 joueurs par rôle, rangés en **tiers**.
3. Lors des **tryouts**, l'objectif n'est **pas** de prendre « le meilleur des tryouts » mais de faire ressortir le **SWOT** : forces, faiblesses, profil, opportunités (marketing, développement), problèmes potentiels (limites de jeu, d'attitude, barrière de langue).
4. L'**attitude** fait monter ou descendre un joueur de tier — mais la décision finale « pas possible pour raison d'attitude » **ne revient pas à l'analyste** : elle devient un paramètre parmi d'autres.

> 🎯 **Cas d'école KCBS :** construire un roster quasiment **sur la seule analyse de données**, puis valider les choix de profil via tryouts. Un système qui « a fait ses preuves avec les années ».

---

## 7. Spécificité esport vs sport traditionnel

| | Sport traditionnel (foot, il y a 5-10 ans) | Esport |
|---|---|---|
| **Collecte de données** | Très difficile : rien n'est tracé nativement ; il fallait construire des modèles de **vision par ordinateur** (position du ballon, des joueurs, passes vs conduite) | **Trivial** : à la fin d'une partie, toutes les stats du serveur sont accessibles |
| **Moteur du métier** | Connaissance de la discipline + compréhension des besoins | Idem — bien plus que les capacités techniques pures |

Dans le foot, ce sont souvent des **sociétés de modélisation de paris** (type **Smartodds**, à l'origine des *expected goals*) qui ont développé la donnée, ensuite récupérée par les clubs. Des clubs comme **Brentford** et **Brighton**, rachetés par d'anciens « traders sportifs », ont **remonté 3-4 divisions** avec des budgets non supérieurs aux autres, forçant tout l'écosystème à s'adapter.

> ❓ **La même chose arrivera-t-elle en esport ?** Cela dépendra des **enjeux financiers**. Aujourd'hui la manne est jugée insuffisante pour généraliser l'analyste à temps plein (souvent **1 500–2 000 €/mois**, là où l'industrie classique paie bien mieux) — ce qui explique sa rareté.

---

## 8. L'éthique : « les hommes mentent, pas les chiffres » ?

Faux. **On peut faire dire aux chiffres à peu près ce qu'on veut** : en choisissant KDA, solo kills, kills à 15, flashs forcés, on « prouve » qu'un joueur en vaut un autre ; avec DPM, dégâts/min, GD@15, forward, on raconte une histoire opposée. **Les deux sont des vérités** — c'est la sélection des métriques qui oriente le récit.

| Contexte | Posture |
|---|---|
| **Décision à enjeu** (recrutement, plan de jeu) | Ne **pas** faire mentir les chiffres ; chercher l'objectivité |
| **Show / spectacle** (plateau d'analyse, hype) | Assumer un angle sensationnaliste — « c'est aussi pour ça qu'on fait de l'esport : des moments et des histoires » |

---

## 9. Réalités de carrière

- **L'analyste à temps plein est rarissime** en esport européen (« ça se compte sur les doigts d'une main »).
- **Scénario commun :** on commence passionné pendant ses études (Open Tour, Div 2, LFL), puis au moment de payer le loyer, les salaires esport ne suivent pas → emploi dans l'industrie classique → la passion finit par partir.
- **Possession de l'outil :** l'application développée **appartient à l'analyste** ; elle fait partie de son CV et de sa valeur — « quand on me signe, on signe aussi l'application ».
- **Prouver son impact** se fait **sur la durée** : faire entendre sa voix même quand la direction prise n'est pas la sienne, puis valider a posteriori lors des **post-mortems** de split et de mercato.
- **Skill ceiling :** il n'y en a pas de fixe — « la limite, c'est les résultats ». Le facteur décisif reste la **persévérance**.

---

## 10. Application dans PlaZma

PlaZma **est**, à l'échelle d'une structure amateur/semi-pro, l'équivalent de l'application maison décrite dans l'entretien : un **hub unique** qui remplace les Google Sheets éparpillés. Voici comment transposer chaque principe de l'analyste « complet » dans l'outil.

### 10.1 — Un hub, pas des feuilles dispersées

La trajectoire « plein de Google Sheets → une grosse application qui devient un hub pour tout le monde » est exactement la raison d'être de PlaZma. Les modules [`Dashboard`](plazma-dashboard.html), [`Scouting`](plazma-scouting.html), [`Draft`](plazma-draft.html), [`Analyse`](plazma-analyse.html) et [`Scrim`](plazma-scrim.html) centralisent ce qui, autrement, vivrait dans des classeurs ingérables.

### 10.2 — Modèle de scoring P / RP dans le Scouting

| Brique entretien | Implémentation PlaZma |
|---|---|
| Performance (P) + Relative Performance (RP) | Colonnes de score dans [`Scouting`](plazma-scouting.html), croisant solo queue / compétitif |
| Tier list plutôt que classement | Grouper les candidats par **tiers** (A/B/C), pas par rang absolu |
| Détection des « surnageurs » | Mettre en évidence une **RP élevée** malgré un win rate d'équipe faible |
| Formulaire croisé avec la base | Import d'un formulaire d'application → matching automatique avec les profils connus |

### 10.3 — Architecture de données propre

Le piège « champions stockés en texte » se prévient dès la modélisation Firestore :

- **Champions comme objets** (rôle, classe : tank/mêlée/range, type de dégâts) — pas de simples chaînes.
- **Roster courant** comme entité distincte de l'historique des matchs, pour toujours afficher les **joueurs actuels** même sans nouveau match joué.

> Ces règles de modélisation gagnent à être documentées à côté de la [`SECURITE`](SECURITE.md) et des [`firestore.rules`](firestore.rules).

### 10.4 — Visualisations plutôt que tableaux bruts

L'entretien insiste sur le **visuel** (pathings de jungler affichés un par un, *ward coverage* à 15 min). Dans PlaZma :

- Fiches de rôle [`perf-jungler`](plazma-perf-jungler.html), [`perf-top`](plazma-perf-top.html), [`perf-mid`](plazma-perf-mid.html), [`perf-adc`](plazma-perf-adc.html), [`perf-supp`](plazma-perf-supp.html) : privilégier des cartes de vision et des timelines plutôt que des grilles de chiffres.
- Un passing/ward affiché **individuellement** se lit mieux qu'une image surchargée (« la pollution visuelle fait qu'on ne comprend rien »).

### 10.5 — Piloter par l'usage, pas par le feedback

Faute de retours explicites du staff, instrumenter PlaZma :

| À suivre | Où |
|---|---|
| Qui se connecte, à quelle fréquence | Logs d'accès / [`Admin`](plazma-admin.html) |
| Quelles fonctionnalités sont réellement utilisées | Suivi d'événements par page |
| Satisfaction staff & joueurs | [`Satisfaction`](plazma-satisfaction.html) · [`Satisfaction coach`](plazma-satisfaction-coach.html) |

L'objectif est le même que dans l'entretien : **maximiser l'usage** pour, par itérations, sortir les outils qui améliorent vraiment le workflow.

### 10.6 — Le mercato outillé

[`Scouting`](plazma-scouting.html) + [`Draft`](plazma-draft.html) + [`Review individuelle`](plazma-review-individuelle.html) permettent de reconstituer le **processus SWOT** : tier list de départ, puis affinage par observations qualitatives (attitude, proactivité, langue) consignées pendant les tryouts.

### 10.7 — Honnêteté des chiffres

Puisqu'« on peut faire dire aux chiffres ce qu'on veut », PlaZma doit, sur les écrans à enjeu (recrutement, review), **afficher des batteries de métriques équilibrées** (offensives *et* défensives, absolues *et* relatives) plutôt qu'une sélection flatteuse — et réserver les angles « show » aux contenus de communication.

---

## Voir aussi

- [[Structure_du_Staff_et_Roles]] — fiche de poste de l'Analyste Performance et place dans l'organigramme
- [[Protocole_de_Recrutement]] — cadre du mercato et de l'évaluation des joueurs
- [[Identite_et_Competences_du_Coach]] — la dyade coach ↔ analyste (l'analyste prépare, le coach décide)
