# ECODIS App — Phase 4 : spécifications et préparation du codage

**Statut :** spécifications de référence — complétées avec le parcours MFA administrateur
**Portée :** workflow éditorial, progression avancée, modération, rôles fins et expérience hors ligne  
**Hors portée de ce document :** aucune migration, aucun déploiement ni changement de comportement applicatif.

---

## 1. But de la Phase 4

Faire évoluer ECODIS d'une administration unique et d'une consommation simple des contenus vers une plateforme éditoriale, pédagogique et communautaire maîtrisée.

La phase est découpée en lots livrables. Aucun lot ne nécessite de réécrire le frontend React, l'API Hono ou l'architecture Supabase. Chaque lot doit être activable après sa migration, ses tests et sa recette staging.

| Lot | Valeur livrée | Dépendances |
|---|---|---|
| P4.1 | Cycle éditorial des contenus et des séries | aucune |
| P4.2 | Rôles métier et permissions | P4.1 recommandée |
| P4.2.1 | Parcours MFA TOTP des administrateurs | P4.2 et Supabase Auth MFA |
| P4.3 | Modération traçable des commentaires | P4.2 |
| P4.4 | Progression détaillée et reprise de lecture | P4.1 |
| P4.5 | Hors ligne robuste et synchronisation | P4.4 |

La priorité proposée est **P4.1 → P4.2 → P4.3 → P4.4 → P4.5**. P4.4 peut être développée en parallèle de P4.3 une fois la base d'autorisation disponible.

---

## 2. Décisions proposées à valider

Ces choix sont volontairement explicites avant le codage.

1. Les contenus et séries `published` restent publics ; les autres états ne sont visibles que par les personnes autorisées.
2. Les rôles sont globaux à l'organisation ECODIS, pas par groupe ou église locale.
3. Une personne peut cumuler des rôles ; l'autorisation est l'union de leurs permissions.
4. Les commentaires sont publiés immédiatement par défaut, mais peuvent être signalés et masqués par un modérateur. Une option de pré-modération pourra être activée ultérieurement.
5. La complétion audio/vidéo intervient à 90 % de lecture, ou par action manuelle explicite. Un texte se termine manuellement.
6. La progression enregistrée par le serveur est la référence. Une progression hors ligne est mise en file puis synchronisée de manière idempotente.
7. Seuls les contenus explicitement marqués téléchargeables peuvent être gardés hors ligne.
8. Une révocation de contenu est appliquée dès le prochain retour en ligne. Elle ne peut pas effacer immédiatement un fichier sur un appareil resté durablement hors ligne.

---

## 3. P4.1 — Workflow éditorial

### 3.1 États et transitions

Les contenus (`messages`) et les séries utilisent le même cycle.

```text
draft → in_review → scheduled → published → archived
  ↑        │             │          │
  └────────┴─────────────┴──────────┘
                 retour en brouillon
```

| État | Description | Visible publiquement | Transitions autorisées |
|---|---|---:|---|
| `draft` | Travail en cours | Non | `in_review`, `archived` |
| `in_review` | Soumis au contrôle éditorial | Non | `draft`, `scheduled`, `published`, `archived` |
| `scheduled` | Publication planifiée | Non | `draft`, `in_review`, `published`, `archived` |
| `published` | Accessible au public | Oui | `draft`, `archived` |
| `archived` | Retiré de la consultation courante, conservé pour l'historique | Non | `draft` |

Règles :

- la création produit toujours un `draft` ;
- `scheduled` exige `scheduled_at` dans le futur ;
- un travail planifié devient publié par une tâche planifiée ; sans tâche disponible, l'administration peut le publier manuellement ;
- `published_at` est rempli uniquement au premier passage à `published` et reste historique ;
- l'archivage est la règle pour un contenu déjà consommé, commenté, téléchargé ou référencé dans une série ;
- la suppression physique est réservée aux brouillons sans interaction et aux super-administrateurs ;
- chaque transition est inscrite dans `audit_logs` avec l'état précédent, le nouvel état, le motif facultatif et l'acteur.

### 3.2 Écran et parcours administrateur

L'espace Contenus / Séries comporte :

- un filtre par état ;
- un badge d'état et les dates de publication ou de planification ;
- une prévisualisation réservée à l'éditeur et à l'administrateur ;
- des actions contextuelles ne proposant que les transitions autorisées ;
- une confirmation obligatoire avant archivage ou publication ;
- un champ « note éditoriale » non public lors de la soumission ou du refus ;
- une page « À réviser » pour les contenus `in_review`.

