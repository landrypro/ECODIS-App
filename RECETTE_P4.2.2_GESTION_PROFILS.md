# ECODIS App — Recette globale P4.2.2

## 1. Identification de la recette

| Élément | Valeur à renseigner |
|---|---|
| Version / commit Git | |
| Branche | |
| Date et heure de début | |
| Date et heure de fin | |
| Recetteur | |
| URL frontend Vercel | |
| Référence projet Supabase staging | `jyidyhypblkxojbsibky` |
| Version de l'Edge Function `server` | |
| Versions de migrations | jusqu'à `20260824211722_phase4_invitation_delivery.sql` |
| Décision finale | GO complet / GO avec réserve B02.2 / NO-GO |

**Références :**

- `PHASE4_P4.2.2_GESTION_PROFILS_SPECIFICATIONS.md` ;
- `P4.2.2_B02_RENVOI_INVITATION_SPECIFICATIONS.md` ;
- `PHASE3_SECURITE_EXPLOITATION.md` ;
- `RECETTE_PHASE4_EXECUTION.md`.

## 2. Objet et périmètre

Cette recette valide globalement :

- **P4.2.2-A** — parcours unique `/admin/users`, rôles cumulables, permissions effectives et audit ;
- **P4.2.2-B** — invitation sans mot de passe administrateur, renvoi d'invitation et récupération de mot de passe ;
- **P4.2.2-C** — suspension, réactivation et révocation des sessions ;
- **P4.2.2-D** — profil personnel et retrait de l'interface historique.

Elle vérifie le parcours complet du navigateur jusqu'à Supabase Auth, l'Edge Function et PostgreSQL. Aucune écriture de recette ne doit viser la production.

## 3. Règles de décision

La recette est immédiatement **NO-GO** si au moins un des événements suivants est observé :

- élévation ou retrait de privilège sans permission ou sans AAL2 lorsque celui-ci est requis ;
- accès administratif fondé sur `user_metadata` ou contrôlé uniquement dans l'interface ;
- clé `service_role`, jeton, mot de passe, lien Auth, code TOTP, QR code ou secret MFA visible dans le navigateur, les logs, l'audit ou une preuve ;
- compte suspendu conservant un accès effectif à une route ECODIS protégée ;
- administrateur ordinaire capable de gérer le rôle `admin`, un `super_admin` ou un autre administrateur ;
- perte de rôles, de statut ou de références métier lors d'un renvoi d'invitation ;
- migration, Edge Function et frontend provenant de versions de code incompatibles.

Trois décisions finales sont possibles :

1. **GO complet** : tous les cas obligatoires, y compris B02.2 avec fournisseur transactionnel actif, sont réussis.
2. **GO avec réserve B02.2** : Resend n'est volontairement pas configuré faute de domaine vérifié ; B-02R retourne un HTTP 503 contrôlé, le bouton ne prétend pas que l'e-mail est parti, et tous les autres cas sont réussis. Le renvoi fiable reste désactivé.
3. **NO-GO** : au moins un verrou critique échoue ou une anomalie majeure reste ouverte.

## 4. Préconditions

### 4.1 Déploiement

- Le commit testé est poussé et déployé sur Vercel staging/recette.
- L'Edge Function `server` est déployée depuis le même commit.
- Les migrations locales et distantes sont alignées jusqu'à `20260824211722_phase4_invitation_delivery.sql`.
- `GET /health` retourne HTTP 200 avec `{ "status": "ok" }`.
- Les Redirect URLs Supabase Auth autorisent les URL de recette vers `/reset-password` et `/profil`.
- `APP_REQUIRE_ADMIN_MFA=true` est configuré sur staging.
- Les secrets backend restent exclusivement dans les secrets Supabase ; aucune variable `VITE_*` ne contient de secret.

### 4.2 Configuration de B02.2

Choisir et consigner un seul mode avant la recette :

