# ECODIS App — Recette finale Phase 4

**Statut :** document vivant. Exécuter une seule recette complète après P4.1 à P4.5, avant toute mise en production.

## 1. Préconditions

1. Travailler sur une branche dédiée et un environnement Supabase **staging**, jamais production.
2. Sauvegarder la base staging avant les migrations et conserver le résultat de la restauration de Phase 3.
3. Vérifier que les secrets Edge Function sont configurés dans staging, notamment :

   ```text
   APP_BOOTSTRAP_ADMIN_EMAILS=...
   APP_BOOTSTRAP_SUPER_ADMIN_EMAILS=...
   APP_REQUIRE_ADMIN_MFA=true
   ```

4. Le compte de gouvernance doit être connecté au moins une fois après le déploiement afin de recevoir son rôle `super_admin`.
5. Déployer le frontend contenant la page `/security/mfa` et confirmer que l'enrôlement TOTP est activé dans Supabase Auth pour staging.
6. Préparer six profils distincts : visiteur, membre, éditeur, modérateur, administrateur et super-administrateur MFA. Pour le super-administrateur, prévoir deux applications TOTP ou deux appareils distincts afin de tester le facteur de secours.
7. Ne jamais placer une clé `service_role`, un mot de passe PostgreSQL, un jeton, un code TOTP ou un QR code dans une capture, le code source ou le rapport de recette.

## 2. Vérifications locales obligatoires

Dans PowerShell Windows, exécuter les contrôles frontend :

```powershell
npm ci
npm run check
npm run test:unit
npm run test:e2e
npm run build
```

Dans WSL, depuis la racine du dépôt, exécuter Deno et Supabase directement. Sur ce poste, ne pas utiliser le `npm` Windows depuis WSL pour appeler Deno :

```bash
bash scripts/test-backend-wsl.sh
supabase start
supabase db reset --local
supabase db lint --local
```

Conserver les sorties. Toute erreur bloque le déploiement staging.

## 3. Déploiement staging contrôlé

Après la validation locale :

```bash
supabase db push
supabase functions deploy server --use-api --project-ref jyidyhypblkxojbsibky
npm run recette:staging -- --confirm-staging-write
```

Puis vérifier l’URL réelle de santé :

```text
https://<projet-staging>.supabase.co/functions/v1/server/api/health
```

Le résultat attendu est HTTP 200 avec un statut opérationnel. Les tables P4.2 et P4.3 ne sont pas accessibles directement au navigateur : elles sont protégées par RLS et les privilèges SQL.

## 4. Jeux de données de recette

Créer et identifier :

- un contenu audio brouillon appartenant à l’éditeur ;
- une série brouillon appartenant à l’éditeur ;
- un contenu publié commentable ;
- deux commentaires distincts sur ce contenu ;
- au moins un signalement ouvert ;
- une progression et un favori sur un contenu publié.

Préfixer les données de recette par `RECETTE-P4-<horodatage>` afin de permettre leur suppression contrôlée après validation.

## 5. P4.1 — Workflow éditorial

| Cas | Action | Résultat attendu |
|---|---|---|
| E-01 | Créer un message ou une série | Statut `draft`, absent des listes publiques |
| E-02 | Ouvrir l’URL d’un brouillon sans jeton autorisé | Refus HTTP 401/403 ou 404 ; aucun média signé |
| E-03 | Éditeur autorisé prévisualise son brouillon | Fiche accessible, non publique |
| E-04 | `draft → in_review → published` | Publication visible publiquement ; audit présent |
| E-05 | Archiver le contenu | Disparaît du public, interactions et progression conservées |
| E-06 | Supprimer un brouillon lié à une série/interaction | Refus 409 ; archivage possible |
| E-07 | Publier une série avec module brouillon | Seuls les modules publiés sont exposés |
| E-08 | Planifier | `scheduled_at` futur enregistré ; contenu non public ; publication manuelle explicitement vérifiée |

