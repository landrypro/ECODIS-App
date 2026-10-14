# Phase 4.4 — Progression avancée et reprise de lecture

## Périmètre réalisé

- progression détaillée par utilisateur, série et module ;
- migration rétrocompatible des anciennes complétions vers `completed` à 100 % ;
- position et durée audio/vidéo, dates client/serveur et origine de la mise à jour ;
- ouverture d'un module enregistrée comme `in_progress` ;
- sauvegarde automatique toutes les 15 secondes, à la pause, au masquage de page et à la sortie ;
- reprise de lecture depuis la position serveur ;
- complétion automatique à partir de 90 % et marquage manuel à 100 % ;
- progression des textes exclusivement sans position média ;
- calcul de série fondé uniquement sur les modules publiés ;
- prochain module recommandé selon l'ordre de la série ;
- compatibilité temporaire de l'ancien endpoint de complétion.

## Idempotence et conflits

Chaque écriture avancée porte un `eventId` UUID. La fonction PostgreSQL `apply_progress_event` réalise dans une transaction :

1. la déduplication dans `progress_events` ;
2. le verrouillage du triplet utilisateur/série/module ;
3. la fusion monotone de la progression ;
4. l'enregistrement du résultat retourné pour un rejeu identique.

Une complétion ne régresse jamais. La position, la durée et le pourcentage les plus avancés sont conservés. Un même UUID avec une autre charge utile est refusé.

Les événements techniques de déduplication sont purgés au-delà de 30 jours lors d'une nouvelle écriture du même utilisateur. La progression consolidée, elle, reste conservée sans dépendre de ce journal.

La fonction est `SECURITY INVOKER`. Son exécution et les tables de synchronisation sont refusées à `anon` et `authenticated`, puis accordées uniquement à `service_role`. La clé serveur reste confinée à l'Edge Function.

## API

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/series/:seriesId/progress` | utilisateur connecté, données propres |
| `PUT` | `/series/:seriesId/progress/:messageId` | utilisateur connecté, données propres |
| `POST` | `/series/:seriesId/progress` | compatibilité : complétion manuelle |
| `GET` | `/series-progress` | utilisateur connecté, données propres |

## Fichiers principaux

- `supabase/migrations/20260822044655_phase4_advanced_progress.sql`
- `supabase/functions/server/src/domain/progress.ts`
- `supabase/functions/server/src/routes/series.ts`
- `src/app/services/series-service.ts`
- `src/app/components/pages/detail-page.tsx`
- `src/app/components/pages/series-detail-page.tsx`
- `src/app/components/pages/series-list-page.tsx`

## Vérifications

- `npm run typecheck` : réussi ;
- `npm run lint` : réussi sans erreur, avertissements historiques conservés ;
- `git diff --check` : aucune erreur d'espacement, avertissements CRLF historiques uniquement.
- `npm run build` : non exécutable dans la sandbox Codex Windows (`vite.config.ts` inaccessible) ; à relancer dans le terminal utilisateur ou en CI.

La migration locale Supabase et les tests Deno, Vitest, E2E ainsi que la confirmation du build restent dans la recette technique finale afin de respecter la décision d'effectuer la recette complète après P4.5.

Les consignes et critères détaillés sont maintenus dans [RECETTE_FINALE_PHASE4.md](RECETTE_FINALE_PHASE4.md).
