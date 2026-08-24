# ECODIS App — Recette globale P4.2.2 : profils, comptes et habilitations

**Périmètre :** P4.2.2-A à P4.2.2-D  
**Environnement :** Supabase staging et frontend de recette uniquement  
**Conception de référence :** `PHASE4_P4.2.2_GESTION_PROFILS_SPECIFICATIONS.md`

## 1. Objectif et décision

Cette recette valide le parcours unique de gestion des comptes : `/admin/users` pour l'administration d'un tiers et `/profil` pour le titulaire du compte. Elle couvre les rôles cumulables, l'invitation sans mot de passe administrateur, la récupération de mot de passe, la suspension/réactivation avec révocation de sessions et le profil personnel.

Décision **No-Go** immédiate si une élévation de privilège est possible sans autorisation, si une suspension n'invalide pas une session, ou si un mot de passe, un lien, un jeton ou un secret MFA est exposé.

## 2. Préconditions

1. Le commit à tester est identifié et déployé sur le frontend de recette ; consigner SHA, URL et heure.
2. Les migrations P4.2.2-A à C sont appliquées sur staging et l'Edge Function `server` est redéployée avec le même commit.
3. `APP_REQUIRE_ADMIN_MFA=true`, `APP_BOOTSTRAP_ADMIN_EMAILS` et `APP_BOOTSTRAP_SUPER_ADMIN_EMAILS` sont présents uniquement dans les secrets de l'Edge Function.
4. Les Redirect URLs Supabase Auth contiennent les URLs staging pour `/reset-password` et `/profil`.
5. Préparer des comptes et boîtes e-mail de recette non personnels : super-admin AAL2, admin AAL2, membre cible, éditeur, modérateur et invité non confirmé.
6. Préfixer les comptes et motifs par `RECETTE-P422-AAAAMMJJ-HHMM`.
7. Ne jamais capturer ni consigner mot de passe, jeton, QR code, code TOTP, URL signée, lien d'invitation ou de récupération.

## 3. Contrôles techniques obligatoires

Dans PowerShell :

