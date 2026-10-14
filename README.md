# ECODIS app development

## Prérequis

- Node.js `22.18.x` (voir `.nvmrc`) ;
- npm `11.12.x`.

## Installation

1. Copier `.env.example` vers votre fichier d'environnement front et renseigner les valeurs Supabase.
2. Configurer les variables d'environnement de la Supabase Edge Function avec les memes informations cote serveur.
3. Installer les dependances avec `npm ci`.

`node_modules`, `dist` et les fichiers `.env` sont locaux et ne doivent jamais etre versionnes. Le build est genere par `npm run build`.

## Scripts utiles

- `npm run dev` : demarrage local
- `npm run build` : build production
- `npm run typecheck` : verification TypeScript
- `npm run lint` : verification ESLint
- `npm run check` : controle global
- `npm run test` : tests frontend Vitest
- `npm run test:backend` : verification et tests Deno de l'Edge Function
- `npm run test:e2e` : parcours navigateur Playwright
- `npm run db:test:migrations` : rejeu de la migration sur Supabase local (Docker requis)

## Qualite et CI — Phase 2

La procedure de qualite, les tests et le workflow GitHub Actions sont documentes dans `PHASE2_QUALITE_CI.md`.

## Securite et exploitation — Phase 3

Les controles de production, les variables de securite, le MFA administrateur, la supervision staging, les sauvegardes et la retention sont documentes dans `PHASE3_SECURITE_EXPLOITATION.md`.

## Notes de stabilisation Phase 1

- Les valeurs Supabase du frontend ne sont plus codees en dur.
- Le seed automatique du Home a ete supprime.
- Le signup backend utilise maintenant `auth.signUp()` au lieu de `auth.admin.createUser()`.
- Le CORS doit etre configure explicitement via `APP_ALLOWED_ORIGINS`.
