# ECODIS App — Phase 0 : Cadrage fonctionnel

**Statut :** référence fonctionnelle initiale  
**Date :** 16 août 2026  
**Portée :** ce document cadre le produit. Il ne modifie aucune fonctionnalité applicative.

---

## 1. Objectif

S’assurer que le produit développé répond à un besoin clairement partagé avant toute évolution technique ou fonctionnelle significative.

Ce cadrage fixe :

- la vision produit ;
- les utilisateurs ;
- les rôles ;
- les cinq parcours prioritaires ;
- le statut des contenus ;
- les règles de progression ;
- les indicateurs de succès ;
- le périmètre réel du MVP.

## 2. Constat issu du code existant

Le dépôt fournit déjà les capacités suivantes :

- contenus audio, vidéo et texte ;
- listes et fiches de contenu ;
- séries ordonnées ;
- suivi de progression par module de série ;
- inscription, connexion et profil ;
- favoris et commentaires ;
- téléchargements et PWA ;
- administration des contenus, des séries, des utilisateurs, des statistiques et de la configuration ;
- stockage média Supabase, rôles `user`/`admin` et journal d’audit.

Les routes frontend, les routes Hono et la migration `supabase/migrations/202603210001_phase3_relational.sql` constituent les sources techniques de ce constat.

---

## 3. Vision produit

> ECODIS App permet à une communauté de disciples d’accéder simplement à des enseignements fiables, organisés et adaptés à son rythme, en ligne comme dans des contextes de connectivité limitée.

### Problème traité

Les enseignements sont souvent dispersés entre messages, vidéos, groupes et fichiers. Les disciples peinent alors à trouver un contenu pertinent, suivre un parcours cohérent, reprendre leur apprentissage et conserver certains contenus hors ligne. Les responsables ne disposent pas toujours d’un espace unifié pour publier, organiser, modérer et suivre l’usage.

### Proposition de valeur

ECODIS réunit :

- une bibliothèque de contenus multimédias ;
- des séries structurées ;
- une progression personnelle ;
- des favoris et commentaires ;
- un accès hors ligne contrôlé ;
- une administration adaptée à la communauté.

### Objectifs du MVP

1. Donner accès aux contenus publiés sans obstacle inutile.
2. Permettre à un utilisateur connecté de sauvegarder, commenter et suivre son avancement.
3. Permettre à un administrateur de publier et organiser les contenus sans intervention technique.
4. Permettre l’accès hors ligne à certains contenus autorisés.
5. Fournir des indicateurs simples sur l’usage et l’apprentissage.

### Hors périmètre du MVP

- réseau social généraliste ou messagerie privée ;
- cours en direct ;
- certification automatisée ;
- recommandations avancées ;
- marketplace ;
- gestion multi-organisation ;
- modération automatisée ;
- quiz et évaluations.

---

## 4. Utilisateurs cibles

| Utilisateur | Besoin principal | Capacités MVP |
|---|---|---|
| Visiteur | Découvrir les enseignements et leur valeur | Consulter contenus et séries publics, rechercher, filtrer |
| Disciple / utilisateur inscrit | Apprendre à son rythme et retrouver ses contenus | Profil, favoris, commentaires, progression, téléchargements autorisés |
| Administrateur | Gérer la plateforme et les contenus | Contenus, séries, utilisateurs, paramètres, statistiques, audit |
| Responsable de contenu (évolution) | Préparer les contenus sans administrer toute la plateforme | Assumé temporairement par l’administrateur |
| Modérateur (évolution) | Préserver la qualité des échanges | Assumé temporairement par l’administrateur |

Le public prioritaire est le disciple utilisant souvent un téléphone mobile et pouvant connaître une connectivité limitée.

---

## 5. Rôles et autorisations

### Décision MVP

Le modèle actuel est conservé durant le MVP :

- `user` : utilisateur inscrit ;
- `admin` : administrateur de plateforme.

Le visiteur est non authentifié. Les rôles `author`, `moderator` et `super_admin` sont différés jusqu’à la stabilisation de l’édition et de la modération.

