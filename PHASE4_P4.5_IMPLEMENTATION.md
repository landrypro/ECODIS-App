# ECODIS App — Implémentation P4.5

## Résultat

P4.5 apporte un mode hors ligne authentifié, isolé par utilisateur et synchronisé au retour du réseau. Les URLs signées servent uniquement au transfert initial : elles ne sont pas conservées dans les métadonnées locales.

## Composants

- Migration `20260822050948_phase4_offline_experience.sql` : autorisation par contenu, version de contenu et quota configuré.
- `GET /offline/manifest` : manifeste authentifié des contenus publiés et autorisés, sans URL signée.
- IndexedDB `ecodis-offline-v1` : téléchargements, fiches/séries consultées et file de progression.
- Cache Storage `ecodis-offline-media-v2` : blobs audio/vidéo, avec clé isolée par utilisateur.
- Service worker et manifeste PWA : shell et ressources statiques de même origine ; aucune API Supabase mise en cache.
- Outbox : UUID stable, ordre chronologique, reprise au retour réseau et idempotence serveur P4.4.

## Règles réalisées

1. Seul un utilisateur connecté peut télécharger.
2. Seuls les contenus publiés, autorisés et globalement activés figurent dans le manifeste.
3. Audio, vidéo et texte sont disponibles hors ligne.
4. Le quota ECODIS est contrôlé sur la taille annoncée puis la taille réellement reçue.
5. Le stockage persistant du navigateur est demandé et son état est affiché, sans promettre qu'un navigateur ne procédera jamais à une éviction.
6. À la reconnexion, les contenus archivés, bloqués, globalement révoqués ou obsolètes sont supprimés localement.
7. La progression média et la complétion manuelle sont mises en file hors ligne puis synchronisées.
8. Commentaires, suppressions et signalements restent volontairement indisponibles hors ligne.
9. Les anciens téléchargements v1, non rattachables sûrement à un compte, sont supprimés une fois et doivent être retéléchargés.

## Limites explicites

- Une révocation locale nécessite que l'appareil retrouve le réseau et réussisse la récupération du manifeste.
- Les données locales ne sont pas chiffrées par l'application ; l'isolation repose sur le compte, l'origine web et la sécurité du terminal.
- Le navigateur peut évincer un stockage non persistant ou vidé par l'utilisateur.
- Les tests staging finaux sont volontairement regroupés avec toute la Phase 4 dans `RECETTE_FINALE_PHASE4.md` et `RECETTE_PHASE4_EXECUTION.md`.
