# Phase 4.3 — Modération communautaire

## Périmètre réalisé

- Ajout d'un état aux commentaires : `visible`, `hidden`, `deleted_by_author`, `deleted_by_moderation`.
- Suppression logique : le commentaire et sa trace restent disponibles pour l'audit ; seuls les commentaires `visible` sont publics.
- Signalement par un membre d'un commentaire tiers, une seule fois par commentaire.
- File de modération réservée aux rôles `moderator`, `admin` et `super_admin`.
- Décisions de modération : masquer, restaurer et supprimer avec motif obligatoire pour masquer ou supprimer.
- Traitement d'un signalement : résolution automatique lors d'une décision sur le commentaire, ou classement explicite.
- Journalisation d'audit pour suppression par auteur, signalement et décisions de modération.
- Interface dédiée accessible depuis le profil d'un modérateur, avec actions masquer, supprimer et écarter.

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

- `npm run check` : réussi.
- `git diff --check` : aucune erreur d'espacement ; avertissements CRLF préexistants uniquement.
- Les tests Vitest et le build nécessitent une exécution hors sandbox Windows. Leur lancement a été refusé dans cette session.
- La distribution WSL est actuellement indisponible depuis cette session Codex ; les contrôles Deno/Supabase restent à exécuter dans votre terminal WSL avant déploiement.
