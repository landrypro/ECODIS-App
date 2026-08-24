# ECODIS App — Phase 2 : Qualite et CI

## Objectif

Empêcher les regressions avant fusion ou déploiement, sans utiliser les secrets ni les données du staging.

## Controles ajoutes

| Domaine | Commande | Garantie |
|---|---|---|
| Frontend statique | `npm run check` | TypeScript et ESLint |
| Tests unitaires | `npm run test:unit` | Couche HTTP et comportements de services |
| Tests d'integration frontend | `npm run test:integration` | Assemblage service/messages avec contrats HTTP |
| Backend Deno | `npm run test:backend` | Format, types et tests des validateurs/routes |
| End-to-end | `npm run test:e2e` | Navigation accueil, connexion et inscription dans Chromium |
| Migration | `npm run db:test:migrations` | Rejeu de la migration sur une stack Supabase locale deja demarree |
| Build | `npm run build` | Production d'un artefact Vite |

## CI GitHub Actions

Le workflow `.github/workflows/quality.yml` contient quatre jobs independants :

1. frontend : installation deterministe, controles, tests et artefact `dist` ;
2. backend : verification Deno de l'Edge Function ;
3. end-to-end : tests Chromium avec un backend simule ;
4. migrations : demarrage d'une stack Supabase locale, `db reset` et `db lint`.

La CI n'utilise aucun secret Supabase de staging. L'artefact frontend est conserve 14 jours pour chaque execution.
curl -fsSL https://deno.land/install.sh | sh source ~/.bashrc
## Execution locale

```powershell
npm ci
npm run check
npm run test
npm run build
```

Pour les controles Deno et migrations, installer Deno et demarrer Docker :

```powershell
npm run test:backend
supabase start
npm run db:test:migrations
supabase stop --no-backup
```

Si le script d'installation retourne `HTTP 429`, utiliser le paquet Linux publie dans les releases officielles de la CLI, puis l'installer avec `dpkg`.

### Cas WSL avec npm Windows

Si `npm run test:backend` affiche une erreur Windows indiquant que `deno` est introuvable, `npm` pointe vers l'installation Node Windows alors que Deno est installe dans WSL. Executer directement les commandes Linux :

```bash
deno check supabase/functions/server/index.ts
deno test --allow-env --allow-net supabase/functions/server
```

Pour les migrations, ne pas utiliser `npx supabase` si `npx` pointe aussi vers Windows. Installer la CLI Supabase native dans WSL, puis utiliser `supabase` directement :

```bash
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install | bash
source ~/.bashrc
supabase --version
supabase start
supabase db reset --local
supabase db lint --local
supabase stop --no-backup
```

Pour les tests navigateur :

```powershell
npm run test:e2e:install
npm run test:e2e
```

## Limites assumees

Les tests end-to-end interceptent les appels API : ils verifient les parcours de navigation sans toucher le staging. Les flux complets Auth, Storage et RLS restent verifies par la recette staging documentee dans `RECETTE_PHASE0_PHASE1.md`.

## Etat de validation du 17 aout 2026

- `npm run check` : valide, avec 32 avertissements ESLint deja connus et aucune erreur ;
- `npm run test` : valide, 5 tests frontend passes ;
- `npm run build` : valide ;
- `deno check supabase/functions/server/index.ts` : valide ;
- `deno test --allow-env --allow-net supabase/functions/server` : valide, 4 tests passes ;
- `supabase db reset --local` : valide, migration `202603210001_phase3_relational.sql` appliquee sur une base locale recreee ;
- `supabase db lint --local` : valide, aucune erreur de schema ;
- `npm run test:e2e` : valide dans WSL, 3 scenarios Playwright passes sur Chromium (accueil, connexion et inscription) ;
- Docker est disponible dans WSL et la rehearsal de migration y est validee.
