# ECODIS App — P4.2 : rôles et permissions

**Statut :** implémentée localement — recette consolidée prévue à la fin de la Phase 4.

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

## Fichiers principaux

- `supabase/migrations/20260821203728_phase4_roles_permissions.sql`
- `supabase/functions/server/src/domain/authorization.ts`
- `supabase/functions/server/src/lib/auth.ts`
- `supabase/functions/server/src/routes/auth.ts`

## Vérifications à inclure dans la recette finale Phase 4

1. Un membre n'accède pas aux routes de création ou d'édition de contenu.
2. Un éditeur crée un brouillon, le modifie et le soumet ; il ne peut pas le publier.
3. Un administrateur publie un brouillon et attribue `content_editor` ou `moderator`.
4. Un administrateur ne peut pas attribuer `admin`.
5. Un super-administrateur avec AAL1 ne peut pas attribuer `admin` ; avec AAL2, il le peut.
6. L'API refuse toute affectation `super_admin` et toute suppression d'un super-administrateur.
7. Chaque changement autorisé est présent dans le journal d'audit.