| Action | Visiteur | Utilisateur | Administrateur |
|---|---:|---:|---:|
| Consulter contenu et série publics | Oui | Oui | Oui |
| Rechercher et filtrer | Oui | Oui | Oui |
| Gérer son profil | Non | Oui | Oui |
| Ajouter aux favoris | Non | Oui | Oui |
| Commenter et supprimer son commentaire | Non | Oui | Oui |
| Télécharger un contenu autorisé | Non | Oui | Oui |
| Consulter sa progression | Non | Oui | Oui |
| Créer, modifier, publier ou archiver un contenu | Non | Non | Oui |
| Gérer une série | Non | Non | Oui |
| Modérer les commentaires | Non | Non | Oui |
| Gérer utilisateurs et paramètres | Non | Non | Oui |
| Consulter statistiques et audit | Non | Non | Oui |

---

## 6. Les cinq parcours prioritaires

### 6.1 Découvrir et consulter un contenu

1. Le visiteur ouvre l’accueil ou une liste de contenus.
2. Il filtre par type ou catégorie, ou effectue une recherche.
3. Il ouvre la fiche détaillée.
4. Il écoute, regarde ou lit le contenu.
5. L’application propose la création d’un compte pour sauvegarder ou interagir.

**Résultat attendu :** l’accès aux contenus publiés est simple et les détails sont partageables.

### 6.2 Créer un compte et s’engager

1. Le visiteur crée un compte ou se connecte.
2. Il revient au contenu consulté.
3. Il ajoute le contenu aux favoris.
4. Il peut publier un commentaire.
5. Il retrouve ses favoris dans son profil.

**Résultat attendu :** le favori est unique par utilisateur et contenu ; l’utilisateur peut supprimer son propre commentaire.

### 6.3 Suivre une série et progresser

1. L’utilisateur ouvre une série.
2. Il voit les modules, leur ordre et son avancement.
3. Il ouvre le module recommandé ou le dernier consulté.
4. Il consomme le contenu.
5. Il marque le module terminé ou atteint le seuil automatique applicable.
6. L’application suggère le module suivant et calcule la progression.

**Résultat attendu :** l’utilisateur sait où il en est et quelle est la prochaine étape.

### 6.4 Télécharger et consulter hors ligne

1. L’utilisateur ouvre un contenu autorisé au téléchargement.
2. Il lance le téléchargement et suit son état.
3. Le contenu est disponible dans l’espace téléchargements.
4. Il peut le consulter hors ligne.
5. La progression est synchronisée au retour du réseau selon les règles définies.

**Résultat attendu :** seuls les contenus autorisés sont téléchargeables ; un téléchargement en échec est clairement signalé.

### 6.5 Publier et organiser un contenu

1. L’administrateur crée un contenu avec ses métadonnées et son média.
2. Les données et le fichier sont validés.
3. Le contenu est créé au statut brouillon.
4. L’administrateur prévisualise, corrige puis publie.
5. Il peut l’ajouter à une série et définir son ordre.
6. Il consulte les premiers indicateurs d’usage.

**Résultat attendu :** aucun contenu incomplet n’est rendu visible par erreur et les opérations sont auditables.

---

## 7. Statut d’un contenu

### Cycle éditorial retenu

```text
brouillon → publié → archivé
```

| Statut | Visible au visiteur / utilisateur | Peut être modifié | Ajoutable à une nouvelle série |
|---|---:|---:|---:|
| `draft` / brouillon | Non | Oui | Non |
| `published` / publié | Oui | Oui, avec audit | Oui |
| `archived` / archivé | Non | Oui | Non |

### Règles

- un contenu est créé en brouillon ;
- seul un administrateur publie ou archive pendant le MVP ;
- un brouillon peut être supprimé ;
- un contenu publié doit être archivé plutôt que supprimé s’il possède des interactions ou appartient à une série ;
- un contenu archivé est retiré des listes publiques et des nouvelles séries, mais reste conservé pour l’audit ;
- les contenus existants recevront le statut `published` lors de la future migration, sauf décision contraire.

La table `messages` actuelle ne possède pas de statut : cette décision fonctionnelle sera implémentée dans une phase de migration dédiée, pas dans ce cadrage.

