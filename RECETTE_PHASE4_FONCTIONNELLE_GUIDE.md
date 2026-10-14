# ECODIS App — Guide de recette fonctionnelle Phase 4

**Périmètre :** P4.1 à P4.5  
**Environnements autorisés :** Vercel et Supabase staging uniquement  
**Cas détaillés :** `RECETTE_FINALE_PHASE4.md`  
**Registre à remplir :** `RECETTE_PHASE4_PREUVES.csv`  
**Contrôles SQL sans écriture :** `supabase/recette/phase4_controles_lecture_seule.sql`

## 1. Préparer la séance

1. Ouvrir l'URL Vercel de staging/de recette et vérifier que le commit déployé est identifié.
2. Choisir un préfixe unique : `RECETTE-P4-AAAAMMJJ-HHMM`.
3. Créer six comptes de recette non personnels : visiteur, membre A, membre B, éditeur, modérateur, administrateur et super-administrateur avec MFA actif.
4. Assigner les rôles depuis le compte super-administrateur, puis se reconnecter avec chaque compte pour rafraîchir les droits.
5. Créer avec le préfixe de recette :
   - un contenu audio, un contenu vidéo et un texte publiés et téléchargeables hors ligne ;
   - un contenu publié non téléchargeable ;
   - un contenu et une série en brouillon ;
   - une série publiée contenant les trois contenus dans cet ordre : audio, vidéo, texte.
6. Ouvrir deux profils Chromium distincts pour le même membre : profil normal et fenêtre privée. Ouvrir un troisième profil pour le second membre.
7. Dans le registre CSV, remplacer `À faire` par `Réussi`, `Échoué`, `Bloqué` ou `Non applicable` et ajouter une preuve anonymisée.

Ne jamais noter, copier dans le CSV ou capturer un mot de passe, un jeton Bearer, une URL signée complète, une clé Supabase ou une adresse personnelle.

## 2. Ordre d'exécution

### A — Workflow éditorial (E-01 à E-08)

1. Avec l'éditeur, créer le contenu et la série brouillon ; confirmer leur absence de l'espace public.
2. Vérifier la prévisualisation par l'éditeur, puis la transition `draft → in_review → published` par le rôle autorisé.
3. Archiver le contenu et contrôler sa disparition de l'espace public, sans perte des interactions/progressions.
4. Tester le refus de suppression d'un brouillon encore lié et la publication d'une série avec un module brouillon.
5. Tester une planification future : le contenu reste invisible tant que la publication n'est pas effectuée explicitement.

### B — Rôles, MFA et modération (R-01 à R-10, M-01 à M-08)

1. Contrôler les refus de création/publication par les rôles insuffisants, puis les autorisations de l'éditeur et de l'administrateur.
2. Tenter d'attribuer/retirer `admin` depuis un admin : refus attendu.
3. Avec le super-administrateur, effectuer le test AAL1 sans MFA puis AAL2 avec MFA : seul AAL2 peut gérer le rôle `admin`.
4. Publier deux commentaires avec les membres A et B. Le membre A signale celui de B ; il ne peut pas signaler le sien ni dupliquer le signalement.
5. Avec le modérateur, ouvrir la file, masquer, restaurer puis supprimer avec un motif. Vérifier dans l'interface publique et dans les audits.
6. Vérifier qu'un membre ne peut réaliser aucune action de modération.

### C — Progression avancée et reprise (P-01 à P-17)

1. Avec membre A, démarrer l'audio et arrêter la lecture avant 90 %. Recharger : la position de reprise doit être à moins de 15 secondes de la dernière sauvegarde.
2. Dans le deuxième profil du même membre, ouvrir le même audio et confirmer que la position la plus avancée est proposée.
3. Atteindre 90 % sur l'audio/vidéo ; la progression doit passer à 100 % et rester terminée lorsqu'un événement ancien arrive ensuite.
4. Marquer le texte terminé manuellement : position et durée sont nulles/à zéro, source `manual`.
5. Depuis DevTools Network, rejouer une même requête de progression avec le même `eventId` et la même charge : le second résultat doit indiquer `replayed=true`. Ne jamais exporter le jeton de la requête.
6. Réutiliser l'`eventId` avec une charge modifiée : HTTP 409 attendu. Tester aussi valeurs invalides, accès non connecté et autre utilisateur.
7. Terminer la série ; vérifier 100 %, l'absence de prochain module et l'affichage « En cours » avant cette fin.
8. Exécuter les requêtes de contrôle SQL après les essais P-08, P-10 et P-17.

### D — Hors ligne et synchronisation (O-01 à O-27)

1. Utiliser le build Vercel (ou `npm run preview`), jamais `npm run dev`.
2. Dans DevTools > Application, ouvrir successivement Service Workers, Manifest, IndexedDB et Cache Storage.
3. Télécharger audio, vidéo et texte comme membre A ; vérifier l'espace Téléchargements, `ownerId`, versions et l'absence d'URL signée dans IndexedDB.
4. Contrôler que seul `ecodis-offline-media-v2` contient les médias ; aucune réponse API ni en-tête Authorization ne doit être mise en cache.
5. Dans DevTools > Network, passer **Offline**. Recharger directement la fiche téléchargée, tester lecture/texte, fermeture complète puis réouverture.
6. Se déconnecter puis ouvrir le membre B dans le même navigateur : aucun téléchargement de A ne doit être listé ni lisible.
7. En mode Offline, avancer dans un média et terminer un texte. Vérifier le compteur de synchronisation en attente, puis rétablir le réseau et vérifier la file vidée et la progression consolidée.
8. Tester quota, annulation, contenu non téléchargeable, archivage, révocation, modification de contenu, désactivation globale et « Tout supprimer » conformément à O-09 à O-27.

## 3. Preuves minimales attendues

- E/R/M : statut HTTP non sensible ou capture UI anonymisée et ligne d'audit sans e-mail.
- P : réponse HTTP anonymisée, puis résultat de contrôle `series_progress`/`progress_events`.
- O : capture anonymisée des panneaux Service Worker, Manifest, IndexedDB et Cache Storage ; aucune capture de jeton ni d'URL signée complète.
- Chaque anomalie reçoit une référence (ex. `BUG-P4-001`) dans le CSV.

## 4. Contrôle et nettoyage final

1. Exécuter les requêtes de `supabase/recette/phase4_controles_lecture_seule.sql` dans SQL Editor staging.
2. Vérifier les paramètres de configuration temporaires : `downloadsEnabled` et `maxOfflineStorageMb` doivent être revenus aux valeurs approuvées.
3. Archiver ou supprimer seulement les données portant le préfixe de recette et retirer les rôles temporaires.
4. Dans chaque profil de recette, supprimer les téléchargements, vider IndexedDB/Cache Storage et désinscrire le service worker.
5. Reporter le résultat dans `PV_RECETTE_PHASE4_20260823.md` : **Go**, **Go avec réserves** ou **No-Go**.
