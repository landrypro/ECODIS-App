# ECODIS App — P4.2.2 : gestion des profils, comptes et habilitations

**Statut :** P4.2.2-A à P4.2.2-D implémentés localement — recette fonctionnelle globale à réaliser
**Dépendances :** P4.2 rôles cumulables, P4.2.1 MFA administrateur, Supabase Auth  
**Objectif immédiat :** préparer, depuis l'application, les comptes de recette `content_editor` et `moderator` nécessaires à P4.1 et P4.3.

---

## 1. Constat et décision d'architecture

ECODIS possède actuellement deux parcours concurrents :

- le tableau de bord d'administration dispose d'une section Utilisateurs capable d'afficher les rôles cumulables et d'appeler `PUT /users/:id/roles` ;
- le lien Profil > Administration > Gestion des utilisateurs ouvre encore `/admin/users`, un écran historique limité au basculement `Membre` / `Admin` via `PUT /users/:id/role`.

La décision est de faire de `/admin/users` le point d'entrée unique de l'administration des comptes et de lui faire utiliser les rôles P4.2. La logique et les composants de la section moderne du tableau de bord seront extraits et réutilisés. L'ancien endpoint de rôle unique reste temporairement compatible, mais ne doit plus être appelé par le frontend.

## 2. Périmètre fonctionnel

### 2.1 Inclus

1. **Fiche de profil personnel**
   - afficher nom, adresse e-mail, date d'inscription, dernière connexion, rôles et permissions effectives ;
   - modifier son nom affiché ;
   - demander la modification de son e-mail selon le flux de confirmation Supabase Auth ;
   - accéder au parcours existant de mot de passe oublié / réinitialisation ;
   - accéder à Sécurité MFA pour les administrateurs.

2. **Gestion des utilisateurs par l'administration**
   - rechercher, filtrer et consulter un compte ;
   - attribuer ou retirer les rôles autorisés ;
   - visualiser les permissions effectives sans les modifier individuellement ;
   - envoyer une invitation à un nouveau membre ou renvoyer une invitation expirée ;
   - envoyer un lien de réinitialisation de mot de passe ;
   - suspendre, réactiver ou supprimer selon les règles de gouvernance ;
   - consulter l'historique d'audit du compte.

3. **Préparation de recette**
   - créer ou identifier un compte de recette ;
   - lui attribuer `content_editor`, `moderator` ou `admin` dans les limites de l'acteur ;
   - vérifier immédiatement son ensemble de rôles et de permissions avant déconnexion.

### 2.2 Hors périmètre

- affichage, saisie, stockage ou transmission d'un mot de passe par un administrateur ;
- attribution de permissions unitaires en dehors des rôles ;
- attribution ou retrait de `super_admin` dans l'application ;
- modification du facteur MFA d'un tiers ;
- import massif d'utilisateurs, SSO, groupes locaux ou délégation par église ;
- effacement silencieux de l'historique d'audit.

## 3. Modèle d'habilitation

Les rôles sont globaux et cumulables. Le rôle `user` est toujours conservé.

| Action | Admin AAL2 | Super-admin AAL2 | Justification |
|---|---:|---:|---|
| Consulter les comptes | Oui | Oui | administration courante |
| Attribuer/retirer `content_editor` | Oui | Oui | préparation et pilotage éditorial |
| Attribuer/retirer `moderator` | Oui | Oui | préparation et pilotage communautaire |
| Attribuer/retirer `admin` | Non | Oui | élévation de privilège critique |
| Attribuer/retirer `super_admin` | Non | Non | procédure de gouvernance hors application |
| Inviter / renvoyer une invitation | Oui | Oui | création contrôlée de comptes |
| Envoyer un lien de réinitialisation | Oui | Oui | l'utilisateur choisit seul son secret |
| Suspendre/réactiver un membre, éditeur ou modérateur | Oui | Oui | protection opérationnelle |
| Suspendre/réactiver un admin | Non | Oui | séparation des responsabilités |
| Supprimer un compte ordinaire | Oui | Oui | action exceptionnelle auditée |
| Supprimer un admin | Non | Oui | action critique auditée |
| Supprimer un super-admin | Non | Non | interdit par l'application |