## 6. P4.2 — Rôles et permissions

| Cas | Action | Résultat attendu |
|---|---|---|
| R-01 | Membre crée/modifie un contenu | Refus 403 |
| R-02 | Éditeur crée, modifie son brouillon et soumet en revue | Autorisé |
| R-03 | Éditeur tente publier, planifier ou archiver | Refus 403 |
| R-04 | Admin publie/archivage | Autorisé |
| R-05 | Admin attribue `content_editor`/`moderator` | Autorisé et audité |
| R-06 | Admin attribue ou retire `admin` | Refus 403 |
| R-07 | Super-admin AAL1 attribue `admin` | Refus 403 MFA |
| R-08 | Super-admin AAL2 attribue `admin` | Autorisé et audité |
| R-09 | Tentative d’attribution ou retrait `super_admin` par API | Refus 403 |
| R-10 | Suppression d’un compte admin par admin | Refus ; super-admin seul selon règles |

### 6.1 Parcours MFA administrateur

Les cas détaillés sont également disponibles dans `RECETTE_MFA_ADMIN.md`. Ils sont obligatoires avant les cas R-07 et R-08.

| Cas | Action | Résultat attendu |
|---|---|---|
| MFA-01 | Se connecter sans facteur, puis ouvrir Profil > Administration > Sécurité MFA | État « À configurer » ; les actions sensibles restent refusées en AAL1 |
| MFA-02 | Activer MFA, scanner le QR code et saisir un code valide | Facteur vérifié, session AAL2 et message de succès ; aucun secret ou code dans les preuves, logs ou stockage local |
| MFA-03 | Promouvoir un membre administrateur après MFA-02 | Action autorisée et audit créé |
| MFA-04 | Se déconnecter puis se reconnecter | Challenge MFA automatique proposé ; action sensible refusée avant vérification |
| MFA-05 | Saisir un code invalide ou expiré dans le challenge | Erreur visible ; aucune élévation AAL2 |
| MFA-06 | Saisir un code valide dans le challenge | Session AAL2 ; action sensible autorisée |
| MFA-07 | Ajouter un facteur de secours sur un second appareil/application | Deux facteurs TOTP vérifiés visibles |
| MFA-08 | Tenter de retirer l'unique facteur vérifié | Action indisponible ou refusée ; un facteur vérifié demeure |
| MFA-09 | Retirer l'ancien facteur alors qu'un secours est vérifié | Retrait autorisé ; un facteur vérifié demeure |
| MFA-10 | Tenter de fermer le challenge par croix, Échap et clic hors de la boîte | Fermeture impossible ; accès à l'espace administrateur bloqué jusqu'à AAL2 ; `/security/mfa` reste accessible pour gérer les facteurs |

### 6.2 P4.2.2 — profils et administration des comptes

Les cas détaillés A-01 à D-06 sont dans `RECETTE_P4.2.2_GESTION_PROFILS.md`. Ils sont obligatoires avant de déclarer P4.2 acceptable : rôles cumulables, invitation sans mot de passe tiers, suspension/révocation de session, profil personnel et retrait de l'interface historique.

## 7. P4.3 — Modération communautaire

| Cas | Action | Résultat attendu |
|---|---|---|
| M-01 | Membre signale le commentaire d’un autre membre | Signalement ouvert créé |
| M-02 | Membre signale son propre commentaire | Refus 403 |
| M-03 | Même membre signale deux fois le même commentaire | Refus 409 |
| M-04 | Modérateur consulte la file | Signalements ouverts visibles, détails non publics |
| M-05 | Modérateur masque avec motif | Commentaire absent immédiatement du public, audit présent |
| M-06 | Modérateur restaure | Commentaire visible, historique conservé |
| M-07 | Modérateur supprime avec motif | Texte absent du public, décision traçable |
| M-08 | Membre tente une action de modération | Refus 403 |

## 8. P4.4 — Progression avancée