| Mode | Configuration | Attente |
|---|---|---|
| B02.2 actif | `APP_EMAIL_PROVIDER=resend`, `RESEND_API_KEY` et `APP_EMAIL_FROM` valides | Envoi réel et cas B-02A à B-02G |
| B02.2 désactivé | fournisseur ou expéditeur non configuré | HTTP 503 contrôlé au cas B-02R ; aucun lien généré ou exposé |

Ne jamais simuler une configuration Resend avec un domaine non vérifié sur staging partagé.

### 4.3 Comptes de recette

Utiliser uniquement des comptes et boîtes e-mail de recette. Préfixer les noms et motifs par `RECETTE-P422-AAAAMMJJ-HHMM`.

| Code | Profil initial | Exigence |
|---|---|---|
| `SA1` | super-admin actif | MFA vérifié, sessions AAL1 et AAL2 testables |
| `ADM1` | admin actif | MFA vérifié, sessions AAL1 et AAL2 testables |
| `USR1` | membre actif confirmé | aucune permission élevée |
| `USR2` | membre actif confirmé | session ouverte avant le test de suspension |
| `INV1` | invité non confirmé | boîte e-mail accessible |
| `ED1` | membre ou éditeur | utilisé pour les rôles cumulables |
| `MOD1` | membre ou modérateur | utilisé pour les rôles cumulables |

Ne pas utiliser le dernier super-administrateur actif comme cible de test.

### 4.4 Matériel de preuve

- Ouvrir les outils réseau du navigateur avec conservation du journal.
- Préparer le fichier `RECETTE_P4.2.2_PREUVES.csv`.
- Masquer adresses personnelles, UUID complets et données non nécessaires.
- Ne jamais capturer le contenu des champs mot de passe, les liens Auth, les en-têtes `Authorization`, les QR codes ou les codes TOTP.

## 5. Verrou technique préalable

### 5.1 PowerShell

```powershell
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run build
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

### 5.2 WSL

```bash
bash scripts/test-backend-wsl.sh
supabase start
supabase db reset --local
supabase db lint --local
supabase migration list --local
supabase stop --no-backup
```

### 5.3 Conditions de passage

- TypeScript, lint, tests frontend, tests backend, build, E2E et migrations doivent réussir.
- Les avertissements doivent être consignés et classés ; aucune erreur n'est acceptée.
- Une vulnérabilité de production élevée ou critique non corrigée bloque le **GO complet**. Toute dérogation exige une acceptation de risque écrite, une échéance et un responsable.
- Le gros bundle Vite est un point de performance à suivre, mais ne bloque pas cette recette s'il ne provoque pas de défaillance fonctionnelle.

## 6. Contrôles de déploiement staging

| Cas | Action | Résultat attendu |
|---|---|---|
| DEP-01 | Relever le commit Vercel et le commit de déploiement de la Function. | Même version fonctionnelle identifiée. |
| DEP-02 | Contrôler l'historique des migrations staging. | Toutes les migrations P4.2.2 attendues sont présentes une seule fois. |
| DEP-03 | Appeler `GET https://jyidyhypblkxojbsibky.supabase.co/functions/v1/server/api/health`. | HTTP 200 et statut `ok`. |
| DEP-04 | Ouvrir `/`, `/login`, `/profil` et `/admin/users` par URL directe. | Pas de 404 d'hébergement ; protection d'accès conforme. |
| DEP-05 | Inspecter les variables livrées au navigateur. | Seulement URL et clé publique/publishable Supabase ; aucun secret backend. |

## 7. P4.2.2-A — rôles cumulables et parcours unique

