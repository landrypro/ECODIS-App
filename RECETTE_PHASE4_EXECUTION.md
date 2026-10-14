# ECODIS App — Plan d'exécution de la recette Phase 4

**Document canonique des cas :** `RECETTE_FINALE_PHASE4.md`  
**Périmètre :** P4.1 à P4.5, staging uniquement  
**Principe :** aucune recette partielle ne vaut acceptation de la Phase 4.

## 1. Ordre de passage

| Lot | Contrôle | Condition de passage |
|---|---|---|
| A | Gel du commit, sauvegarde staging, comptes et données `RECETTE-P4-*` | Commit et sauvegarde identifiés |
| B | Contrôles locaux frontend, Deno et migrations | Toutes les commandes vertes |
| C | Déploiement migrations puis Edge Function puis frontend staging | Santé HTTP 200 et version tracée |
| D | P4.1 workflow, P4.2 rôles/MFA, P4.2.2 profils/comptes, P4.3 modération | Aucun défaut de confidentialité/autorisation |
| E | P4.4 progression avancée | Idempotence et non-régression confirmées |
| F | P4.5 hors ligne et synchronisation | Cache sûr, révocation et reprise confirmés |
| G | Non-régression, sécurité, nettoyage et décision | PV signé Go/No-Go |

## 2. Commandes locales à consigner

Sur ce poste, `npm` dans WSL pointe vers l'installation Windows et ne voit pas le binaire Deno Linux. Ne pas lancer `npm run test:backend` depuis ce WSL. Séparer les deux terminaux.

Dans **PowerShell Windows** :

```powershell
npm ci
npm run check
npm run test:unit
npm run test:integration
npm run build
npm run test:e2e
```

Le lancement E2E reconstruit l'artefact, démarre `vite preview` sur le port strict 4173 et refuse de réutiliser un ancien serveur. Si le port est déjà occupé, identifier puis arrêter explicitement le processus avant de relancer ; ne pas contourner avec un autre serveur.

Dans **WSL**, depuis la racine du dépôt :

```bash
type -a deno supabase
bash scripts/test-backend-wsl.sh
supabase start
supabase db reset --local
supabase db lint --local
supabase stop --no-backup
```

### Diagnostic Storage local

Si `db reset` applique toutes les migrations mais termine par `supabase_storage_ecodis-app container is not ready: unhealthy`, ne pas valider P4.5 avec `--ignore-health-check`. Exécuter :

```bash
supabase status
docker inspect --format '{{json .State.Health}}' supabase_storage_ecodis-app
docker logs --tail 200 supabase_storage_ecodis-app
docker exec supabase_storage_ecodis-app wget --spider --tries=1 http://127.0.0.1:5000/status
```

Un statut Docker `healthy` et un health check interne réussi après stabilisation indiquent une course de démarrage du CLI. L'URL `/storage/v1/status` de la passerelle peut répondre 404 car le endpoint interne `/status` n'y est pas nécessairement exposé ; ce 404 n'est pas un échec Storage. Sinon, arrêter proprement la pile, mettre à jour le CLI par son canal d'installation, puis repartir sur des volumes locaux propres :

```bash
supabase stop --no-backup
supabase --version
supabase start --debug
supabase db reset --local
supabase db lint --local
```

La recette Storage reste bloquée tant que le conteneur n'est pas réellement sain.

Le test hors ligne doit utiliser l'artefact de production, pas le serveur Vite de développement :

```powershell
npm run build
npm run preview -- --host 0.0.0.0
```

## 3. Déploiement staging après validation locale

```bash
supabase link --project-ref jyidyhypblkxojbsibky
supabase db push --dry-run
supabase db push
supabase functions deploy server --use-api --project-ref jyidyhypblkxojbsibky
npm run recette:staging -- --confirm-staging-write
```

Déployer ensuite exactement l'artefact frontend produit par la CI. Reporter le SHA Git, l'identifiant de pipeline et l'heure du déploiement dans le PV.

## 4. Matrice des navigateurs et réseaux

Exécuter au minimum :

- Chromium desktop, réseau normal puis DevTools Offline ;
- Chromium mobile simulé, réseau Fast 3G puis Offline ;
- une deuxième session privée pour les conflits de progression ;
- deux comptes dans deux profils pour l'isolation locale.

Pour P4.5, conserver des captures des quatre panneaux DevTools : Service Workers, Manifest, IndexedDB et Cache Storage. Masquer les identifiants personnels et ne jamais capturer de jeton.

## 5. Fiche de preuve

Avant R-07 et R-08, exécuter les cas MFA-01 à MFA-10 de `RECETTE_MFA_ADMIN.md` (également repris dans `RECETTE_FINALE_PHASE4.md`). Exécuter aussi les cas A-01 à D-06 de `RECETTE_P4.2.2_GESTION_PROFILS.md` avant d'accepter le lot comptes. Le test MFA utilise deux facteurs TOTP distincts et ne doit jamais produire de capture contenant QR code, secret ou code à usage unique.

Copier cette ligne pour chaque cas E, R, MFA, M, P et O du document canonique :

| Cas | Statut | Date/heure | Profil | Navigateur | Preuve | Anomalie |
|---|---|---|---|---|---|---|
| XX-00 | À faire |  |  |  |  |  |

Une preuve acceptable est une capture anonymisée, une sortie de test, un statut HTTP avec corps non sensible, ou un résultat SQL limité aux identifiants de recette.

## 6. Nettoyage

1. Repasser `downloadsEnabled` et `maxOfflineStorageMb` aux valeurs approuvées.
2. Supprimer/archiver uniquement les données préfixées `RECETTE-P4-*` selon leurs dépendances.
3. Résoudre ou supprimer les rôles temporaires des comptes de recette.
4. Vider IndexedDB, Cache Storage et désinscrire le service worker dans les profils de recette.
5. Vérifier qu'aucune progression, aucun signalement ouvert et aucun audit de test ne pollue les tableaux fonctionnels ; conserver les audits requis par la politique de rétention.
6. Joindre le résultat du nettoyage au PV.

## 7. Décision

Le responsable fonctionnel, le responsable technique et le responsable sécurité prononcent ensemble :

- **Go** : tous les cas critiques et obligatoires réussis, aucune anomalie bloquante ;
- **Go avec réserves** : uniquement anomalies mineures documentées, sans effet sécurité/données ;
- **No-Go** : un critère de sortie de `RECETTE_FINALE_PHASE4.md` n'est pas satisfait.
