# ECODIS App — Recette MFA administrateur

**Périmètre :** enrôlement TOTP, second facteur, challenge AAL2 et autorisations sensibles.  
**Environnement :** staging d'abord, jamais avec un mot de passe ou un QR code capturé dans les preuves.

## Préconditions

- Compte ECODIS possédant `admin` ou `super_admin`.
- Secret Edge Function `APP_REQUIRE_ADMIN_MFA=true`.
- TOTP enrollment et verification activés dans Supabase Auth.
- Deux applications ou appareils d'authentification distincts pour le facteur principal et le facteur de secours.

## Cas de recette

| Cas | Action | Résultat attendu |
|---|---|---|
| MFA-01 | Se connecter sans facteur MFA | Page Profil > Sécurité MFA affiche « À configurer » ; les actions d'administration sensibles restent refusées AAL2. |
| MFA-02 | Cliquer « Activer MFA », scanner le QR puis saisir le code TOTP | Facteur vérifié ; état de session AAL2 ; message de succès. |
| MFA-03 | Promouvoir un membre administrateur après MFA-02 | Action autorisée et audit créé. |
| MFA-04 | Se déconnecter puis se reconnecter | Challenge MFA automatique ; action sensible refusée avant vérification. |
| MFA-05 | Saisir un code invalide ou expiré | Erreur visible ; aucune élévation AAL2. |
| MFA-06 | Saisir un code valide | Session AAL2 ; menu et actions d'administration utilisables. |
| MFA-07 | Ajouter un facteur de secours sur un second appareil | Deux facteurs TOTP vérifiés visibles. |
| MFA-08 | Tenter de retirer l'unique facteur vérifié | Bouton désactivé ; ajout d'un secours requis. |
| MFA-09 | Retirer l'ancien facteur alors qu'un secours est vérifié | Retrait autorisé ; un facteur vérifié demeure. |
| MFA-10 | Fermer le challenge MFA | Navigation publique possible ; action sensible toujours refusée par l'API. |

## Preuves et nettoyage

- Conserver uniquement une capture anonymisée de l'état « MFA vérifiée » et des messages de succès/refus.
- Ne jamais capturer le QR code, le secret TOTP, les codes à six chiffres, les jetons ou mots de passe.
- Après recette, conserver au moins deux facteurs pour le compte de gouvernance ou documenter explicitement le facteur retenu et son détenteur.