| Cas | Acteur | Action | Résultat attendu |
|---|---|---|---|
| A-01 | `ADM1` AAL2 | Ouvrir `/admin/users`, rechercher `ED1`, ouvrir sa fiche. | Identité, statut, rôles et permissions effectives visibles. |
| A-02 | `ADM1` AAL2 | Ajouter `content_editor` avec un motif de 10 à 500 caractères. | `user` + `content_editor`, permissions dérivées et audit `role_assignments_update`. |
| A-03 | `ADM1` AAL2 | Ajouter ensuite `moderator`. | Trois rôles cumulés, sans perte du rôle précédent. |
| A-04 | `ED1` | Se reconnecter et ouvrir les fonctions éditoriales/modération. | Accès conforme à la somme des permissions ; aucune permission `admin`. |
| A-05 | `ADM1` AAL2 | Retirer `content_editor` en conservant `moderator`. | Retrait ciblé, rôle `user` conservé et audit avant/après. |
| A-06 | `ADM1` AAL2 | Tenter d'ajouter ou retirer `admin`. | Action absente/inactive ou HTTP 403 ; aucun changement. |
| A-07 | `SA1` AAL1 | Tenter d'ajouter `admin` à `USR1`. | Challenge MFA obligatoire ; aucune écriture. |
| A-08 | `SA1` AAL2 | Refaire A-07 après challenge. | Attribution autorisée et auditée. |
| A-09 | `ADM1` ou `SA1` | Tenter de modifier ses propres rôles. | Refus ; aucun changement. |
| A-10 | `SA1` AAL2 | Tenter d'attribuer/retirer `super_admin` via l'application. | Refus 403 ou option absente. |
| A-11 | `ADM1` AAL2 | Envoyer un motif de moins de 10 puis de plus de 500 caractères. | Validation 400 ; aucun audit de succès. |
| A-12 | Inspecteur réseau | Observer la mise à jour des rôles. | `PUT /users/:id/roles` uniquement ; aucun appel à `/users/:id/role`. |
| A-13 | `ADM1` | Ouvrir le dashboard historique. | Aucune ancienne gestion des utilisateurs ; lien unique vers `/admin/users`. |
| A-14 | Appel API sans droit | Rejouer la requête de rôle avec un membre. | HTTP 403 côté API, indépendamment de l'interface. |

Après A-08, retirer le rôle `admin` temporaire avec `SA1` AAL2 avant de continuer.

## 8. P4.2.2-B — invitation et récupération

### 8.1 Invitation initiale et récupération

| Cas | Acteur | Action | Résultat attendu |
|---|---|---|---|
| B-01 | `ADM1` AAL2 | Inviter `INV1` avec nom et e-mail. | Aucun champ mot de passe ; HTTP 202 neutre ; e-mail reçu ; audit `user_invitation_sent`. |
| B-03 | `INV1` | Ouvrir le lien et choisir son propre mot de passe. | Compte confirmé, connexion possible et aucun secret visible hors page Auth. |
| B-04 | `ADM1` AAL2 | Demander un lien de mot de passe pour `USR1`. | Réponse neutre ; e-mail reçu seulement par le titulaire ; audit `password_reset_requested`. |
| B-05 | `USR1` | Demander son propre lien depuis `/profil`, puis terminer le parcours. | Retour vers `/reset-password`, nouveau mot de passe accepté et sessions antérieures invalidées. |
| B-06 | Membre sans droit | Appeler les routes d'invitation et de reset administré. | HTTP 403 ; aucun envoi et aucun audit de succès. |
| B-07 | Inspecteur réseau/logs | Contrôler les réponses et traces. | Aucun mot de passe, lien, jeton, clé fournisseur ou adresse complète dans les traces techniques. |

### 8.2 B02.2 actif — renvoi transactionnel fiable

Exécuter ces cas uniquement si le fournisseur et l'expéditeur sont réellement configurés.

| Cas | Action | Résultat attendu |
|---|---|---|
| B-02A | Renvoyer l'invitation de `INV1` avant confirmation. | HTTP 202, un nouvel e-mail, aucun doublon de compte et audit `user_invitation_resent`. |
| B-02B | Cliquer deux fois pendant le délai configuré. | Un seul envoi ; second HTTP 429 avec `Retry-After` et audit `user_invitation_resend_throttled`. |
| B-02C | Demander le renvoi d'un compte confirmé. | HTTP 409 ; aucune génération ni livraison. |
| B-02D | Demander le renvoi d'un compte suspendu. | HTTP 409 ; aucune génération ni livraison. |
| B-02E | Simuler une indisponibilité du fournisseur. | HTTP 503 neutre et audit `user_invitation_delivery_failed`. |
| B-02F | Faire la demande sans permission. | HTTP 401/403 ; aucune tentative fournisseur. |
| B-02G | Inspecter Network, logs, audit et table technique. | Aucun `actionLink`, jeton, e-mail complet ou clé ; idempotence et délai persistants. |

