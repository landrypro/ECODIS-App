# Phase 4.3 — Modération communautaire

> Statut réévalué le 16 octobre 2026 : ce document décrit l'implémentation initiale, pas une conformité complète. Le lot **P4.3-MC** corrige les écarts constatés ; voir [les spécifications de mise en conformité](P4.3_MISE_EN_CONFORMITE_SPECIFICATIONS.md). MC-A à MC-F sont clôturés localement dans le candidat Git dédié ; la recette MC-G reste à réaliser.

Avancement P4.3-MC : MC-A clôturé ; MC-B (confidentialité) réalisé et contrôlé localement, sans déploiement ; MC-C (intégrité transactionnelle) clôturé localement après le replay intégral des migrations et les contrôles SQL/concurrence ; MC-D (raccordement API) clôturé localement après les tests backend Deno (23/23) et le contrôle HTTP/RPC sur Supabase local ; MC-E (interface) clôturé localement après les tests d'intégration front (7/7) et backend Deno (23/23). Le verrou complet MC-F est vert le 16 octobre 2026 ; voir [son compte rendu](P4.3_MC_F_STABILISATION.md). Le commit dédié qui contient ce document est le candidat ; son SHA est la référence à relever avec `git rev-parse HEAD`. MC-G reste à réaliser.

## Périmètre réalisé

- Ajout d'un état aux commentaires : `visible`, `hidden`, `deleted_by_author`, `deleted_by_moderation`.
- Suppression logique : le commentaire et sa trace restent disponibles pour l'audit ; seuls les commentaires `visible` sont publics.
- Signalement par un membre d'un commentaire tiers, une seule fois par commentaire.
- File de modération réservée aux rôles `moderator`, `admin` et `super_admin`.
- Décisions de modération : masquer, restaurer et supprimer avec motif obligatoire pour masquer ou supprimer.
- Traitement d'un signalement : résolution automatique lors d'une décision sur le commentaire, ou classement explicite.
- Journalisation d'audit pour suppression par auteur, signalement et décisions de modération.
- Interface dédiée accessible depuis le profil d'un modérateur, avec recherche, filtres et pagination, contexte interne, historique protégé et actions restaurer, masquer, supprimer ou écarter. Les annulations ne déclenchent aucune mutation et les conflits de version rechargent la file sans rejouer la décision.

## Modèle de données

La migration `20260821212924_phase4_comment_moderation.sql` ajoute les métadonnées de décision à `comments` et crée `comment_reports`.

La table des signalements est protégée par RLS et aucun privilège n'est accordé aux rôles `anon` ou `authenticated`. Les opérations transitent exclusivement par l'Edge Function, qui valide l'identité, l'autorisation et les données.

## API ajoutée

| Méthode | Route | Accès |
|---|---|---|
| `POST` | `/comments/:commentId/reports` | membre authentifié, hors auteur |
| `GET` | `/moderation/reports?status=open` | permission `comments_moderate` |
| `PUT` | `/moderation/comments/:commentId` | permission `comments_moderate` |
| `PUT` | `/moderation/reports/:reportId` | permission `comments_moderate` |

Les listes publiques, compteurs et commentaires d'un contenu ne retournent que les entrées `visible`.

## Déploiement et recette

Ne pas déployer isolément : appliquer avec les migrations P4.1 et P4.2, puis suivre la section P4.3 de [RECETTE_FINALE_PHASE4.md](RECETTE_FINALE_PHASE4.md).

## Vérifications effectuées dans cet environnement

- `npm run typecheck` : réussi après MC-E.
- `npm run lint` : réussi, sans erreur ; les avertissements existants hors périmètre MC-E sont conservés.
- `npm run test:integration -- --reporter=verbose` : **7 tests réussis dans 2 fichiers**, le 16 octobre 2026.
- `wsl -d Ubuntu-24.04 -- bash scripts/test-backend-wsl.sh` : **23 tests réussis, 0 échec**, le 16 octobre 2026.
- `git diff --check` : aucune erreur d'espacement ; avertissements CRLF préexistants uniquement.

Ces preuves clôturent MC-E localement. Le verrou complet MC-F a ensuite réussi ; voir `P4.3_MC_F_STABILISATION.md`. Elles ne constituent ni un déploiement ni une recette staging ; la recette relève toujours de MC-G.