### 8.1 Préparation

Préparer une série publiée contenant, dans cet ordre : un audio publié, une vidéo publiée et un texte publié. Relever les identifiants de la série et des trois modules. Utiliser deux sessions navigateur authentifiées avec le même compte pour simuler deux appareils.

La requête de progression avancée utilise :

```http
PUT /series/:seriesId/progress/:messageId
Authorization: Bearer <jeton-utilisateur>
Content-Type: application/json
```

```json
{
  "eventId": "<uuid-v4-unique>",
  "state": "in_progress",
  "progressPercent": 42,
  "positionSeconds": 312,
  "durationSeconds": 740,
  "clientUpdatedAt": "<date-ISO-du-client>",
  "source": "online"
}
```

Ne jamais réutiliser un `eventId` pour une autre charge utile. La réutilisation volontaire du même UUID et de la même charge sert uniquement au cas d'idempotence P-08.

### 8.2 Cas de recette

| Cas | Action | Résultat attendu |
|---|---|---|
| P-01 | Appliquer la migration sur une copie contenant une ancienne progression terminée | Ligne conservée, `state=completed`, `progress_percent=100`, `completed_at` historique conservé |
| P-02 | Ouvrir un module depuis sa série | Une progression `in_progress` est créée ; `startedAt` et `lastAccessedAt` sont renseignés |
| P-03 | Lire un audio moins de 90 %, mettre en pause puis recharger la page | Position restaurée à la dernière sauvegarde serveur, avec une tolérance maximale de 15 secondes |
| P-04 | Continuer le même audio depuis une deuxième session | La position la plus avancée est proposée sur les deux sessions après actualisation |
| P-05 | Atteindre exactement 90 % d'un audio ou d'une vidéo | Passage automatique à `completed`, pourcentage normalisé à 100 |
| P-06 | Envoyer une synchronisation retardée à 30 % après une complétion | Le module reste `completed`, à 100 %, sans recul de position |
| P-07 | Marquer manuellement un texte comme terminé | `completed`, 100 %, position et durée à 0, source `manual` |
| P-08 | Envoyer deux fois le même `eventId` avec la même charge | Même résultat ; deuxième réponse `replayed=true` ; une seule ligne dans `progress_events` |
| P-09 | Réutiliser un `eventId` avec une charge ou un utilisateur différent | Refus HTTP 409 ; progression inchangée |
| P-10 | Envoyer deux événements concurrents à 120 s et 180 s | Position finale 180 s, aucune ligne de progression dupliquée |
| P-11 | Rejouer un module terminé | Lecture permise ; `completed_at` initial reste inchangé |
| P-12 | Archiver un module de la série | Historique conservé, module retiré du dénominateur et du prochain module recommandé |
| P-13 | Consulter une série partiellement commencée | Affichage dans « En cours », pourcentage du module et position de reprise visibles |
| P-14 | Terminer le dernier module publié | Série à 100 %, `isCompleted=true`, aucun `nextMessageId` |
| P-15 | Utilisateur non authentifié ou autre utilisateur tente l'écriture | Refus 401/403 ; aucune progression tierce modifiable |
| P-16 | Envoyer une position négative, un pourcentage > 100 ou une date future | Refus HTTP 400 |
| P-17 | Contrôler la rétention des événements | Les événements techniques de plus de 30 jours d'un utilisateur actif sont purgés ; la progression consolidée reste intacte |

### 8.3 Contrôles SQL staging

Exécuter dans SQL Editor avec les identifiants de recette, sans copier les résultats contenant des données personnelles :

```sql
select
  user_id,
  series_id,
  message_id,
  state,
  progress_percent,
  position_seconds,
  duration_seconds,
  started_at,
  completed_at,
  client_updated_at,
  server_updated_at,
  source
from public.series_progress
where series_id = '<SERIES_ID>'::uuid
order by last_accessed_at desc;
```

