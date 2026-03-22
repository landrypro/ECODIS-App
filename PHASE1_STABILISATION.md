# Phase 1 — Stabilisation immédiate

Correctifs appliqués dans cette version :

1. Suppression de l'auto-seed au chargement de la page d'accueil.
2. Remplacement des paramètres Supabase front par des variables d'environnement.
3. Remplacement des imports `figma:asset` par des imports Vite standards depuis `src/assets`.
4. Ajout de `react` et `react-dom` dans `dependencies`.
5. Ajout de `tsconfig.json`, `eslint.config.js`, `src/vite-env.d.ts` et de scripts de qualité (`typecheck`, `lint`, `check`).
6. Restriction CORS via `APP_ALLOWED_ORIGINS`.
7. Ajout de validations backend sur le signup, les messages, favoris, commentaires, séries, config admin, catégories et annonces.
8. Sécurisation du signup : passage de `auth.admin.createUser()` à `auth.signUp()` via clé anonyme publique et suppression du bootstrap admin implicite pour le premier utilisateur.
9. Durcissement additionnel : l'endpoint `/seed` exige désormais un compte admin.