Critères d'acceptation :

- un visiteur ne peut jamais obtenir un contenu ou une série non publiée, y compris par URL directe ;
- un brouillon est modifiable par son auteur autorisé ;
- une publication ou un archivage apparaît dans l'audit ;
- une série publiée n'expose que ses modules publiés ;
- l'archivage d'un module ne détruit ni la progression ni les commentaires existants.

---

## 4. P4.2 — Rôles et permissions

### 4.1 Rôles cibles

| Rôle | Finalité | Attribution et retrait |
|---|---|---|
| `user` | Consommer et interagir | rôle initial à l'inscription |
| `content_editor` | Créer, modifier et soumettre contenus / séries | administrateur ou super-administrateur |
| `moderator` | Gérer les signalements et la visibilité des commentaires | administrateur ou super-administrateur |
| `admin` | Administrer le contenu, utilisateurs, paramètres et statistiques | super-administrateur ; MFA obligatoire en production |
| `super_admin` | Gouvernance des rôles, paramètres critiques et suppressions exceptionnelles | attribution initiale contrôlée, MFA obligatoire |

Un `admin` conserve les permissions de `content_editor` et `moderator`. Un `super_admin` conserve toutes les permissions. Cette hiérarchie aide l'interface, mais l'API doit tester une permission explicite et non une comparaison de chaînes de caractères.

### 4.2 Matrice d'autorisations

| Permission | User | Editor | Moderator | Admin | Super admin |
|---|---:|---:|---:|---:|---:|
| Lire les contenus publiés | Oui | Oui | Oui | Oui | Oui |
| Créer/modifier son brouillon | Non | Oui | Non | Oui | Oui |
| Soumettre un contenu en revue | Non | Oui | Non | Oui | Oui |
| Publier/planifier/archiver | Non | Non | Non | Oui | Oui |
| Gérer les séries | Non | Brouillons | Non | Oui | Oui |
| Voir les signalements | Non | Non | Oui | Oui | Oui |
| Masquer/restaurer un commentaire | Non | Non | Oui | Oui | Oui |
| Gérer les utilisateurs usuels | Non | Non | Non | Oui | Oui |
| Attribuer `editor`/`moderator` | Non | Non | Non | Oui | Oui |
| Attribuer ou retirer `admin` | Non | Non | Non | Non | Oui |
| Attribuer `super_admin` | Non | Non | Non | Non | procédure de gouvernance hors application |
| Paramètres critiques et purge | Non | Non | Non | Non | Oui |

Règles de sûreté :

- ne jamais retirer le dernier `super_admin` actif ;
- l'acteur ne peut pas retirer sa dernière permission d'administration ;
- attribution/retrait d'un rôle privilégié exige un motif et crée un audit ;
- une attribution `admin` ou `super_admin` exige une session MFA niveau AAL2 ;
- l'autorisation serveur repose sur les rôles en base, jamais sur `user_metadata` du JWT.

### 4.3 P4.2.1 — Parcours MFA administrateur

#### Objectif

Permettre à chaque `admin` ou `super_admin` d'atteindre le niveau d'assurance `AAL2` par TOTP, sans jamais contourner le contrôle serveur déjà appliqué aux actions sensibles.

#### Parcours retenu

1. Dans Profil > Administration, l'administrateur ouvre **Sécurité MFA** (`/security/mfa`).
2. La page affiche son niveau courant (`AAL1` ou `AAL2`) et ses facteurs vérifiés, sans exposer de secret.
3. Il démarre l'enrôlement d'un facteur TOTP, scanne le QR code dans une application d'authentification puis saisit le code à six chiffres.
4. Après vérification, la session est rafraîchie ; le niveau courant devient `AAL2`.
5. Il ajoute un second facteur TOTP de secours sur un autre appareil ou une autre application d'authentification.
6. À une connexion ultérieure, si un administrateur possède un facteur vérifié mais que sa session est encore `AAL1`, une boîte de dialogue lui demande automatiquement le code TOTP. Elle ne peut être fermée ni par la croix, ni par Échap, ni par clic hors de la boîte ; l'accès à l'espace administrateur reste bloqué jusqu'à l'obtention d'`AAL2`.

Un membre non administrateur ne voit pas l'entrée de navigation ni la page de gestion dans le parcours courant. Cette restriction d'interface ne remplace jamais l'autorisation vérifiée côté API.

#### Règles de sécurité et de récupération