```sql
select event_id, user_id, series_id, message_id, created_at
from public.progress_events
where series_id = '<SERIES_ID>'::uuid
order by created_at desc;
```

Vérifier qu'il existe au plus une ligne `series_progress` par triplet `(user_id, series_id, message_id)` et exactement une ligne `progress_events` pour l'UUID rejoué en P-08.

## 9. P4.5 — Hors ligne

### 9.1 Préparation spécifique

1. Construire puis servir l'artefact en HTTPS ou sur `localhost`. Le mode `npm run dev` ne charge volontairement pas le service worker.
2. Dans DevTools > Application, relever l'état du service worker, du manifeste, d'IndexedDB (`ecodis-offline-v1`) et des caches.
3. Préparer un audio, une vidéo et un texte publiés avec `offline_downloadable=true`, plus un contenu publié avec `offline_downloadable=false`.
4. Configurer provisoirement `maxOfflineStorageMb=50` sur staging et disposer d'un média plus grand que l'espace restant pour le cas O-09.
5. Utiliser deux comptes membres et deux profils navigateur distincts. Ne jamais simuler le hors-ligne en coupant le projet Supabase pour les autres recetteurs : utiliser DevTools > Network > Offline.

Le manifeste est obtenu avec un jeton utilisateur :

```http
GET /offline/manifest
Authorization: Bearer <jeton-utilisateur>
```

Il ne doit contenir aucune propriété `mediaUrl`, URL signée, jeton ou clé de service.

### 9.2 Cas de recette

| Cas | Action | Résultat attendu |
|---|---|---|
| O-01 | Appeler le manifeste sans jeton utilisateur valide | HTTP 401 ; aucune donnée de contenu retournée |
| O-02 | Appeler le manifeste comme membre | Seulement les contenus `published` et `offline_downloadable=true`; aucune URL signée |
| O-03 | Télécharger un audio, une vidéo et un texte | Les trois apparaissent dans Téléchargements ; le texte occupe 0 octet média ; lecture/consultation disponible |
| O-04 | Inspecter IndexedDB après téléchargement | Données isolées par `ownerId`; aucune propriété `mediaUrl`; version et date conservées |
| O-05 | Inspecter Cache Storage | Le média est dans `ecodis-offline-media-v2`; aucune réponse API Supabase ni en-tête Authorization n'est mise en cache |
| O-06 | Passer DevTools hors ligne, recharger directement la fiche téléchargée | Shell chargé par le service worker ; fiche et média/texte consultables |
| O-07 | Fermer complètement le navigateur puis rouvrir hors ligne | Téléchargement restauré si le navigateur n'a pas évincé le stockage ; statut de persistance affiché |
| O-08 | Se déconnecter puis ouvrir un autre compte sur le même navigateur | Les téléchargements du premier compte ne sont ni listés ni lisibles par le second |
| O-09 | Dépasser le quota ECODIS annoncé ou réel | Téléchargement refusé avant ou après lecture de la taille ; aucun enregistrement/cache incomplet |
| O-10 | Annuler un téléchargement en cours | Requête interrompue ; statut annulé ; aucun téléchargement final présent |
| O-11 | Tenter de télécharger un brouillon, un contenu bloqué ou quand les téléchargements globaux sont désactivés | Refus explicite ; aucun média mis en cache |
| O-12 | Lire un média hors ligne dans une série et avancer de plus de 15 secondes | Événement dans `progress_outbox`, source `offline_sync`, UUID unique ; compteur en attente incrémenté |
| O-13 | Marquer manuellement un texte terminé hors ligne | État local terminé et événement en file ; message utilisateur explicite |
| O-14 | Créer plusieurs progressions hors ligne puis rétablir le réseau | Synchronisation dans l'ordre de création ; file vidée ; progression serveur consolidée |
| O-15 | Couper/rétablir le réseau pendant la synchronisation | Aucun doublon fonctionnel ; les événements non envoyés restent en file avec compteur de tentatives |
| O-16 | Rejouer volontairement le même `eventId` | Idempotence serveur : un seul événement, réponse rejouée, aucune régression |
| O-17 | Envoyer après reconnexion un événement ancien à 30 % sur un module déjà terminé | Module reste terminé à 100 % ; position ne recule pas |
| O-18 | Produire une erreur permanente 400/401/403 sur un événement en file | Événement non réessayé indéfiniment ; autres écritures restent protégées |
| O-19 | Archiver un contenu téléchargé puis reconnecter l'appareil | Le manifeste ne le contient plus ; copie locale et fiche cachée supprimées à la réconciliation |
| O-20 | Passer `offline_downloadable` de vrai à faux puis reconnecter | Version incrémentée ; copie locale révoquée |
| O-21 | Modifier le média, le texte ou les métadonnées d'un contenu | `content_version` augmente ; ancienne copie invalidée et doit être retéléchargée |
| O-22 | Désactiver globalement les téléchargements puis synchroniser | Toutes les copies gérées sont révoquées ; nouveau téléchargement impossible |
| O-23 | Expirer l'URL signée ayant servi au téléchargement | IndexedDB ne contient pas cette URL ; la copie autorisée reste lisible tant que le manifeste ne la révoque pas |
| O-24 | Installer une version contenant l'ancien `ecodis-downloads` | Métadonnées et cache v1 supprimés une fois ; l'utilisateur est invité à retélécharger |
| O-25 | Tenter commentaire, signalement ou suppression de commentaire hors ligne | Action non envoyée/non mise en file ; message explicite ; saisie de commentaire conservée |
| O-26 | Vérifier le manifeste PWA et une navigation directe hors ligne | Manifeste valide, service worker actif, fallback SPA fonctionnel, ressources statiques même origine seulement |
| O-27 | Supprimer un téléchargement ou « Tout supprimer » | Métadonnées, fiche et blob concernés retirés ; estimation de stockage actualisée |

