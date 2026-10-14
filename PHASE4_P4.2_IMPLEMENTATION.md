# ECODIS App — P4.2 : rôles et permissions

**Statut :** implémentée localement, y compris le parcours MFA administrateur — recette consolidée prévue à la fin de la Phase 4.

## Modèle livré

Les rôles sont désormais cumulables dans `user_role_assignments` :

- `user` : rôle de base, toujours présent ;
- `content_editor` : crée et modifie ses propres brouillons, puis les soumet en revue ;
- `moderator` : rôle préparé pour la console P4.3 ;
- `admin` : publication, archivage, administration et attribution des rôles éditeur/modérateur ;
- `super_admin` : gouvernance, attribution du rôle `admin` et opérations critiques.

La table historique `users_roles` est conservée comme résumé compatible (`user` ou `admin`). L'API utilise exclusivement les affectations détaillées pour autoriser une action.

## Garde-fous

- une affectation `super_admin` est interdite par l'API et doit suivre la procédure de gouvernance ;
- un administrateur ne peut attribuer ni retirer `admin` ou `super_admin` ;
- une attribution `admin` exige une session MFA AAL2 ;
- les changements de rôles sont enregistrés dans `audit_logs` avec l'acteur, l'ancien ensemble, le nouvel ensemble et le motif ;
- l'éditeur ne peut lire, modifier ou supprimer que ses propres contenus non publiés ;
- l'administrateur et le super-administrateur conservent l'accès aux contenus de tous les auteurs.

## Préparation nécessaire avant le déploiement

Configurer le secret Edge Function suivant avec l'adresse du compte de gouvernance :

```text
APP_BOOTSTRAP_SUPER_ADMIN_EMAILS=adresse-admin-principale@exemple.org
```

Le titulaire doit se reconnecter après le déploiement afin que l'API crée son affectation `super_admin`. Cette variable ne doit jamais être ajoutée au frontend ou à Git.

## Parcours MFA administrateur

Le frontend fournit désormais une page **Sécurité MFA** accessible depuis Profil > Administration, à l'URL `/security/mfa` :

1. enrôlement TOTP avec QR code ;
2. saisie et vérification d'un code à six chiffres ;
3. challenge automatique à la connexion d'un administrateur possédant un facteur vérifié mais une session AAL1 ;
4. ajout d'un second facteur TOTP de secours ;
5. interdiction de supprimer le dernier facteur vérifié.

La page et la boîte de challenge ne remplacent pas la vérification de l'Edge Function. Le secret TOTP, les codes saisis et les QR codes ne sont jamais enregistrés dans les données ECODIS ni dans les journaux applicatifs.

Avant d'activer ou de conserver `APP_REQUIRE_ADMIN_MFA=true` en staging ou production, vérifier que le déploiement frontend contenant ce parcours est disponible et qu'au moins un compte de gouvernance dispose de deux facteurs fonctionnels. La perte des deux facteurs relève d'une procédure de récupération hors application, approuvée et auditée.

## Fichiers principaux

- `supabase/migrations/20260821203728_phase4_roles_permissions.sql`
- `supabase/functions/server/src/domain/authorization.ts`
- `supabase/functions/server/src/lib/auth.ts`
- `supabase/functions/server/src/routes/auth.ts`
- `src/app/domain/mfa.ts`
- `src/app/components/mfa-challenge-dialog.tsx`
- `src/app/components/pages/mfa-security-page.tsx`
- `RECETTE_MFA_ADMIN.md`

## Vérifications à inclure dans la recette finale Phase 4

1. Un membre n'accède pas aux routes de création ou d'édition de contenu.
2. Un éditeur crée un brouillon, le modifie et le soumet ; il ne peut pas le publier.
3. Un administrateur publie un brouillon et attribue `content_editor` ou `moderator`.
4. Un administrateur ne peut pas attribuer `admin`.
5. Un super-administrateur avec AAL1 ne peut pas attribuer `admin` ; avec AAL2, il le peut.
6. L'API refuse toute affectation `super_admin` et toute suppression d'un super-administrateur.
7. Chaque changement autorisé est présent dans le journal d'audit.
8. Le parcours MFA couvre l'enrôlement, le challenge de connexion, le second facteur et l'impossibilité de retirer le dernier facteur vérifié.

## Extension P4.2.2-A : gestion unifiée des rôles

Le point d'entrée `/admin/users` utilise maintenant la gestion moderne des rôles cumulables. Il affiche les permissions effectives, exige un motif de 10 à 500 caractères et n'appelle plus l'endpoint historique de rôle unique. L'API refuse également l'auto-modification de rôles. Le lot P4.2.2-B ajoute l'invitation, son renvoi et l'envoi d'un lien de réinitialisation sans mot de passe administrateur. Le lot P4.2.2-C ajoute la suspension, la réactivation et la révocation des refresh sessions. Le lot P4.2.2-D livre le profil personnel : le nom est modifié via l'API authentifiée et auditée, l'e-mail suit la confirmation native Supabase Auth, et le tableau de bord redirige l'administration des comptes vers `/admin/users`, sans formulaire historique de mot de passe tiers. Les exigences détaillées et les critères de recette sont consignées dans `PHASE4_P4.2.2_GESTION_PROFILS_SPECIFICATIONS.md`.

La correction P4.2.2-C du 24 août 2026 réserve l'exécution de `revoke_user_sessions` au rôle PostgreSQL `service_role` sans dépendre de l'ancienne variable `request.jwt.claim.role`. Le client réagit globalement aux réponses `401` et contrôle périodiquement l'accès du compte afin qu'une suspension mette aussi à jour une session déjà ouverte.
