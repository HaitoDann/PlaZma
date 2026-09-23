# ARCHI — Règles de design (anti-« look IA »)

Ce fichier verrouille l'identité visuelle d'ARCHI. But : ne plus ressembler à
la sortie moyenne d'un outil génératif (dégradé violet, cartes à bordure grise,
glassmorphism, emojis-boutons, police par défaut). **Toute évolution visuelle
respecte ces règles.**

Références (consensus d'experts, sept. 2026) : un modèle renvoie la *moyenne*
de son entraînement ; on s'en écarte en fournissant **nos** tokens, **nos**
polices, **nos** composants, **nos** règles. Cf. SmoothUI « AI Design Slop »,
hey.com « Spot the Slop », Shuffle, Claude Code « Unslop UI ».

## 1. Couleur — un seul accent, zéro dégradé décoratif
- **Accent unique : cyan `--accent` (#22d3ee).** Un seul.
- **Interdit** : dégradés décoratifs, et surtout le dégradé **cyan→violet**
  (`#8b5cf6`, `#a855f7`) — c'est LE marqueur IA n°1.
- La couleur ne sert qu'à **signifier** : victoire/défaite (`--ok`/`--err`),
  gravité, rôles LoL (`--top/--jungle/--mid/--adc/--support`). Jamais en
  décoration.
- Les couleurs de rôle LoL sont **sémantiques** (identité des lanes), pas des
  accents d'UI — ne pas les réutiliser comme liserés de cartes.

## 2. Cartes — sans bordure par défaut
- La hiérarchie vient du **fond + d'une ombre douce**, pas d'un contour gris.
- `.card` / `.panel` : `border:transparent`, séparation par `--surface` vs
  `--bg` + `--shadow-1/2`.
- Une bordure ne s'utilise que si elle **porte du sens** (sélection, alerte).
- **Interdit** : le liseré coloré de 3px sur chaque carte (`::before`).

## 3. Pas de glassmorphism
- Surfaces **opaques**. Pas de `backdrop-filter: blur` sur la topbar ni les
  cartes (tell IA + coût perf). Flou toléré ≤ 2px, uniquement sur le voile
  d'une modale.

## 4. Icônes — jeu d'icônes ligne, pas d'emojis d'interface
- Les contrôles (boutons, menus, entêtes) utilisent des **SVG ligne** cohérents
  (stroke 1.8, currentColor), comme le bouton power ou l'ampoule de la nav.
- L'emoji est **toléré uniquement** quand il est volontairement ludique et
  porteur de sens humain : roster (👍🕊️🐯…), réactions. Jamais comme icône de
  bouton/menu.
- Migration en cours : reste à convertir les emojis de menus (admin, idées,
  maintenance). Tout **nouveau** composant part déjà en SVG.

## 5. Typographie — une identité, pas la police par défaut
- **Texte** : Manrope.
- **Display (titres, gros chiffres)** : **Space Grotesk** — caractériel,
  « tech/sport », distingue ARCHI d'un dashboard générique.
- **Mono (timers, scores, LP, compteurs)** : **JetBrains Mono** — donne le
  côté « outil pro ». (Ne jamais remettre une sans-serif en `--font-mono`.)
- `font-variant-numeric: tabular-nums` sur les colonnes de chiffres.

## 6. Retenue des accents
- Neutre par défaut ; la couleur est l'exception qui informe.
- Éviter les « eyebrows » MAJUSCULES très espacées partout : casse normale,
  tracking 0 (`.eyebrow`). Les micro-labels de data-viz peuvent rester en
  petites capitales discrètes.

## 7. Voix éditoriale
- Ton PlaZma / esport : court, direct, jargon assumé. Éviter le remplissage
  générique (« Performance, comportement, point à retravailler… »).
- Les libellés disent une action concrète, pas une catégorie abstraite.

## 8. Mouvement (rappel, cf. règles existantes)
- Transitions fonctionnelles < 250ms, ease-out, `transform`/`opacity`
  uniquement (jamais `width`/`height`), `prefers-reduced-motion` respecté.
  Le ressort (spring) est réservé au *delight*.

---

## Tokens de référence (`assets/theme.css`)
- Surfaces : `--bg #0b0f14` · `--surface #12171f` · `--surface-2 #171d26` ·
  `--elevated #1c232d`
- Accent : `--accent #22d3ee` (+ `--accent-soft`, `--accent-line`)
- États : `--ok #22c55e` · `--warn #f59e0b` · `--err #ef4444`
- Rayons : `--r-sm 7` · `--r 10` · `--r-lg 14`
- Ombres : `--shadow-1/2/3`
- Polices : `--font` (Manrope) · `--font-display` (Space Grotesk) ·
  `--font-mono` (JetBrains Mono)

Palette **plafonnée** : accent unique + états + rôles LoL. Toute nouvelle
couleur doit se justifier par un sens, pas par l'esthétique.

## 8. v4 « Pro » (sept. 2026)
- Couche finale `PRO — v4` en fin de `assets/theme.css` : elle prime sur tout le reste.
- Typo unique **IBM Plex Sans / IBM Plex Mono** ; titres en 600, sans police display.
- Neutres froids, accent `#4cb8cc` désaturé, arrondis 4–8px, cartes à filet fin sans ombre.
- Aucune animation décorative (particules, étoiles, curseur, halos, icônes animées, ripple).
- Pas d'emoji d'interface ; seuls restent les emojis d'identité du roster et ceux des embeds Discord.
