# Formules et Mécaniques

> Les calculs derrière les stats. Savoir pourquoi on build ce qu'on build.

---

## Point de Vie Effectif (PVE)

La vraie résistance d'un champion, armure et PV combinés.

```
PVE = PV / (100 / (100 + Résistances))
```

Chaque point de résistance donne **1% de PVE**.

> *Exemple : 50 armure + 1000 PV → il faut 1500 dégâts physiques pour tuer ce champion.*

**Quand prendre de l'armure plutôt que des PV ?**
```
PV optimal = 7.5 × Résistances + 750
```
Si tes PV sont inférieurs à cette valeur → prendre des PV est plus efficient.
Si supérieurs → prendre des résistances est plus efficient.

---

## Dégâts critiques

```
Dégâts critiques = Dégâts d'attaque × 1.75
```

Certains effets (ex : Lame d'Infini) augmentent le multiplicateur au-delà de 1.75.

---

## Létalité

La létalité est de l'armure fixe ignorée — fonctionne mieux contre les cibles sans armure.

```
Armure retirée = Létalité × (0.6 + 0.4 × niveau du champion / 18)
```

→ La létalité monte en efficacité avec le niveau.
→ Contre les tanks : utiliser la **pénétration d'armure %** plutôt que la létalité.

---

## Résistances — logique générale

| Type | Efficace contre | Inefficace contre |
|------|----------------|------------------|
| Armure | Dégâts physiques | Dégâts magiques, bruts |
| Résistance magique | Dégâts magiques | Dégâts physiques, bruts |

Les dégâts bruts ignorent **toutes** les résistances et effets de réduction.

---

## Ténacité

Réduit la durée des effets de CC.
- **Non stackable de façon additive** — dépend de la combinaison des effets
- **Ne s'applique pas** : suppressions, stases, projections en l'air (bumps)

---

## Vitesse d'attaque

- Représente le nombre d'attaques par seconde
- Plafond : **2.5 attaques/seconde** (peut être brisé dans certaines conditions)
- Les bonus % sont calculés sur la vitesse de base du champion → un champion avec une faible base de vitesse d'attaque reçoit un bonus absolu plus faible

---

## Omnivampirisme vs Vol de Vie

| Statistique | S'applique sur | Efficacité zone / familiers |
|-------------|---------------|----------------------------|
| Vol de vie | Dégâts physiques d'AA uniquement (+ certains sorts à impact) | Normale |
| Omnivampirisme | Tous les types de dégâts | Réduit à 33% |

Le Vol de Vie est calculé **après réduction des dégâts** (armure, shields, etc.).
L'Omnivampirisme ne bénéficie pas du Heal Power.

---

## Liens

- [[INDEX]] — vue d'ensemble des maths
- [[Outils_Défensifs]] — application concrète des résistances
- [[../05_Draft_&_Comps/Les_Piliers_de_la_Draft]] — le damage profile (AD/AP split) change selon ces formules