Règles absolues :

- tout changement de rôle exige un motif de 10 à 500 caractères ;
- lorsque `APP_REQUIRE_ADMIN_MFA=true`, toute action d'administration requiert AAL2 ; l'interface de challenge obligatoire et l'API appliquent la même règle ;
- toute opération critique (`admin`, suspension d'admin, suppression) exige une session AAL2 et une confirmation explicite ;
- un acteur ne peut ni modifier son propre rôle, ni suspendre/supprimer son propre compte ;
- le dernier `super_admin` actif ne peut jamais être supprimé ou suspendu ;
- l'API vérifie les permissions et l'AAL : les contrôles d'interface ne sont que des aides ergonomiques ;
- l'autorisation repose exclusivement sur `user_role_assignments`, jamais sur `user_metadata`.

## 4. Parcours utilisateur attendus

### U-01 — Préparer un éditeur de recette

1. Le super-admin AAL2 ouvre **Administration > Utilisateurs**.
2. Il crée un compte par invitation ou sélectionne un compte existant.
3. Dans la fiche du compte, il coche `Éditeur`, justifie le changement puis confirme.
4. L'écran affiche les rôles résultants (`Membre`, `Éditeur`) et les permissions effectives.
5. L'audit contient l'acteur, l'état avant/après, le motif et l'horodatage.
6. L'utilisateur se reconnecte et peut créer/soumettre un brouillon, mais pas publier.

### U-02 — Préparer un modérateur de recette

1. Un admin ou super-admin ouvre la fiche d'un membre.
2. Il ajoute `Modérateur`, avec motif.
3. Après reconnexion, le membre accède à la file de modération, sans accès à la publication de contenu.

### U-03 — Réinitialiser son propre mot de passe

1. L'utilisateur sélectionne **Mot de passe oublié** sur la connexion ou dans son profil.
2. ECODIS affiche toujours un message neutre, sans confirmer l'existence de l'adresse.
3. Le lien e-mail conduit à `/reset-password`, URL autorisée dans Supabase Auth.
4. L'utilisateur choisit son nouveau mot de passe ; aucune personne ECODIS ne le voit.
5. Toutes les sessions sont invalidées conformément au flux de sécurité existant.

### U-04 — Aider un utilisateur sans connaître son mot de passe

1. L'administrateur ouvre la fiche du compte et choisit **Envoyer un lien de réinitialisation**.
2. Une confirmation précise que l'e-mail est envoyé au titulaire, sans jamais exposer le lien ou le secret à l'administrateur.
3. Le résultat affiché reste volontairement neutre pour limiter l'énumération de comptes.
4. L'action est auditée sous `password_reset_requested`.

### U-05 — Suspendre un compte

1. L'administrateur ouvre la fiche d'un membre et choisit **Suspendre**.
2. Il renseigne le motif puis confirme la suspension, qui reste active jusqu'à une réactivation explicite.
3. Les nouvelles connexions sont refusées et les sessions sont révoquées.
4. La fiche affiche le statut et le motif accessibles aux administrateurs autorisés.
5. La réactivation exige un motif et génère un second audit.

## 5. Écrans et expérience

### 5.1 Point d'entrée unique

`/admin/users` devient la page de référence. Le Profil et le tableau de bord y redirigent ; la section Utilisateurs du tableau de bord réutilise la même vue ou affiche un lien vers celle-ci.

La liste comprend : recherche nom/e-mail, filtres par rôle et statut, badges de rôles cumulables, statut du compte, dernière connexion et pagination.

### 5.2 Fiche utilisateur

La sélection d'une ligne ouvre une fiche latérale ou une page détail comprenant :

- identité : nom, e-mail masqué partiellement selon le rôle, dates et statut ;
- rôles actuels sous forme de badges ;
- permissions effectives, lisibles mais non éditables ;
- actions autorisées pour l'acteur connecté uniquement ;
- formulaire de motif lors d'un changement de rôle, statut ou suppression ;
- audit ciblé sur le compte, sans jeton, mot de passe, QR code, secret MFA ni information sensible inutile.

Les actions indisponibles sont visibles avec une explication courte, par exemple « Super-administrateur AAL2 requis ».

### 5.3 Création et invitation

La création administrative par mot de passe saisi dans l'interface est supprimée. L'action devient **Inviter un utilisateur** : nom et e-mail, puis envoi par l'Edge Function via `auth.admin.inviteUserByEmail`. L'invité choisit lui-même son mot de passe après le lien de confirmation.

Les URL de retour d'invitation et de réinitialisation doivent être déclarées dans les Redirect URLs Supabase pour les domaines staging et Vercel. Une invitation expirée peut être renvoyée, sans créer un doublon.

## 6. Contrats API cibles

Tous les endpoints sont sous le préfixe API existant et passent par l'Edge Function. Les réponses ne contiennent jamais de mot de passe, jeton, lien de récupération, secret ou QR code.

| Endpoint | Permission minimale | Rôle |
|---|---|---|
| `GET /users` | `users_manage_basic_roles` | liste filtrée et paginée |
| `GET /users/:id` | `users_manage_basic_roles` | fiche, rôles, statut, permissions et audit restreint |
| `PUT /users/:id/roles` | `users_manage_basic_roles` + règles P4.2 | remplacement atomique des rôles avec motif |
| `POST /users/invitations` | `users_manage_basic_roles` | invitation sans mot de passe administrateur |
| `POST /users/:id/invitation` | `users_manage_basic_roles` | renvoi d'une invitation non confirmée |
| `POST /users/:id/password-reset` | `users_manage_basic_roles` | demande de lien de récupération auditée |
| `PUT /users/:id/status` | règle de suspension | suspend ou réactive avec motif |
| `DELETE /users/:id` | `users_delete` + règles P4.2 | suppression exceptionnelle et auditée |
| `PUT /users/me/profile` | utilisateur connecté | mise à jour contrôlée du nom ; l'e-mail suit le flux Auth dédié |

Les endpoints historiques `PUT /users/:id/role` et la création par mot de passe restent temporairement disponibles seulement pour la compatibilité P0-P3 ; ils ne sont plus utilisés par le nouveau frontend. Leur retrait est conditionné à une recette complète verte.

## 7. Données, sécurité et audit

### 7.1 Modèle de données

Les rôles restent dans `user_role_assignments`. Les permissions sont calculées par `authorizationFromRoles` et ne sont pas persistées par utilisateur.

Pour l'état du compte, l'implémentation s'appuie sur Supabase Auth via un appel serveur `auth.admin.updateUserById`. Une suspension n'est jamais pilotée depuis le navigateur et ne requiert pas l'exposition d'une clé d'administration. La table métier mémorise le motif, les acteurs et les horodatages ; elle est privée/RLS, l'Edge Function demeure la seule voie d'écriture et la décision Auth reste la référence pour autoriser la connexion. Le lot actuel ne prévoit pas d'expiration automatique : une suspension est maintenue jusqu'à réactivation explicite.

### 7.2 Événements d'audit attendus

| Action | Nom d'audit | Métadonnées autorisées |
|---|---|---|
| Invitation | `user_invitation_sent` | cible, e-mail normalisé/masqué, contexte |
| Rôles | `role_assignments_update` | cible, avant/après, motif |
| Demande mot de passe | `password_reset_requested` | cible, acteur, résultat technique minimal |
| Suspension | `user_suspended` | cible, motif |
| Réactivation | `user_reactivated` | cible, motif |
| Suppression | `delete_user` | cible, rôles et motif |
| Profil personnel | `profile_updated` | champs non sensibles modifiés |

Ne jamais journaliser les mots de passe, les liens d'invitation ou de récupération, les jetons, les codes TOTP, le QR code ou le secret MFA.

## 8. Découpage de réalisation

| Lot | Contenu | Condition de sortie |
|---|---|---|
| P4.2.2-A | Unifier `/admin/users`, rôles cumulables, permissions effectives, motif et audit | création d'un éditeur et d'un modérateur possible depuis l'interface |
| P4.2.2-B | Invitation et demande de réinitialisation | aucun mot de passe tiers saisi ou affiché ; e-mails et Redirect URLs validés |
| P4.2.2-C | Statut suspendu/réactivé et révocation de session | connexion et API refusées au compte suspendu ; audit complet |
| P4.2.2-D | Profil personnel et retrait de l'UI historique | un seul parcours utilisateur, tests de non-régression verts |

Le lot **P4.2.2-A** est le minimum nécessaire à la recette P4.1/P4.3. Les lots B à D renforcent la préparation opérationnelle mais peuvent être planifiés après cette recette si les comptes de test existent déjà.

### État de réalisation P4.2.2-A

- `/admin/users` consomme désormais `PUT /users/:id/roles` ; l'ancien endpoint de rôle unique n'est plus appelé par cet écran ;
- l'interface permet de cumuler `content_editor`, `moderator` et, pour un super-administrateur, `admin` ;
- les permissions effectives sont renvoyées par `GET /users` et affichées en lecture seule ;
- un motif de 10 à 500 caractères est requis par l'API et par l'interface ;
- l'API interdit aussi la modification de ses propres rôles, y compris par un super-administrateur ;
- aucune invitation, suspension ou gestion de mot de passe tiers n'est introduite dans ce lot : ces capacités restent respectivement P4.2.2-B et P4.2.2-C.

### État de réalisation P4.2.2-B

- l'administration peut inviter un nouveau compte en indiquant uniquement son nom et son e-mail ;
- l'Edge Function utilise `auth.admin.inviteUserByEmail` côté serveur, avec l'URL de retour `APP_AUTH_REDIRECT_URL` ;
- une invitation non confirmée peut être renvoyée depuis la fiche utilisateur ;
- l'administration peut demander un lien de réinitialisation ; il est envoyé au titulaire et n'est jamais retourné par l'API ;
- les événements `user_invitation_sent`, `user_invitation_resent` et `password_reset_requested` sont journalisés sans lien, jeton ni adresse e-mail complète ;
- `APP_AUTH_REDIRECT_URL` doit être une origine CORS autorisée et une Redirect URL déclarée dans Supabase Auth ;
- aucune modification directe de mot de passe n'est possible depuis l'administration.

### État de réalisation P4.2.2-C

- `user_account_status` conserve le statut, le motif, les acteurs et les horodatages ; la table est protégée par RLS, sans accès `anon` ou `authenticated` ;
- la suspension applique `ban_duration` dans Supabase Auth, bloque immédiatement les appels ECODIS authentifiés et supprime les refresh sessions du titulaire ;
- le frontend vérifie l'accès du compte au chargement, toutes les 30 secondes et au retour sur l'onglet ; tout `401` protégé nettoie la session locale et actualise immédiatement les pages ;
- la réactivation annule le bannissement ; le titulaire doit ouvrir une nouvelle session ;
- l'API empêche l'auto-suspension, l'action sur un super-administrateur et la suspension d'un administrateur par un administrateur ordinaire ;
- chaque suspension/réactivation exige un motif de 10 à 500 caractères et génère respectivement `user_suspended` ou `user_reactivated` dans l'audit ;
- la révocation SQL est réservée au rôle `service_role` par les privilèges `EXECUTE` ; elle ne dépend pas des anciennes variables de claims PostgREST ;
- l'interface affiche le statut et le motif, puis permet l'action autorisée depuis la fiche utilisateur.

### État de réalisation P4.2.2-D

- `/profil` devient le parcours personnel de référence : le titulaire consulte son identité, ses dates, ses rôles et ses permissions effectives en lecture seule ;
- le nom affiché est mis à jour par `PUT /users/me/profile`, sous contrôle de l'utilisateur authentifié ; l'événement `profile_updated` ne conserve que le champ non sensible modifié ;
- le changement d'adresse e-mail passe directement par `supabase.auth.updateUser` avec confirmation et retour vers `/profil` ; l'API d'administration n'intervient pas et ne contourne donc pas la validation Supabase Auth ;
- le profil permet de demander son propre lien de réinitialisation ; il n'affiche, ne collecte ni ne transmet jamais de mot de passe ;
- le tableau de bord d'administration ne propose plus la section historique Utilisateurs, ni la création d'un compte avec mot de passe ; il dirige vers `/admin/users`, point d'entrée unique pour l'administration des comptes ;
- l'ancien endpoint `PUT /users/:id/role` reste présent uniquement pour la compatibilité P0-P3, mais aucun écran P4.2.2 ne l'appelle.

## 9. Critères d'acceptation et recette

| Cas | Vérification | Résultat attendu |
|---|---|---|
| U-ADM-01 | Admin ouvre `/admin/users` | liste et rôles cumulables visibles ; aucun appel à l'ancien endpoint rôle unique |
| U-ADM-02 | Admin ajoute `content_editor` | autorisé, motif obligatoire, audit présent |
| U-ADM-03 | Admin ajoute `moderator` | autorisé, motif obligatoire, audit présent |
| U-ADM-04 | Admin tente d'ajouter `admin` | action absente/inactive ou refus 403 ; aucun changement |
| U-ADM-05 | Super-admin AAL1 tente d'ajouter `admin` | challenge MFA obligatoire ; aucune élévation |
| U-ADM-06 | Super-admin AAL2 ajoute `admin` | autorisé et audité |
| U-ADM-07 | Consulter une fiche utilisateur | permissions dérivées affichées, jamais éditables individuellement |
| U-ADM-08 | Invitation d'un nouveau compte | e-mail envoyé sans mot de passe dans l'interface, audit présent |
| U-ADM-09 | Réinitialisation administrée | e-mail envoyé au titulaire ; aucun lien ni secret dans la réponse ou les logs |
| U-ADM-10 | Suspendre un membre | connexion/API refusées, sessions révoquées, statut et audit visibles |
| U-ADM-11 | Admin suspend un admin | refus ; seul super-admin AAL2 peut le faire |
| U-ADM-12 | Tenter d'agir sur un super-admin | refus ; procédure de gouvernance hors application |
| U-ME-01 | Utilisateur change son nom | affichage mis à jour sans modifier les rôles |
| U-ME-02 | Utilisateur demande un changement de mot de passe | parcours Auth existant, sessions invalidées après succès |
| U-ME-03 | Utilisateur demande un changement d'e-mail | e-mail de confirmation Supabase Auth, aucune modification immédiate non confirmée |
| U-ADM-13 | Dashboard > Utilisateurs | absence de section historique ; lien unique vers `/admin/users` ; aucun formulaire de mot de passe tiers |

## 10. Conditions de conception validées

Cette conception est prête pour le codage lorsque les décisions suivantes sont confirmées :

1. priorité immédiate au lot P4.2.2-A afin de débloquer la recette éditoriale et de modération ;
2. les comptes administratifs sont créés par invitation, sans mot de passe choisi par un administrateur ;
3. les permissions sont dérivées des rôles et restent non éditables individuellement ;
4. la suspension utilise Supabase Auth côté Edge Function et révoque les sessions ;
5. chaque action administrative porte un motif et un audit ;
6. la suppression reste exceptionnelle, la suspension étant le choix opérationnel par défaut.

---

## Références de conception

- Supabase Auth admin updateUserById : gestion serveur d'un compte et de la suspension ;
- Supabase Auth invitation : invitation depuis un environnement serveur de confiance ;
- Supabase Auth password reset : lien envoyé au titulaire et URL de retour autorisée ;
- `PHASE4_P4.2_IMPLEMENTATION.md` : modèle RBAC et exigences MFA ECODIS.