---

## 8. Règles de progression

### Principes

- la progression exige une session authentifiée ;
- elle est personnelle et privée ;
- un module ne peut être terminé que s’il appartient à la série ;
- l’ordre de série est recommandé mais non bloquant dans le MVP ;
- le serveur reste la référence en cas de synchronisation depuis plusieurs appareils.

### Règles de complétion MVP

| Type | Règle |
|---|---|
| Audio | Complétion automatique à 90 % d’écoute ; marquage manuel possible |
| Vidéo | Complétion automatique à 90 % de visionnage ; marquage manuel possible |
| Texte | Marquage manuel explicite |

Un module est commencé dès son ouverture depuis une série. La progression d’une série est calculée ainsi :

```text
modules publiés et actifs terminés / modules publiés et actifs × 100
```

Une série est terminée lorsque tous ses modules publiés et actifs sont terminés. Le prochain module recommandé est le premier module non terminé selon l’ordre de la série.

### Évolutions prévues

- conservation d’une position de lecture pour audio et vidéo ;
- synchronisation hors ligne robuste ;
- prérequis ou ordre bloquant si un besoin pédagogique le justifie.

La table `series_progress` existante enregistre déjà la complétion et le dernier accès, mais pas encore la position de lecture fine.

---

## 9. Indicateurs de succès

### Indicateur directeur

**Nombre d’utilisateurs actifs ayant terminé au moins un module ou une série durant la période.**

### Indicateurs MVP

| Indicateur | Définition | Utilité |
|---|---|---|
| Utilisateurs actifs | Utilisateurs ayant consulté un contenu à J+7 ou J+30 | Adoption |
| Nouveaux inscrits | Comptes créés sur la période | Conversion |
| Taux d’activation | Inscrits ayant consommé ou mis en favori un contenu sous 7 jours | Prise en main |
| Modules terminés | Complétions enregistrées | Apprentissage |
| Taux de complétion de série | Séries terminées / séries commencées | Efficacité des parcours |
| Taux de retour | Utilisateurs revenant à J+7 et J+30 | Rétention |
| Favoris par contenu | Utilisateurs ayant favorisé un contenu | Intérêt |
| Commentaires et signalements | Volume et état de modération | Engagement et risque |
| Téléchargements réussis / échoués | Résultat du téléchargement | Usage hors ligne |
| Erreurs média | Erreurs de chargement ou de lecture | Accessibilité technique |

Les cibles chiffrées seront fixées après une première baseline de 30 jours, afin de les adapter à la taille réelle de la communauté et au volume initial de contenus.

---

## 10. Périmètre MVP

### Inclus

- contenus audio, vidéo et texte publiés ;
- consultation publique ;
- recherche et filtres de base ;
- compte, connexion et profil ;
- favoris et commentaires ;
- séries avec ordre recommandé ;
- progression par module ;
- téléchargement de contenus explicitement autorisés ;
- administration des contenus, séries, utilisateurs et configuration ;
- statistiques initiales et audit administratif.

### Différé

- rôles distincts d’auteur, modérateur et super-administrateur ;
- publication planifiée et validation multi-étapes ;
- notifications ;
- quiz, évaluation et certification ;
- messages privés ou direct ;
- nouveaux types de contenus natifs ;
- synchronisation hors ligne complexe ;
- modération préalable ou automatisée ;
- recommandations personnalisées ;
- multi-organisation.

---

## 11. Critères de validation de la Phase 0

La Phase 0 est validée lorsque le responsable produit confirme :

1. la vision et le public cible ;
2. le caractère public des contenus publiés ;
3. la matrice des rôles MVP ;
4. les cinq parcours prioritaires ;
5. le cycle `brouillon → publié → archivé` ;
6. la règle de complétion hybride proposée ;
7. les indicateurs et la baseline de 30 jours ;
8. le périmètre MVP et les fonctionnalités différées.

Après cette validation, la prochaine étape est la **Phase 1 — Assainissement technique immédiat** : dépôt reproductible, dépendances non versionnées, build, typecheck, lint et documentation des versions Node/Deno.
