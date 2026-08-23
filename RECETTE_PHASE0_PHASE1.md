# ECODIS App — Recette des Phases 0 et 1

**Statut :** prêt à exécuter  
**Date :** 16 août 2026  
**Portée :** validation fonctionnelle du MVP cadré et assainissement technique du dépôt.

---

## 1. Règles de recette

- Exécuter les tests d’écriture uniquement sur une base **staging/recette** autorisée.
- Utiliser un préfixe unique pour toutes les données de test : `RECETTE-<horodatage>`.
- Ne jamais modifier ni supprimer une donnée dont le préfixe ne correspond pas à la campagne de recette.
- Nettoyer les données créées à la fin de chaque campagne et consigner les éventuelles exceptions.
- Ne jamais journaliser dans un rapport une clé Supabase, un mot de passe, un jeton de session ou la valeur d’un fichier `.env`.

## 2. Préconditions

- La migration `supabase/migrations/202603210001_phase3_relational.sql` est appliquée dans la base cible.
- Les variables Supabase de l’Edge Function sont configurées : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_API_PREFIX`, `APP_STORAGE_BUCKET_NAME`, `APP_ALLOWED_ORIGINS`.
- Les variables Vite pointent vers la même cible : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_FUNCTIONS_BASE_URL`.
- Un compte administrateur de recette est disponible pour les scénarios d’administration.
- Les contenus et séries de recette sont isolés des contenus réels avec le préfixe défini ci-dessus.

## 3. Recette Phase 0 — parcours fonctionnels

| ID | Parcours | Scénario | Résultat attendu |
|---|---|---|---|
| F0-01 | Découverte | Ouvrir accueil, filtrer audio/vidéo/texte, ouvrir un détail | Les contenus publiés sont lisibles ; les filtres et le détail sont cohérents |
| F0-02 | Inscription | Créer un compte de recette puis se connecter | Le compte Auth et son rôle `user` sont créés ; le profil est disponible |
| F0-03 | Engagement | Ajouter un favori puis publier et supprimer un commentaire | Le favori est unique ; le commentaire est associé à son auteur ; sa suppression est limitée à l’auteur ou un admin |
| F0-04 | Apprentissage | Ouvrir une série, terminer un module et recharger la page | La complétion et la date de dernier accès sont conservées ; le module suivant est identifiable |
| F0-05 | Hors ligne | Télécharger un contenu explicitement autorisé puis le supprimer localement | L’état du téléchargement est clair ; le retrait local ne supprime pas le contenu serveur |
| F0-06 | Administration | Créer un contenu brouillon, le publier, l’ajouter à une série puis l’archiver | Les droits admin sont respectés et chaque action sensible est auditée |

### Points de cadrage à vérifier pendant la recette

- contenu publié consultable sans compte ;
- interaction réservée à un utilisateur connecté ;
- modèle MVP de rôles : `user` et `admin` ;
- cycle cible : `brouillon → publié → archivé` ;
- progression : audio/vidéo à 90 % ou marquage manuel, texte par marquage manuel ;
- l’ordre des séries est recommandé, non bloquant dans le MVP.

> Le cycle éditorial et la progression à 90 % sont des décisions de Phase 0. Ils ne seront testables de bout en bout qu’après leur implémentation fonctionnelle dans une phase ultérieure. Les tests actuels valident le comportement déjà présent : progression manuelle par module de série.

## 4. Recette Phase 1 — assainissement technique

| ID | Vérification | Commande ou contrôle | Attendu |
|---|---|---|---|
| F1-01 | Version runtime | `node --version` | `v22.18.x` |
| F1-02 | Installation propre | `npm ci` | Succès sans modification du lockfile |
| F1-03 | Typecheck et lint | `npm run check` | 0 erreur bloquante |
| F1-04 | Build | `npm run build` | Artefact généré dans `dist/` |
| F1-05 | Dépendances | `git ls-files node_modules` | Aucun fichier retourné |
| F1-06 | Build versionné | `git ls-files dist` | Aucun fichier retourné |
| F1-07 | Secrets versionnés | `git ls-files -- .env .env.*` | Seul `.env.example` est autorisé |
| F1-08 | Documentation | `.nvmrc`, `README.md`, `PHASE1_STABILISATION.md` | Versions et procédure `npm ci` documentées |

### Résultat déjà obtenu

- `npm ci` : succès, 410 paquets installés ;
- `npm run check` : succès, 0 erreur bloquante et 32 avertissements ESLint connus ;
- `npm run build` : succès ;
- `node_modules` et `dist` ne sont plus suivis ;
- `.env.example` reste le seul modèle d’environnement versionné.

## 5. Tests d’écriture de base de données

### Données de campagne

Avant tout test, générer un identifiant, par exemple :

```text
RECETTE-20260816-150000
```

Utiliser cet identifiant dans :

- nom utilisateur : `Recette RECETTE-...` ;
- email : `recette-...@example.invalid` ;
- titre de contenu : `RECETTE-... contenu audio` ;
- titre de série : `RECETTE-... série` ;
- texte de commentaire : `RECETTE-... commentaire`.

### Séquence minimale d’écriture