- le QR code et le secret TOTP ne sont ni journalisés, ni persistés dans `localStorage`, IndexedDB ou la base ECODIS ; la gestion du facteur est confiée à Supabase Auth ;
- le code à six chiffres est utilisé uniquement pour la vérification ou le challenge, puis oublié par l'interface ;
- il est interdit de supprimer le dernier facteur TOTP vérifié ;
- la page `/security/mfa` reste accessible pour gérer les facteurs ; elle constitue l'unique exception de navigation au verrouillage de challenge ;
- la politique de secours est un second facteur TOTP indépendant ; des codes de récupération, SMS et facteurs matériels ne font pas partie du périmètre actuel ;
- la perte simultanée des deux facteurs suit une procédure de récupération hors application, tracée et approuvée par la gouvernance ;
- `APP_REQUIRE_ADMIN_MFA=true` reste le garde-fou serveur : l'interface MFA améliore l'expérience, mais ne confère aucune permission par elle-même.

#### Critères d'acceptation

- un administrateur peut enrôler et vérifier un premier puis un second facteur ;
- un QR code est présenté pendant l'enrôlement, mais aucune clé secrète en clair n'est affichée ou stockée par ECODIS ;
- une connexion administrateur AAL1 déclenche le challenge lorsque des facteurs vérifiés existent ;
- un code valide donne accès AAL2 à la session active ; un code invalide n'élève jamais le niveau ;
- une action d'attribution du rôle `admin` est refusée en AAL1 et autorisée seulement après passage effectif en AAL2 ;
- la suppression du dernier facteur est impossible ;
- la recette détaillée est tenue dans `RECETTE_MFA_ADMIN.md` et intégrée à la recette finale de Phase 4.

---

## 5. P4.3 — Modération communautaire

### 5.1 États d'un commentaire

| État | Affichage public | Signification |
|---|---:|---|
| `visible` | Oui | commentaire conforme ou non encore traité |
| `hidden` | Non | retiré temporairement par modération |
| `deleted_by_author` | Non, placeholder possible | supprimé par son auteur |
| `deleted_by_moderation` | Non, placeholder possible | retiré définitivement par modération |

Le texte original n'est jamais remplacé silencieusement. Les actions de modération conservent le motif et l'auteur de la décision dans un historique non public.

### 5.2 Signalement

Un utilisateur connecté peut signaler un commentaire d'un autre utilisateur, une seule fois par commentaire.

Motifs normalisés : `spam`, `harassment`, `inappropriate_content`, `misinformation`, `other`.

Le signalement comporte un commentaire facultatif de 500 caractères maximum. Il ne rend pas le contenu invisible automatiquement ; le modérateur décide. Une future règle de seuil automatique doit faire l'objet d'une étude séparée, afin d'éviter les abus de signalement.

### 5.3 Console de modération

La console propose :

- file triée des signalements ouverts ;
- commentaire, auteur, contenu concerné, historique et nombre de signalements ;
- actions `masquer`, `restaurer`, `supprimer`, `rejeter le signalement` ;
- motif obligatoire pour masquer ou supprimer ;
- recherche par utilisateur, contenu, état et période ;
- journal d'audit complet.

Critères d'acceptation :

- un utilisateur ne peut pas signaler son propre commentaire ni signaler deux fois le même commentaire ;
- un commentaire masqué disparaît immédiatement des lectures publiques ;
- le modérateur ne peut pas éditer le texte d'un utilisateur ;
- la décision est traçable et accessible à l'administrateur ;
- les demandes publiques ne retournent jamais le texte d'un commentaire masqué ou supprimé.

---

## 6. P4.4 — Progression avancée

### 6.1 Modèle de progression par module de série

Chaque progression est liée à `user_id`, `series_id` et `message_id`.

| Donnée | Usage |
|---|---|
| `state` | `not_started`, `in_progress`, `completed` |
| `progress_percent` | 0 à 100, valeur serveur normalisée |
| `position_seconds` | reprise audio/vidéo ; `0` pour un texte |
| `duration_seconds` | durée connue au moment de l'enregistrement |
| `started_at` | première ouverture depuis une série |
| `completed_at` | date de complétion, nullable |
| `last_accessed_at` | dernière activité connue |
| `client_updated_at` | horodatage du terminal ayant produit l'événement |
| `server_updated_at` | référence de résolution de conflit |
| `source` | `online`, `offline_sync`, `manual` |

La progression actuelle stocke seulement les modules terminés. La migration P4.4 conservera chaque ligne existante comme `completed`, à 100 %, avec les dates historiques disponibles.

