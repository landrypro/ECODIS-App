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

## Assainissement technique — 16 août 2026

### Dépôt et fichiers générés

1. Ajout de `.gitignore` pour `node_modules`, `dist`, les fichiers `.env`, les caches Vite/npm, les logs et fichiers d'éditeur.
2. Retrait de l'index Git des 65 489 fichiers de `node_modules`, des artefacts `dist` et du fichier `.env`. Ces fichiers restent locaux et ne sont pas supprimés des postes de travail.
3. Le build est désormais généré par la commande `npm run build` et ne doit plus être versionné.

### Runtime et installation déterministe

1. Ajout de `.nvmrc` avec Node.js `22.18.0`.
2. Ajout des contraintes de runtime Node.js `22.18.x` et npm `11.12.x` dans `package.json`.
3. Mise à jour du README : l'installation standard est `npm ci`, et non `npm i`.
4. Le lockfile est valide : une installation propre via `npm ci` installe 410 paquets sans reconstruction de `package-lock.json`.

### Corrections de qualité nécessaires au build

1. Correction des imports Supabase frontend vers le module local `utils/supabase/info`.
2. Correction de l'import du point d'entrée React sans extension `.tsx`.
3. Typage de la réponse d'inscription afin de supprimer l'accès à des propriétés `unknown`.
4. Alignement du contrat de props de `SearchOverlay` avec son appel depuis la page d'accueil.
5. Correction de deux erreurs ESLint dans l'administration et l'utilitaire plateforme.
6. Remplacement de l'usage CommonJS de `__dirname` dans `vite.config.ts` par une résolution compatible ESM.

### Vérifications effectuées

- `npm ci --include=dev --no-audit --no-fund` : succès, 410 paquets installés.
- `npm run check` : succès, 0 erreur bloquante ; 32 avertissements ESLint restent à traiter ultérieurement.
- `npm run build` : succès ; le bundle JavaScript principal compressé fait environ 313 kB (1,17 MB non compressé).

### Point d’attention

Le dossier du projet est synchronisé par OneDrive. Il ne faut pas lancer plusieurs `npm ci` en parallèle, car Windows peut alors verrouiller des fichiers de `node_modules`. Une seule installation terminée avant le build évite ce problème.
