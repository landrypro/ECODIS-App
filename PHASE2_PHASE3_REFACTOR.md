# ECODIS — Phase 2 & 3 Refactor

## Livré

### Phase 2 — Refactor architecture
- Backend Edge Function découpé en modules :
  - `supabase/functions/server/src/routes/auth.ts`
  - `messages.ts`
  - `comments.ts`
  - `favorites.ts`
  - `series.ts`
  - `admin.ts`
- Helpers backend factorisés :
  - `src/lib/auth.ts`
  - `app-config.ts`
  - `audit.ts`
  - `messages.ts`
  - `mappers.ts`
  - `validation.ts`
  - `supabase.ts`
- `src/app/components/api.ts` remplacé par un barrel export vers des services front spécialisés :
  - `src/app/services/auth-service.ts`
  - `messages-service.ts`
  - `comments-service.ts`
  - `favorites-service.ts`
  - `series-service.ts`
  - `users-service.ts`
  - `admin-service.ts`
- Gestion moderne des données avec TanStack Query :
  - `src/app/query-client.ts`
  - hooks dans `src/app/hooks/*`
- Lazy loading des pages via `src/app/routes.tsx`

### Phase 3 — Refonte data model
- Migration SQL ajoutée :
  - `supabase/migrations/202603210001_phase3_relational.sql`
- Passage du runtime backend du modèle KV vers des tables relationnelles Supabase :
  - `users_roles`
  - `messages`
  - `comments`
  - `favorites`
  - `series`
  - `series_messages`
  - `series_progress`
  - `audit_logs`
  - `app_config`
- Index ajoutés sur les accès critiques
- Vues SQL ajoutées pour faciliter les stats :
  - `message_engagement_stats`
  - `series_completion_stats`
- RLS ajoutée sur les tables clés

## Écrans déjà branchés sur TanStack Query
- Home
- Audio
- Vidéo
- Textes
- Liste des séries
- Détail série
- Commentaires

## Important avant test
Cette version nécessite **la migration SQL** avant de tester l'API refactorée.

### Option Supabase CLI
```bash
supabase db push
```

### Ou exécuter directement le SQL
- Ouvrir l’éditeur SQL Supabase
- Exécuter `supabase/migrations/202603210001_phase3_relational.sql`

## Ordre conseillé pour tester
1. appliquer la migration SQL
2. vérifier les variables d’environnement
3. lancer le front
4. lancer/servir la function Supabase
5. créer un compte
6. tester messages / commentaires / favoris / séries
7. tester l’admin
8. exécuter `/seed` avec un compte admin si tu veux des données de démonstration

## Point d’attention honnête
Je n’ai pas pu exécuter un build complet avec toutes les dépendances npm installées dans cet environnement. En revanche :
- la structure a été refactorée en profondeur
- une vérification TypeScript partielle a été lancée
- une erreur réelle sur les routes JSX a été corrigée (`routes.ts` -> `routes.tsx`)
- la migration SQL a été durcie pour être plus compatible avec PostgreSQL/Supabase

## Fichiers principaux à regarder
- `src/app/routes.tsx`
- `src/app/query-client.ts`
- `src/app/hooks/*`
- `src/app/services/*`
- `supabase/functions/server/index.tsx`
- `supabase/functions/server/src/routes/*`
- `supabase/migrations/202603210001_phase3_relational.sql`