### 6.2 Règles pédagogiques

- l'ouverture d'un module depuis une série crée ou met à jour `in_progress` ;
- audio/vidéo : position mise à jour périodiquement, au changement d'onglet, à la pause et à la fermeture ;
- `completed` automatiquement si `progress_percent >= 90` ;
- l'utilisateur peut marquer manuellement comme terminé ; cela produit 100 % et la source `manual` ;
- un utilisateur peut reprendre un module terminé ; sa date de complétion reste historique ;
- la progression de la série est le nombre de modules publiés terminés / modules publiés ;
- le prochain module recommandé est le premier module publié non terminé dans l'ordre de la série ; l'ordre est indicatif, pas bloquant ;
- un module archivé cesse de compter dans le dénominateur, mais son historique personnel reste conservé.

### 6.3 Synchronisation et conflits

Le client envoie un événement idempotent contenant un `eventId` UUID. Le serveur conserve la valeur la plus avancée pour la même version pédagogique :

1. une complétion ne peut pas revenir à `in_progress` par une synchronisation retardée ;
2. à état égal, la position la plus grande est retenue ;
3. à position égale, `client_updated_at` le plus récent est retenu, puis le serveur tranche avec `server_updated_at` ;
4. l'événement déjà traité retourne le même résultat sans dupliquer l'écriture.

Critères d'acceptation :

- la reprise audio/vidéo restaure la position après reconnexion et changement d'appareil ;
- une lecture hors ligne n'efface jamais une complétion serveur ;
- deux soumissions du même événement ne créent qu'une seule trace ;
- un utilisateur ne peut modifier que sa propre progression.

---

## 7. P4.5 — Expérience hors ligne robuste

### 7.1 Capacités retenues

| Capacité | Phase 4 |
|---|---:|
| Liste des contenus déjà vus | Oui, cache applicatif |
| Lecture d'un média téléchargé | Oui |
| Lecture d'un texte téléchargé | Oui |
| Reprise locale de la position | Oui |
| Marquage de progression hors ligne | Oui, file locale |
| Commentaire ou signalement hors ligne | Non, message clair demandant une connexion |
| Création ou administration hors ligne | Non |
| Téléchargement en arrière-plan OS | Non garanti, dépend du navigateur |

### 7.2 Règles de téléchargement

- seul un utilisateur connecté peut télécharger ;
- un contenu doit être `published` et `offline_downloadable=true` ;
- la taille locale maximale proposée est 1 Go, configurable dans `app_config` ;
- l'application demande la persistance du stockage navigateur lorsque celle-ci est disponible ;
- l'utilisateur voit la taille, l'état, la date, l'espace utilisé et l'action de suppression ;
- le téléchargement est annulable avant sa finalisation ;
- le cache contient un fichier local et des métadonnées minimales, jamais une URL signée durable ;
- à la reconnexion, un manifeste compare les droits et retire les contenus devenus non téléchargeables ou archivés.

### 7.3 Architecture locale

Le stockage actuel utilise Cache Storage et `localStorage`. P4.5 migre les métadonnées, la file de synchronisation et les états de téléchargement vers IndexedDB :

- `downloads` : manifeste, état, taille, version et date ;
- `progress_outbox` : événements de progression en attente ;
- `app_cache` : contenu texte et métadonnées consultables ;
- Cache Storage : blobs média lourds uniquement.

Une abstraction `OfflineRepository` masque ces détails à l'interface. Le navigateur reste propriétaire des données locales ; aucune donnée de fichier n'est répliquée dans PostgreSQL.

---

## 8. Préparation du modèle de données

Les structures ci-dessous définissent la cible pour les migrations. Elles ne doivent être créées qu'un lot à la fois, après validation et tests locaux.

### 8.1 Évolutions de tables existantes

| Table | Évolution proposée |
|---|---|
| `messages` | `status`, `published_at`, `scheduled_at`, `reviewed_at`, `reviewed_by`, `offline_downloadable`, `content_version` |
| `series` | mêmes champs éditoriaux, hors `offline_downloadable` ; `content_version` |
| `comments` | `status`, `updated_at`, `moderated_at`, `moderated_by`, `moderation_reason` |
| `series_progress` | remplacer la notion de complétion seule par les colonnes de P4.4 ; `completed_at` devient nullable |
| `users_roles` | migration vers un modèle multi-rôles ; conservation temporaire en lecture durant la transition |

### 8.2 Nouvelles tables