### 8.3 B02.2 désactivé — réserve contrôlée

| Cas | Action | Résultat attendu |
|---|---|---|
| B-02R | Demander le renvoi d'une invitation non confirmée. | HTTP 503 explicite, message temporaire, aucun faux succès, aucun lien généré et audit d'échec technique sans secret. |

Le cas B-02R réussi autorise uniquement un **GO avec réserve B02.2**. Il ne vaut pas validation de l'envoi transactionnel réel.

## 9. P4.2.2-C — suspension, réactivation et sessions

| Cas | Acteur | Action | Résultat attendu |
|---|---|---|---|
| C-01 | `USR2` | Ouvrir une session dans un onglet et une page protégée. | Session active avant suspension. |
| C-02 | `ADM1` AAL2 | Suspendre `USR2` avec motif valide. | Statut et motif visibles ; audit `user_suspended`. |
| C-03 | `USR2` déjà connecté | Attendre au plus 30 s ou ramener l'onglet au premier plan. | Session locale nettoyée et interface actualisée sans tentative manuelle de reconnexion. |
| C-04 | Ancienne session `USR2` | Appeler une route ECODIS protégée. | HTTP 401 ; aucune donnée ou écriture protégée. |
| C-05 | `USR2` | Tenter une nouvelle connexion. | Refus Auth ; aucune nouvelle session. |
| C-06 | `ADM1` AAL2 | Tenter de s'auto-suspendre. | Refus ; statut inchangé. |
| C-07 | `ADM1` AAL2 | Tenter de suspendre un admin ou `SA1`. | Refus ; statut inchangé. |
| C-08 | `SA1` AAL1 | Tenter de suspendre un admin. | Challenge MFA ; aucune écriture. |
| C-09 | `SA1` AAL2 | Suspendre puis réactiver un admin de recette avec motifs valides. | Opérations autorisées et audits distincts. |
| C-10 | `ADM1` AAL2 | Réactiver `USR2`. | Statut actif et audit `user_reactivated`. |
| C-11 | `USR2` | Réutiliser l'ancienne session puis se reconnecter. | Ancienne session inutilisable ; nouvelle connexion nécessaire et autorisée. |
| C-12 | Acteur autorisé | Envoyer motif court, vide ou supérieur à 500 caractères. | HTTP 400 ; aucun changement ni audit de succès. |

## 10. P4.2.2-D — profil personnel et retrait de l'UI historique

| Cas | Acteur | Action | Résultat attendu |
|---|---|---|---|
| D-01 | `USR1` | Ouvrir `/profil`. | Nom, e-mail, dates, rôles et permissions effectives affichés en lecture seule. |
| D-02 | `USR1` | Modifier son nom et recharger. | Nom persistant ; rôles inchangés ; audit `profile_updated` limité au champ `name`. |
| D-03 | `USR1` | Saisir une nouvelle adresse e-mail. | Confirmation demandée ; pas de changement effectif avant validation Auth. |
| D-04 | `USR1` | Ouvrir le lien de confirmation. | Retour vers `/profil` et e-mail confirmé selon la politique Supabase Auth. |
| D-05 | `USR1` | Tenter d'injecter un rôle ou une permission dans la mise à jour de profil. | Champ ignoré/refusé ; aucune élévation. |
| D-06 | `USR1` | Utiliser le parcours de mot de passe depuis le profil. | Aucun mot de passe tiers manipulé ; parcours Auth sécurisé. |
| D-07 | `ADM1` | Ouvrir `/admin/dashboard`. | Ancienne liste, ancien formulaire de mot de passe et anciens boutons de rôle absents. |
| D-08 | `ADM1` | Rechercher les actions comptes. | Invitation, rôles et statuts disponibles uniquement dans `/admin/users`. |
| D-09 | Membre sans droit | Ouvrir `/admin/users` par URL directe. | Redirection/refus et API inaccessible. |

