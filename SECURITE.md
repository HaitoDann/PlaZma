# ARCHI — Sécurité & gestion des comptes

ARCHI utilise **Firebase Authentication** (comptes e-mail / mot de passe) et des
**règles de sécurité Firestore** pour protéger réellement les données. Le site
reste 100 % statique (GitHub Pages) : toute la sécurité est côté Firebase.

> ⚠️ **Tant que les 3 étapes ci-dessous ne sont pas faites dans la console
> Firebase, la protection n'est pas active.** Le code est prêt ; il manque juste
> la configuration côté Firebase (à faire une seule fois).

---

## 🛠️ Mise en route (une seule fois, ~10 min)

### 1. Activer la connexion par e-mail
Console Firebase → projet **plazma-esport** → **Authentication** → *Get started* →
onglet **Sign-in method** → activer **E-mail/Mot de passe** → *Enregistrer*.

### 2. Déployer les règles de sécurité
Console Firebase → **Firestore Database** → onglet **Règles** → coller
l'intégralité du fichier [`firestore.rules`](firestore.rules) → **Publier**.

Ces règles font que :
- chaque collection/module n'est lisible/modifiable que par les comptes qui y ont accès ;
- le **roster** (noms/emojis) reste lisible publiquement (le questionnaire de satisfaction en a besoin) ;
- le **questionnaire de satisfaction** reste ouvert en **création** (les joueurs le remplissent sans compte), mais seules les personnes ayant l'accès « satisfaction » peuvent lire/supprimer les réponses.

### 3. Créer le premier administrateur
C'est le seul compte à créer à la main (ensuite tout se fait dans la page **Comptes**).

**a. Créer le compte de connexion**
Authentication → **Users** → *Add user* → e-mail + mot de passe → *Add user*.
Copier l'**UID** affiché (identifiant du compte).

**b. Lui donner le rôle admin**
Firestore Database → *Start collection* (si besoin) → **Collection ID** : `users`
→ **Document ID** : *coller l'UID copié* → ajouter les champs :

| Champ      | Type    | Valeur                    |
|------------|---------|---------------------------|
| `name`     | string  | Ton nom                   |
| `email`    | string  | Ton e-mail                |
| `role`     | string  | `admin`                   |
| `disabled` | boolean | `false`                   |

→ *Enregistrer*.

Tu peux maintenant te connecter sur **login.html** avec cet e-mail. En tant
qu'admin, l'onglet **Comptes** apparaît dans le menu : tous les autres comptes
se créent de là, sans jamais retoucher la console.

---

## 👥 Gérer les comptes (page « Comptes »)

Réservée aux administrateurs. Elle permet de :

- **Créer un compte** : nom, e-mail, mot de passe provisoire, rôle et modules
  accessibles (des préréglages *Staff complet / Analyste / Coach / Joueur*
  cochent les cases pour toi).
- **Modifier les accès** d'un membre (cocher/décocher chaque module).
- **Passer / retirer admin**.
- **Réinitialiser le mot de passe** (envoie un e-mail à la personne).
- **Désactiver** un compte (bloque l'accès sans le supprimer).
- **Retirer l'accès** (supprime le profil : la personne ne voit plus rien).

> La création de compte utilise une connexion Firebase secondaire : tu **restes
> connecté** en tant qu'admin pendant l'opération.

### Rôles et modules

- **Administrateur** : accès total à tous les modules **+** gestion des comptes.
- **Membre** : accès **uniquement** aux modules cochés parmi :
  Planning · Scrim · Scouting · Équipe · Dashboard · Coach · Satisfaction · Fiches perf.

Un module non coché n'apparaît pas dans le menu du membre et son ouverture directe
est bloquée (et refusée côté serveur par les règles Firestore).

---

## ❓ Questions fréquentes

**Supprimer complètement un compte de connexion ?**
« Retirer l'accès » enlève tous les droits. Le compte de connexion lui-même se
supprime dans la console (Authentication → Users → *Delete account*).

**Un joueur peut-il remplir la satisfaction sans compte ?**
Oui : le questionnaire reste public. Seule la lecture des réponses demande un
compte avec l'accès « satisfaction ».

**La clé API Firebase est visible dans le code, est-ce grave ?**
Non : une clé API Firebase est publique par nature. Ce sont les **règles
Firestore** (étape 2) qui protègent les données, pas la clé.