| Table | Clé et rôle |
|---|---|
| `user_role_assignments` | `(user_id, role)` ; rôles fixes attribués à un utilisateur |
| `comment_reports` | signalement unique `(comment_id, reporter_user_id)` |
| `comment_moderation_events` | historique immuable des décisions de modération |
| `progress_events` | déduplication des `event_id` de synchronisation, rétention courte |

### 8.3 Contraintes et index attendus

- `status` utilise des types enum contrôlés ou des `check` constraints ;
- index partiel `messages(status, published_at desc)` et équivalent `series`, ciblant les lectures publiques ;
- index `comments(message_id, status, created_at desc)` ;
- index `comment_reports(status, created_at)` et `(comment_id)` ;
- index `series_progress(user_id, series_id, last_accessed_at desc)` ;
- index unique `progress_events(event_id)` ;
- index `user_role_assignments(user_id)` et `(role, user_id)` ;
- toutes les tables `public` ont RLS ; aucun accès direct navigateur n'est accordé aux tables administratives ou de synchronisation.

Les fonctions PostgreSQL éventuelles seront `SECURITY INVOKER`, avec `search_path` fixé et droits d'exécution minimaux. L'Edge Function, utilisant le rôle serveur, reste le point d'application des règles métier et d'autorisation.

---

## 9. Contrats API à préparer

Les routes existantes restent compatibles pendant une version. Les nouveaux champs sont ajoutés aux réponses avant de rendre les anciens comportements obsolètes.

| Domaine | Endpoint proposé | Permission | Résultat |
|---|---|---|---|
| Édition | `POST /messages/:id/transitions` | permission éditoriale | applique une transition d'état |
| Édition | `POST /series/:id/transitions` | permission éditoriale | applique une transition d'état |
| Édition | `GET /admin/review-queue` | publication | liste les éléments en revue / planifiés |
| Rôles | `GET /admin/users/:id/roles` | admin | liste les rôles |
| Rôles | `PUT /admin/users/:id/roles` | super_admin ou règle dédiée | remplace les rôles autorisés |
| Modération | `POST /comments/:id/reports` | user connecté | crée un signalement |
| Modération | `GET /admin/moderation/reports` | moderator | file de modération |
| Modération | `POST /admin/comments/:id/moderation` | moderator | masque, restaure ou supprime |
| Progression | `PUT /series/:seriesId/progress/:messageId` | user connecté | enregistre une position / état idempotent |
| Hors ligne | `GET /offline/manifest` | user connecté | droits et versions des téléchargements |

Exemple de mise à jour de progression :

```json
{
  "eventId": "uuid",
  "state": "in_progress",
  "progressPercent": 42,
  "positionSeconds": 312,
  "durationSeconds": 740,
  "clientUpdatedAt": "2026-08-21T18:25:00.000Z",
  "source": "offline_sync"
}
```

Les erreurs utilisent la structure existante et un code explicite, par exemple `CONTENT_NOT_PUBLISHED`, `INVALID_TRANSITION`, `PERMISSION_DENIED`, `COMMENT_ALREADY_REPORTED`, `PROGRESS_EVENT_REPLAYED`.

---

## 10. Préparation Clean Architecture et SOLID

La migration de structure est progressive par domaine. Il ne faut pas déplacer tout le projet en une fois.

```text
src/
  features/
    editorial/
      domain/          états, transitions, permissions métier
      application/     cas d'usage publication, soumission, archivage
      infrastructure/  client HTTP, mappers
      presentation/    hooks, composants et pages admin
    learning/          progression et reprise de lecture
    moderation/        signalements et décisions
    offline/           repository IndexedDB et synchronisation
    access/            rôles et vérification de permissions

supabase/functions/server/src/
  domain/              règles pures partageables par les routes
  application/         cas d'usage côté serveur
  infrastructure/      repositories Supabase Storage/PostgreSQL
  routes/              adaptateurs HTTP Hono, minces
```

Principes imposés :

- une route Hono valide la requête, appelle un cas d'usage et traduit la réponse HTTP ;
- les composants React ne connaissent pas les détails Supabase ou IndexedDB ;
- les règles de transition, de progression et d'autorisation sont des fonctions pures testables ;
- les repositories sont injectés dans les cas d'usage plutôt qu'importés comme dépendances globales ;
- les DTO API sont séparés des modèles métier et des lignes PostgreSQL ;
- un nouveau comportement est couvert par des tests unitaires, intégration et E2E avant d'être activé.

---

## 11. Plan de codage proposé

### Sprint 4.1 — Fondation éditoriale