## 11. Contrôles transverses de sécurité et de données

| Cas | Contrôle | Résultat attendu |
|---|---|---|
| SEC-01 | Vérifier que les rôles proviennent de `user_role_assignments`. | Aucune décision d'autorisation basée sur `user_metadata`. |
| SEC-02 | Tester une action sensible en AAL1 puis AAL2. | Même règle appliquée par l'API et l'interface. |
| SEC-03 | Inspecter les tables P4.2.2 depuis un client `anon` puis `authenticated`. | Aucun accès direct non prévu ; RLS et privilèges conformes. |
| SEC-04 | Contrôler `user_account_status` et `invitation_delivery_attempts`. | RLS active ; aucune donnée secrète ; écriture backend uniquement. |
| SEC-05 | Contrôler les fonctions privilégiées de révocation/délai. | Pas d'EXECUTE pour `PUBLIC`, `anon` ou `authenticated` ; accès backend strictement nécessaire. |
| SEC-06 | Inspecter logs Edge Function, audit et DevTools. | Aucun secret, `Authorization`, lien Auth, code MFA ou réponse brute fournisseur. |
| SEC-07 | Rejouer manuellement une requête avec l'UUID d'un autre compte. | Autorisation recalculée côté serveur ; aucune BOLA/IDOR. |
| SEC-08 | Vérifier les erreurs 401, 403, 409, 429 et 503. | Messages neutres, cohérents et sans détail interne ; `Retry-After` présent pour 429. |
| SEC-09 | Contrôler les sessions après reset et suspension. | Sessions invalidées selon le parcours ; jetons anciens sans accès effectif. |
| SEC-10 | Lancer les contrôles de sécurité/advisors Supabase disponibles. | Aucun défaut nouveau lié aux tables, fonctions ou politiques P4.2.2. |

## 12. Audit attendu

Vérifier au minimum les événements suivants :

```text
role_assignments_update
user_invitation_sent
user_invitation_resent
user_invitation_resend_throttled
user_invitation_delivery_failed
password_reset_requested
user_suspended
user_reactivated
profile_updated
```

Les trois événements de renvoi ne sont attendus que pour le scénario correspondant. Chaque audit doit identifier l'acteur, la cible lorsque nécessaire, l'horodatage et le motif autorisé. Aucun audit ne doit contenir de mot de passe, lien, jeton, code/secret MFA ou adresse e-mail complète inutile.

## 13. Régressions minimales

Après les cas A à D :

1. un membre peut toujours consulter les contenus publiés ;
2. un éditeur peut accéder à son périmètre sans devenir administrateur ;
3. un modérateur peut accéder à la modération sans droit éditorial indu ;
4. un administrateur AAL2 peut encore accéder aux fonctions d'administration prévues ;
5. la connexion, la déconnexion, le mot de passe oublié et le challenge MFA restent opérationnels ;
6. les routes SPA restent accessibles après rechargement direct sur Vercel.

## 14. Nettoyage

- Réactiver tous les comptes suspendus nécessaires à la poursuite des tests.
- Retirer les rôles temporaires et révoquer les sessions de recette si nécessaire.
- Supprimer ou archiver uniquement les données et comptes explicitement préfixés `RECETTE-P422-*`.
- Ne pas supprimer l'audit soumis à la politique de rétention.
- Ne jamais utiliser de commande destructive globale ou de suppression par motif non borné.

## 15. Procès-verbal de clôture

| Indicateur | Valeur |
|---|---|
| Cas réussis | |
| Cas échoués | |
| Cas bloqués | |
| Cas non applicables | |
| Anomalies critiques | |
| Anomalies majeures | |
| Anomalies mineures | |
| Dette connue / réserve | |
| Responsable des corrections | |
| Échéance de correction | |
| Décision | |

La décision doit être signée par le responsable de recette et le responsable produit/technique. Un **GO avec réserve B02.2** doit mentionner explicitement que le renvoi transactionnel reste désactivé jusqu'à la configuration d'un domaine expéditeur vérifié et à l'exécution des cas B-02A à B-02G.
