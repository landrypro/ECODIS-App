# ECODIS app development

## Installation

1. Copier `.env.example` vers votre fichier d'environnement front et renseigner les valeurs Supabase.
2. Configurer les variables d'environnement de la Supabase Edge Function avec les memes informations cote serveur.
3. Installer les dependances avec `npm i`.

## Scripts utiles

- `npm run dev` : demarrage local
- `npm run build` : build production
- `npm run typecheck` : verification TypeScript
- `npm run lint` : verification ESLint
- `npm run check` : controle global

## Notes de stabilisation Phase 1

- Les valeurs Supabase du frontend ne sont plus codees en dur.
- Le seed automatique du Home a ete supprime.
- Le signup backend utilise maintenant `auth.signUp()` au lieu de `auth.admin.createUser()`.
- Le CORS doit etre configure explicitement via `APP_ALLOWED_ORIGINS`.