```powershell
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Dans WSL :

```bash
bash scripts/test-backend-wsl.sh
supabase db reset --local
supabase db lint --local
supabase stop --no-backup
```

Après validation locale, appliquer la procédure de déploiement staging de `RECETTE_PHASE4_EXECUTION.md`, puis contrôler :

```text
GET https://<projet-staging>.supabase.co/functions/v1/server/api/health
```

Résultat attendu : HTTP 200. Aucune écriture de recette ne vise production.

## 4. P4.2.2-A — rôles cumulables et parcours unique

| Cas | Action | Résultat attendu |
|---|---|---|
| A-01 | Super-admin AAL2 ouvre `/admin/users` et sélectionne le membre cible. | Rôles, permissions effectives, statut et actions autorisées visibles. |
| A-02 | Ajouter `content_editor` avec un motif de 10 à 500 caractères. | `Membre` + `Éditeur` ; audit `role_assignments_update`. |
| A-03 | Ajouter `moderator`. | Trois rôles cumulés ; permissions éditoriales et de modération visibles en lecture seule. |
| A-04 | Reconnexion avec le compte cible. | Droits effectifs conformes aux rôles attribués. |
| A-05 | Admin AAL2 tente d'ajouter ou retirer `admin`. | Refus 403 ou action indisponible ; aucun changement. |
| A-06 | Super-admin AAL1 tente d'ajouter `admin`, puis recommence après challenge AAL2. | Refus MFA, puis réussite AAL2 et audit. |
| A-07 | Acteur tente de modifier ses propres rôles ou un `super_admin`. | Refus ; aucune modification. |
| A-08 | Ouvrir le dashboard d'administration. | Aucune section historique Utilisateurs ; l'action ouvre `/admin/users`. |
| A-09 | Inspecter Network pendant A-02/A-03. | Appel à `PUT /users/:id/roles`, jamais à `PUT /users/:id/role`. |

## 5. P4.2.2-B — invitation et récupération sans secret tiers

| Cas | Action | Résultat attendu |
|---|---|---|
| B-01 | Inviter un compte avec nom et e-mail depuis `/admin/users`. | Aucun champ mot de passe ; réponse neutre ; e-mail reçu ; audit `user_invitation_sent`. |
| B-02 | Renvoyer l'invitation avant confirmation. | Sans expéditeur Resend configuré : HTTP 503 explicite et audit `user_invitation_delivery_failed`. Avec Resend actif : nouvelle invitation sans doublon et audit `user_invitation_resent`. |
| B-03 | Invité définit son mot de passe via le lien. | Compte confirmé et connexion possible ; secret jamais affiché ou journalisé. |
| B-04 | Admin demande la réinitialisation du titulaire. | Réponse neutre ; lien reçu seulement par le titulaire ; audit `password_reset_requested`. |
| B-05 | Membre connecté demande son propre lien depuis `/profil`. | Même réponse neutre ; parcours vers `/reset-password` ; sessions invalidées après succès. |

> Le correctif détaillé de B-02 est documenté dans `P4.2.2_B02_RENVOI_INVITATION_SPECIFICATIONS.md`. Tant que Resend n'est pas configuré avec un expéditeur vérifié, le résultat attendu de B-02 est HTTP 503 contrôlé : ne pas multiplier les tentatives.

## 6. P4.2.2-C — suspension, réactivation et sessions

| Cas | Action | Résultat attendu |
|---|---|---|
| C-01 | Admin AAL2 suspend un membre avec motif valide. | Statut/motif visibles pour l'admin ; audit `user_suspended`. |
| C-02 | Laisser la session du membre ouverte, attendre 30 s au plus ou ramener l'onglet au premier plan. | Session locale nettoyée ; pages protégées mises à jour sans reconnexion. |
| C-03 | Connexion après suspension. | Refus Supabase Auth ; aucune session active. |
| C-04 | Appel API protégé depuis une ancienne session. | HTTP 401 ; aucune donnée/action protégée accessible. |
| C-05 | Admin tente de suspendre un admin, de s'auto-suspendre ou d'agir sur un super-admin. | Refus ; aucun changement. |
| C-06 | Super-admin AAL2 réactive avec motif. | Statut actif ; audit `user_reactivated`. |
| C-07 | Le titulaire se reconnecte. | Nouvelle connexion nécessaire et autorisée. |

## 7. P4.2.2-D — profil personnel et retrait de l'UI historique

| Cas | Action | Résultat attendu |
|---|---|---|
| D-01 | Membre ouvre `/profil`. | Nom, e-mail, dates, rôles et permissions effectives affichés. |
| D-02 | Modifier le nom puis recharger. | Nom persistant ; rôles inchangés ; audit `profile_updated` limité à `name`. |
| D-03 | Saisir une nouvelle adresse e-mail. | Message de confirmation ; aucune modification immédiate sans clic reçu par e-mail. |
| D-04 | Ouvrir le lien de confirmation. | Retour vers `/profil` et e-mail confirmé par Supabase Auth. |
| D-05 | Admin ouvre `/admin/dashboard`. | Ancienne liste, boutons historiques et formulaire de mot de passe tiers absents. |
| D-06 | Vérifier `/admin/users`. | Invitation et gestion des rôles/statuts accessibles seulement depuis cet écran. |

## 8. Preuves et contrôles de sécurité

Reporter pour chaque cas `Réussi`, `Échoué`, `Bloqué` ou `Non applicable` dans `RECETTE_PHASE4_PREUVES.csv`, avec date, recetteur et preuve anonymisée.

Événements à vérifier dans l'audit :

```text
role_assignments_update
user_invitation_sent
user_invitation_resent
password_reset_requested
user_suspended
user_reactivated
profile_updated
```

Les métadonnées ne doivent jamais contenir de mot de passe, lien, jeton, code ou secret MFA. Les permissions restent dérivées des rôles et ne sont jamais modifiées individuellement.

## 9. Sortie et nettoyage

La recette est **Go** si les cas A à D et les contrôles automatisés sont verts. Elle est **No-Go** si un contrôle d'autorisation, MFA, session suspendue ou secret échoue.

Après décision, retirer les rôles temporaires, supprimer/archiver seulement les données préfixées `RECETTE-P422-*`, puis conserver les audits selon la politique de rétention.