| ID | Écriture | Tables / services attendus | Contrôle |
|---|---|---|---|
| DB-01 | Inscription d’un utilisateur de recette | `auth.users`, `users_roles` | Le rôle initial est `user` |
| DB-02 | Création d’un favori | `favorites` | Un doublon est refusé ou reste unique |
| DB-03 | Création d’un commentaire | `comments` | L’auteur et le contenu sont corrects |
| DB-04 | Marquage d’un module terminé | `series_progress` | `completed_at` et `last_accessed_at` sont renseignés |
| DB-05 | Création admin d’un contenu de recette | `messages`, Storage, `audit_logs` | Média et audit cohérents |
| DB-06 | Création admin d’une série de recette | `series`, `series_messages` | Ordre de module unique et `total_modules` cohérent |

### Contrôles de sécurité associés

- tenter un favori sans jeton : réponse `401` ;
- tenter un commentaire avec une identité différente du jeton : refusé par RLS/API ;
- tenter une écriture de contenu avec un utilisateur standard : réponse `401` ou `403` ;
- tenter de marquer terminé un contenu absent de la série : refus ;
- tenter la suppression du commentaire d’un autre utilisateur : refus ;
- vérifier qu’un administrateur peut modérer et que l’action est journalisée.

### Nettoyage obligatoire

Dans l’ordre :

1. supprimer commentaire, favori et progression de recette ;
2. supprimer la série de recette ;
3. supprimer le contenu et son média de recette ;
4. supprimer le compte de recette via un administrateur autorisé ;
5. contrôler l’absence de ligne restante portant le préfixe de campagne ;
6. conserver uniquement le rapport de recette, sans donnée sensible.

## 6. Rapport de campagne

Pour chaque exécution, consigner :

- environnement ciblé ;
- identifiant de campagne ;
- version/commit testé ;
- date et exécutant ;
- résultats des cas F0, F1 et DB ;
- captures d’erreur sans secrets ;
- liste des données nettoyées ;
- anomalies, criticité et décision de correction.

### Exécution du 16 août 2026

| Domaine | Statut | Constat |
|---|---|---|
| F0 — cadrage fonctionnel | Validé sur documentation | La vision, les utilisateurs, rôles, parcours, cycle de contenu, règles de progression, indicateurs et périmètre MVP sont consignés dans `PHASE0_CADRAGE_FONCTIONNEL.md`. Les parcours UI restent à exécuter manuellement dès que le staging est joignable. |
| F1-01 à F1-08 — assainissement | Validé | `npm ci`, `npm run check` et le build avaient été validés. Lors de cette recette, `npm run check` est à nouveau conforme : 0 erreur et 32 avertissements non bloquants. `node_modules`, `dist` et le fichier `.env` ne sont pas suivis par Git. |
| Protection d’écriture | Validé | `node recette-staging.mjs` refuse l’exécution sans l’option explicite `--confirm-staging-write`. |
| DB-01 à DB-06 — écritures staging | Bloqué | Aucune écriture n’a été créée. Le domaine du projet configuré retourne `NXDOMAIN` auprès du résolveur DNS public `1.1.1.1`, alors que le domaine racine `supabase.co` se résout normalement. La référence encodée dans la clé anonyme correspond bien à celle de l’URL : le projet staging est donc supprimé, suspendu sans domaine actif ou sa référence doit être remplacée. |

La dernière tentative du 17 août 2026 a échoué sur `Health check inaccessible (ENOTFOUND)`. Le health check étant exécuté avant `DB-01`, aucune écriture n’a été tentée.

Après réactivation du projet Supabase, une nouvelle tentative a retourné `Health check a échoué (HTTP 404)`. Un contrôle HTTP des chemins possibles retourne `{"code":"NOT_FOUND","message":"Requested function was not found"}` : la fonction Edge `server` n’est pas actuellement déployée sous ce nom. La recette reste donc bloquée avant toute écriture.

La fonction `server` a ensuite été déployée correctement. Le health check a alors retourné `HTTP 500` : les variables obligatoires `APP_API_PREFIX`, `APP_STORAGE_BUCKET_NAME` et `APP_ALLOWED_ORIGINS` n’étaient pas configurées dans les secrets Supabase. La recette reste bloquée avant `DB-01` tant que ces secrets ne sont pas ajoutés.

Après configuration de ces secrets, le health check passe. La création du compte admin échoue ensuite en `HTTP 401` car `SUPABASE_SERVICE_ROLE_KEY` local contient une clé `sb_publishable_...` au lieu d’une clé secrète/service-role. Aucune écriture métier n’a encore été réalisée.

La campagne du 17 août 2026 a finalement réussi : `DB-01` à `DB-06`, contrôle des rôles, refus d’écriture non autorisée et audit de création sont validés. Le nettoyage automatique de la campagne `RECETTE-20260817010337-c9beb630` est terminé.

#### Point de configuration à corriger avant reprise

La variable locale `VITE_SUPABASE_FUNCTIONS_BASE_URL` cible `localhost`, ce qui ne correspond pas à un déploiement staging. Le script accepte donc une surcharge ponctuelle contenant l'URL complète de l'API, préfixe métier inclus, sans modifier le fichier `.env` de développement :

```powershell
$env:RECETTE_API_BASE_URL = 'https://jyidyhypblkxojbsibky.supabase.co/functions/v1/server/api'
npm run recette:staging -- --confirm-staging-write
```

Avant cette relance, vérifier que l’URL désigne une fonction staging effectivement déployée et que le poste résout le domaine Supabase. Le script crée uniquement des données préfixées `RECETTE-*` et les supprime en fin d’exécution, même en cas d’échec.

## 7. Condition avant les écritures effectives

L’exécution des cas DB-01 à DB-06 requiert la confirmation explicite que les variables `.env` visent une base **de recette ou de staging**, et que la création puis la suppression de données préfixées `RECETTE-*` sont autorisées.
