# Procès-verbal — Lot C staging

Date : 23 août 2026  
Projet Supabase : `jyidyhypblkxojbsibky`  
Région : `us-east-1`  
Environnement : staging

## Périmètre

Déploiement des migrations Phase 4, redéploiement de l’Edge Function `server`, vérification HTTP et recette staging automatisée.

Le dépôt était volontairement non propre au moment du déploiement : les changements Phase 0 à Phase 4 étaient présents localement mais non commités. Référence de base observée : `ed5ab0e3428172c7766e2acadc271add3d8cdc89`.

## Résultats Supabase

### Migrations appliquées

Les migrations Phase 4 suivantes sont présentes dans l’historique distant :

- `20260823045427` — `phase4_editorial_foundation`
- `20260823045433` — `phase4_roles_permissions`
- `20260823045439` — `phase4_comment_moderation`
- `20260823045444` — `phase4_advanced_progress`
- `20260823045518` — `phase4_offline_experience`
- `20260823050306` — `phase4_series_ownership`

La migration corrective `phase4_series_ownership` ajoute `public.series.user_id` et son index, nécessaires au contrôle de propriété utilisé par l’API éditoriale.

### Edge Function

- Fonction : `server`
- Version : `7`
- Statut : `ACTIVE`
- Vérification JWT : activée
- Empreinte de déploiement : `cf85b792ab1c7edf5fe8d5c60b2139e368ab88c6a5cd3e252ae2de9c27746d7e`

### Health check

```text
GET https://jyidyhypblkxojbsibky.supabase.co/functions/v1/server/api/health
HTTP 200
{"status":"ok"}
```

## Recette HTTP staging

Exécution réussie :

```text
RECETTE-20260823052503-b405eded
exit code 0
Nettoyage de recette terminé
```

Contrôles validés :

- santé API ;
- création des comptes et rôles ;
- contrôle des permissions ;
- brouillon non accessible publiquement ;
- workflow éditorial contenu et série ;
- création contenu et série administrateur ;
- favori, commentaire et progression ;
- refus d’écriture administrateur non autorisée ;
- audit de création ;
- refus d’upload extension/MIME incohérent ;
- URL média signée à durée courte ;
- collecte d’erreur frontend avec corrélation ;
- rate limiting HTTP 429.

Contrôle post-nettoyage : aucun contenu ni aucune série préfixé `RECETTE-*` ne reste dans staging.

## Corrections réalisées pendant le lot

- Ajout de la migration corrective `phase4_series_ownership` après identification d’un HTTP 500 lors de la création d’une série.
- Renforcement du nettoyage de `recette-staging.mjs` avec reprise sur HTTP 409 et repli REST strictement limité aux identifiants de recette.
- Correction des commandes backend Deno de la CI pour utiliser `supabase/functions/server/deno.json`.

## Avis Supabase

Les advisors distants restent non bloquants pour ce lot : recommandations sur certaines politiques RLS, index de clés étrangères et protection contre les mots de passe compromis. Elles doivent faire l’objet d’un chantier séparé, sans correction improvisée pendant la recette.

## Décision

**Lot C backend Supabase : GO.**  
**Lot C complet : GO avec réserve**, car aucune cible d’hébergement frontend staging n’est déclarée dans le dépôt. L’artefact frontend peut être publié dès que la cible (Vercel, Netlify, GitHub Pages ou autre) et ses secrets CI sont fournis.