1. Écrire les tests de transitions d'état.
2. Ajouter la migration de statut et migrer les contenus existants à `published`.
3. Créer le cas d'usage serveur de transition et l'audit associé.
4. Filtrer les lectures publiques à `published`.
5. Ajouter les badges, filtres, actions et prévisualisation dans l'administration.
6. Ajouter la recette staging « brouillon invisible / publication visible / archivage invisible ».

### Sprint 4.2 — RBAC

1. Créer `user_role_assignments` et migrer `users_roles.role` sans retirer la compatibilité.
2. Centraliser les permissions dans un module serveur testé.
3. Remplacer progressivement `requireAdmin` par `requirePermission`.
4. Créer la gestion des rôles dans l'administration, avec protections MFA et audit.
5. Retirer le chemin de compatibilité uniquement après recette complète.

### Sprint 4.3 — Modération

1. Ajouter états, signalements et historique.
2. Rendre les lectures publiques filtrées à `visible`.
3. Créer la file de modération et les actions de décision.
4. Ajouter limites de débit spécifiques au signalement et aux commentaires.
5. Tester les droits, l'unicité du signalement et la visibilité immédiate.

### Sprint 4.4 — Apprentissage

1. Étendre `series_progress` de façon rétrocompatible.
2. Créer le cas d'usage idempotent de progression.
3. Ajouter les lecteurs audio/vidéo avec reprise de position et seuil 90 %.
4. Mettre à jour les cartes de série, le prochain module et les statistiques.
5. Tester le conflit multi-appareils et la reprise après rechargement.

### Sprint 4.5 — Hors ligne

1. Isoler l'actuel `DownloadProvider` derrière `OfflineRepository`.
2. Migrer les métadonnées de `localStorage` vers IndexedDB sans perte des téléchargements existants.
3. Ajouter une outbox de progression et le synchroniseur réseau.
4. Créer le manifeste de droits et la purge à la reconnexion.
5. Recetter un téléphone en mode avion, puis la resynchronisation.

---

## 12. Stratégie de tests et recette

| Niveau | Cas minimaux |
|---|---|
| Unitaires | transitions, permissions, calcul de pourcentage, résolution de conflit, règles de modération |
| Intégration backend | autorisation par rôle, filtres d'état, signalement unique, idempotence `eventId`, manifeste hors ligne |
| Migration | reset local, données historiques, index, RLS, advisors Supabase |
| E2E navigateur | brouillon non public, publication, signalement/masquage, reprise média, file offline/synchronisation |
| Staging | deux comptes et deux navigateurs, média autorisé, passage en mode avion, contrôle audit et nettoyage |

Une recette P4 est réussie si :

- aucun contenu non publié n'est accessible publiquement ;
- aucun rôle ne permet une action hors de sa matrice ;
- un commentaire masqué ne fuite pas via les listes ou compteurs ;
- la progression reste cohérente après deux appareils et un mode hors ligne ;
- les téléchargements respectent les droits au retour en ligne ;
- les migrations sont réexécutables dans une base locale vierge ;
- `npm run check`, tests frontend, tests Deno, build et E2E passent.

---

## 13. Risques et garde-fous

| Risque | Garde-fou |
|---|---|
| Régression sur contenus publics existants | migration initiale à `published`, tests URL directe |
| Escalade de privilèges | permissions côté serveur, MFA, audit, jamais `user_metadata` |
| Écrasement de progression multi-appareil | événements idempotents et règle de résolution documentée |
| Explosion de stockage local | quota utilisateur, demande de persistance, indicateur et purge |
| Contenu révoqué encore accessible hors ligne | suppression au prochain retour réseau ; information claire à l'utilisateur |
| Modération arbitraire ou non traçable | motif obligatoire et événement immuable |
| Migration risquée | migration additive, fenêtre de compatibilité, rollback applicatif et recette staging |

---

## 14. Définition de terminé de la Phase 4

La Phase 4 sera considérée terminée lorsque les cinq lots ont leur code, migration, tests, recette staging et documentation d'exploitation, et lorsque le responsable produit confirme :

1. le cycle éditorial et les règles de visibilité ;
2. la matrice de rôles et la gouvernance des super-administrateurs ;
3. les motifs et actions de modération ;
4. le seuil de complétion et la stratégie de conflit ;
5. les limites de téléchargement et les règles de révocation hors ligne.

La prochaine action de développement proposée est **P4.1 — Fondation éditoriale**, car elle rend les contenus sûrs à préparer et établit la notion de visibilité nécessaire aux lots suivants.
