# ECODIS App — P4.1 : fondation éditoriale

**Statut :** implémentée localement — validation Deno, migration locale et recette staging à effectuer avant déploiement.

## Portée livrée

- cycle éditorial commun aux messages et aux séries : `draft`, `in_review`, `scheduled`, `published`, `archived` ;
- création systématique d'un brouillon ;
- transitions contrôlées côté API et tracées dans `audit_logs` ;
- visibilité publique limitée aux contenus et séries publiés ;
- prévisualisation des brouillons réservée à un administrateur authentifié ;
- commentaires, favoris, progression et URLs de médias limités aux contenus publiés ;
- suppression physique limitée aux brouillons sans interaction, sans progression et sans lien à une série ;
- listes d'administration distinctes des listes publiques ;
- badges et actions de transition dans l'écran d'administration ;
- jeux de démonstration créés directement avec le statut `published`.

## Migration

La migration `supabase/migrations/20260821180919_phase4_editorial_foundation.sql` :

1. crée le type PostgreSQL `public.editorial_status` ;
2. ajoute les métadonnées éditoriales aux tables `messages` et `series` ;
3. marque le contenu historique comme publié, sans modifier sa date de création ;
4. impose une date future pour un élément planifié ;
5. ajoute les index de consultation des contenus publiés.

## Limite volontaire de P4.1

Le statut `scheduled` enregistre la date de publication et maintient le contenu non public. La publication à l'heure prévue n'est pas encore automatisée : l'administrateur doit déclencher la transition vers `published`.

L'automatisation nécessite un lot d'exploitation distinct (tâche planifiée Supabase/cron, supervision et reprise sur erreur). Elle ne doit pas être supposée active lors de la recette P4.1.

## Vérifications à exécuter

Dans WSL, à la racine du projet :

```bash
deno check supabase/functions/server/index.ts
deno test --allow-env --allow-net supabase/functions/server
supabase start
supabase db reset --local
supabase db lint --local
supabase functions serve server --no-verify-jwt
```

Dans un autre terminal :

```bash
npm run test:unit
npm run test:e2e
```

Après validation locale :

```bash
supabase db push
supabase functions deploy server --use-api --project-ref jyidyhypblkxojbsibky
npm run recette:staging -- --confirm-staging-write
```

## Scénarios de recette P4.1

1. Créer un message : il apparaît comme `draft` dans l'administration et est absent de la liste publique.
2. Appeler son URL directe sans jeton administrateur : l'API renvoie un refus ; avec le jeton administrateur, la prévisualisation est disponible.
3. Passer le message par `in_review`, puis `published` : il apparaît alors dans la liste publique et accepte favoris/commentaires.
4. Archiver le message : il disparaît à nouveau des parcours publics, sans supprimer les interactions existantes.
5. Vérifier dans `audit_logs` les actions `create_message`, `transition_message`, `create_series` et `transition_series`.
6. Créer un brouillon lié à une série ou à une interaction : la suppression doit être refusée ; l'archivage reste possible.
7. Créer une série avec un module brouillon, publier la série : le visiteur ne voit que les modules publiés.