### 9.3 Contrôles SQL staging

```sql
select id, status, offline_downloadable, content_version, updated_at
from public.messages
where title like 'RECETTE-P4-%'
order by updated_at desc;
```

```sql
select event_id, user_id, series_id, message_id, payload_hash, created_at
from public.progress_events
where series_id = '<SERIES_ID>'::uuid
order by created_at desc;
```

Vérifier l'incrément de `content_version`, l'unicité de chaque `event_id` et l'absence de recul dans `series_progress`. La suppression locale se contrôle dans DevTools, jamais par une table serveur de téléchargements : les blobs restent sur l'appareil.

## 10. Sécurité et non-régression

1. Vérifier les logs Edge Function : aucun jeton ni mot de passe dans les traces.
2. Vérifier les audits pour publication, rôle, signalement et décision de modération.
3. Vérifier le rate limiting sur création de commentaire et signalement.
4. Vérifier la rotation des URLs signées et leur expiration.
5. Exécuter `supabase db advisors` ou l’équivalent dashboard ; corriger tout avertissement de sécurité nouveau.
6. Confirmer les sauvegardes et le dernier test de restauration staging.

## 11. Critères de sortie

La Phase 4 est recevable seulement si tous les cas applicables sont réussis, les tests automatisés sont verts, les migrations sont réversibles/documentées, et aucun incident de sécurité ou de perte de données n’est identifié.

Décision **No-Go** immédiate si : un brouillon devient public, un rôle permet une élévation de privilège, un administrateur ne peut pas obtenir AAL2 ou contourne le challenge MFA, une URL signée ou un jeton est conservé localement, une copie révoquée reste disponible après une réconciliation réussie, une progression terminée régresse, ou une migration échoue sur une base restaurée.

Le procès-verbal final doit indiquer pour chaque cas : `Réussi`, `Échoué`, `Bloqué` ou `Non applicable`, la date, le recetteur, la preuve et l'anomalie associée.
