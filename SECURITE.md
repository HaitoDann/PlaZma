# ARCHI — Sécurité & gestion des comptes

ARCHI utilise **Firebase Authentication** et des **règles de sécurité Firestore**
pour protéger réellement les données. Le site reste 100 % statique (GitHub Pages) :
toute la sécurité est côté Firebase.

La connexion se fait par **nom d'utilisateur** (style GLPI), pas par e-mail.
En coulisses, chaque pseudo devient `pseudo@archi.local` côté Firebase — c'est un
simple identifiant technique, aucune adresse e-mail réelle n'est utilisée ni requise.
Ce domaine interne (`archi.local`) est défini dans `assets/plazma.js`
(`USER_DOMAIN`) et doit rester identique dans `login.html` et `plazma-admin.html`.

> ⚠️ **Tant que les 3 étapes ci-dessous ne sont pas faites dans la console
> Firebase, la protection n'est pas active.** Le code est prêt ; il manque juste
> la configuration côté Firebase (à faire une seule fois).

---

## 🛠️ Mise en route (une seule fois, ~10 min)

### 1. Activer le fournisseur « E-mail/Mot de passe »
Console Firebase → projet **plazma-esport** → **Authentication** → *Get started* →
onglet **Sign-in method** → activer **E-mail/Mot de passe** → *Enregistrer*.

> C'est ce fournisseur qui gère aussi la connexion par nom d'utilisateur : ARCHI
> lui envoie `pseudo@archi.local`. Rien d'autre à activer.

### 2. Déployer les règles de sécurité
Console Firebase → **Firestore Database** → onglet **Règles** → coller
l'intégralité du fichier [`firestore.rules`](firestore.rules) → **Publier**.

Ces règles font que :
- chaque collection/module n'est lisible/modifiable que par les comptes qui y ont accès ;
- le **roster** (noms/emojis) reste lisible publiquement (le questionnaire de satisfaction en a besoin) ;
- le **questionnaire de satisfaction** reste ouvert en **création** (les joueurs le remplissent sans compte), mais seules les personnes ayant l'accès « satisfaction » peuvent lire/supprimer les réponses.

### 3. Créer le premier administrateur
C'est le seul compte à créer à la main (ensuite tout se fait dans la page **Comptes**).
On choisit un pseudo, par exemple **admin**.

**a. Créer le compte de connexion**
Authentication → **Users** → *Add user*. Dans le champ **e-mail**, saisir le pseudo
suivi de `@archi.local` — par ex. `admin@archi.local` — puis un mot de passe.
→ *Add user*. Copier l'**UID** affiché.

**b. Lui donner le rôle admin**
Firestore Database → *Start collection* (si besoin) → **Collection ID** : `users`
→ **Document ID** : *coller l'UID copié* → ajouter les champs :

| Champ      | Type    | Valeur          |
|------------|---------|-----------------|
| `name`     | string  | Ton nom affiché |
| `username` | string  | `admin`         |
| `role`     | string  | `admin`         |
| `disabled` | boolean | `false`         |

→ *Enregistrer*.

Tu peux maintenant te connecter sur **login.html** avec le nom d'utilisateur
`admin` (pas l'`@archi.local` — juste le pseudo) et ton mot de passe. En tant
qu'admin, l'onglet **Comptes** apparaît : tous les autres comptes se créent de là,
sans jamais retoucher la console.

---

## 👥 Gérer les comptes (page « Comptes »)

Réservée aux administrateurs. Elle permet de :

- **Créer un compte** : nom affiché, nom d'utilisateur, mot de passe provisoire,
  rôle et modules accessibles (des préréglages *Staff complet / Analyste / Coach /
  Joueur* cochent les cases pour toi).
- **Modifier les accès** d'un membre (cocher/décocher chaque module).
- **Passer / retirer admin**.
- **Désactiver** un compte (bloque l'accès sans le supprimer).
- **Retirer l'accès** (supprime le profil : la personne ne voit plus rien).

### Mots de passe

- Chaque membre **change son propre mot de passe** une fois connecté : clic sur
  son nom (en haut à droite) → *Changer mon mot de passe*.
- À la création, l'admin fournit un **mot de passe provisoire** que la personne
  changera elle-même.
- **Mot de passe oublié / membre bloqué** : sans e-mail, il n'y a pas de lien de
  réinitialisation automatique. L'admin supprime le compte de connexion
  (Authentication → Users → l'entrée `pseudo@archi.local` → *Delete account*),
  retire l'ancien profil dans la page **Comptes**, puis recrée le compte avec le
  même nom d'utilisateur et un nouveau mot de passe provisoire.

> La création de compte utilise une connexion Firebase secondaire : tu **restes
> connecté** en tant qu'admin pendant l'opération.

### Rôles et modules

- **Administrateur** : accès total à tous les modules **+** gestion des comptes.
- **Membre** : accès **uniquement** aux modules cochés parmi :
  Planning · Scrim · Scouting · Équipe · Dashboard · Coach · Satisfaction (questionnaires) ·
  Résultats satisfaction (🔒 lecture des réponses, sensible) · Fiches perf.

Un module non coché n'apparaît pas dans le menu du membre et son ouverture directe
est bloquée (et refusée côté serveur par les règles Firestore).

---

## ❓ Questions fréquentes

**Pourquoi une connexion par nom d'utilisateur et pas par e-mail ?**
Pour coller à un fonctionnement type GLPI. Techniquement, Firebase ne gère que des
e-mails : ARCHI transforme donc le pseudo en `pseudo@archi.local` de façon
transparente. Personne n'a besoin d'une vraie adresse e-mail.

**Supprimer complètement un compte de connexion ?**
« Retirer l'accès » enlève tous les droits (le profil disparaît). Le compte de
connexion lui-même se supprime dans la console (Authentication → Users →
l'entrée `pseudo@archi.local` → *Delete account*).

**Un joueur peut-il remplir la satisfaction sans compte ?**
Oui : le questionnaire reste public. Seule la lecture des réponses demande un
compte avec l'accès « satisfaction ».

**La clé API Firebase est visible dans le code, est-ce grave ?**
Non : une clé API Firebase est publique par nature. Ce sont les **règles
Firestore** (étape 2) qui protègent les données, pas la clé.
