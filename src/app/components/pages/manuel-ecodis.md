# ECODIS - Manuel Complet de l'Application
## Ecole des Disciples - Version 3.1.0

---

# TABLE DES MATIERES

1. [Presentation generale](#1-presentation-generale)
2. [Architecture technique](#2-architecture-technique)
3. [Identite visuelle et design system](#3-identite-visuelle-et-design-system)
4. [Structure des fichiers](#4-structure-des-fichiers)
5. [Authentification et roles](#5-authentification-et-roles)
6. [Navigation et ecrans principaux](#6-navigation-et-ecrans-principaux)
7. [Page d'accueil](#7-page-daccueil)
8. [Messages audio, video et texte](#8-messages-audio-video-et-texte)
9. [Page de detail d'un message](#9-page-de-detail-dun-message)
10. [Systeme de favoris](#10-systeme-de-favoris)
11. [Systeme de commentaires](#11-systeme-de-commentaires)
12. [Telechargement et lecture hors-ligne](#12-telechargement-et-lecture-hors-ligne)
13. [Recherche globale](#13-recherche-globale)
14. [Series et programmes d'etudes](#14-series-et-programmes-detudes)
15. [Administration](#15-administration)
16. [Statistiques Admin (Dashboard)](#16-statistiques-admin-dashboard)
17. [Backend et API](#17-backend-et-api)
18. [Modele de donnees (KV Store)](#18-modele-de-donnees-kv-store)
19. [Seed et donnees de demonstration](#19-seed-et-donnees-de-demonstration)
20. [Guide d'utilisation pour les utilisateurs](#20-guide-dutilisation-pour-les-utilisateurs)
21. [Guide d'utilisation pour les administrateurs](#21-guide-dutilisation-pour-les-administrateurs)
22. [Feuille de route et evolutions futures](#22-feuille-de-route-et-evolutions-futures)
23. [Hebergement et deploiement](#23-hebergement-et-deploiement)
24. [Commercialisation](#24-commercialisation)
25. [Multi-plateforme et PWA (v3.0.0)](#25-multi-plateforme-et-pwa-v300)
26. [Dashboard d'administration complet (v3.1.0)](#26-dashboard-dadministration-v310)

---

# 1. PRESENTATION GENERALE

## Qu'est-ce qu'ECODIS ?

ECODIS (Ecole des Disciples) est une application web multi-plateforme (Web, iOS, Android) de type Progressive Web App (PWA) destinee a stocker, organiser et consulter des messages chretiens sous trois formats :

- **Audio** : predications, enseignements, louanges, temoignages
- **Video** : cultes, seminaires, formations, conferences
- **Texte** : etudes bibliques, meditations, articles, notes de predication

L'application permet aux utilisateurs de :
- Parcourir et ecouter/lire des messages par categorie
- Marquer des messages en favoris
- Telecharger des contenus pour ecoute hors-ligne
- Commenter les messages
- Rechercher dans tout le catalogue
- Suivre des series structurees (programmes d'etudes) avec suivi de progression
- (Admin) Publier de nouveaux messages et gerer les utilisateurs

## Public cible

- Membres d'eglises souhaitant reacceder aux predications et enseignements
- Disciples en formation cherchant des programmes structures
- Leaders chretiens necessitant des ressources pedagogiques

---

# 2. ARCHITECTURE TECHNIQUE

## Stack technologique

| Couche | Technologie | Version |
|--------|------------|---------|
| Frontend | React | 18.3.1 |
| Routing | React Router (Data mode) | 7.13.0 |
| Styling | Tailwind CSS | 4.1.12 |
| Icones | Lucide React | 0.487.0 |
| Graphiques | Recharts | 2.x |
| Notifications | Sonner | 2.0.3 |
| Backend | Hono (Supabase Edge Function) | via npm: |
| Base de donnees | Supabase KV Store | PostgreSQL |
| Authentification | Supabase Auth | @supabase/supabase-js 2.x |
| Stockage fichiers | Supabase Storage | Bucket prive |
| Build | Vite | 6.3.5 |

## Architecture 3 tiers

```
Frontend (React SPA)
    |
    | HTTPS (fetch)
    v
Serveur (Hono Edge Function)
    |
    | Supabase SDK
    v
Base de donnees (PostgreSQL/KV Store) + Storage (Bucket prive)
```

## Points cles

- **Multi-plateforme** : PWA responsive — mobile `max-w-lg` avec bottom nav, desktop `lg:max-w-3xl` avec sidebar laterale
- **SPA** : Single Page Application avec React Router en mode Data
- **API RESTful** : toutes les requetes passent par le serveur Hono
- **Securite** : le `SUPABASE_SERVICE_ROLE_KEY` reste cote serveur uniquement
- **Offline** : Cache API + localStorage pour le telechargement hors-ligne
- **PWA-ready** : detection de plateforme (iOS/Android/Web), invite d'installation, mode standalone
- **Safe areas** : support des encoches iOS (notch, home indicator) via `env(safe-area-inset-*)`

---

# 3. IDENTITE VISUELLE ET DESIGN SYSTEM

## Palette de couleurs

| Couleur | Code | Usage |
|---------|------|-------|
| Bleu marine fonce | `#152a6b` | Couleur principale (primary), header, boutons, section audio |
| Rouge bordeaux | `#9b1b30` | Accent, section video, boutons de suppression, alertes |
| Bleu intermediaire | `#4a6fa5` | Section textes |
| Fond clair | `#f5f6fa` | Background principal |
| Blanc | `#ffffff` | Cartes, formulaires |
| Gris muted | `#e4e6ef` / `#6b7194` | Bordures, texte secondaire |
| Emeraude | `emerald-500/600` | Statuts de succes, modules termines, hors-ligne |
| Ambre | `amber-400/500` | Badges admin, recommandations |

## Variables CSS (theme.css)

Les tokens sont definis dans `/src/styles/theme.css` et exploites par Tailwind v4 :

- `--background`, `--foreground` : fond et texte principal
- `--card`, `--card-foreground` : cartes blanches
- `--primary`, `--primary-foreground` : bleu marine
- `--accent`, `--accent-foreground` : rouge bordeaux
- `--muted`, `--muted-foreground` : gris secondaire
- `--border` : `rgba(21, 42, 107, 0.1)`
- `--radius` : `0.625rem` (10px)

## Typographie

- **Police principale** : Inter (Google Fonts) avec fallback systeme
- Taille de base : 16px (`--font-size`)
- Poids : 300 (light), 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- Tailles utilisees : `text-[10px]` a `text-[20px]` pour un rendu compact mobile
- Anti-aliasing : `-webkit-font-smoothing: antialiased`

## Composants UI recurrents

- **Cartes** : `bg-card rounded-2xl border border-border shadow-sm hover:shadow-md`
- **Boutons primaires** : `bg-[#152a6b] text-white rounded-xl active:scale-[0.98]`
- **Badges** : `text-[10px] px-2.5 py-0.5 rounded-full font-semibold`
- **Loader** : `<Loader2 className="animate-spin" />`
- **Toast** : via Sonner, position `top-center`, mode `richColors`
- **Gradients** : `bg-gradient-to-br` utilises sur les boutons d'acces rapide et les en-tetes

---

# 4. STRUCTURE DES FICHIERS

```
/
├── src/
│   ├── app/
│   │   ├── App.tsx                          # Point d'entree React
│   │   ├── routes.ts                        # Configuration React Router
│   │   └── components/
│   │       ├── api.ts                       # Fonctions API (fetch vers le serveur) — 35+ fonctions
│   │       ├── auth-context.tsx             # Provider d'authentification
│   │       ├── download-context.tsx         # Provider de telechargement hors-ligne
│   │       ├── platform-utils.tsx           # Detection plateforme (iOS/Android/Web) + PWA install
│   │       ├── layout.tsx                   # Layout adaptatif (sidebar desktop + bottom nav mobile)
│   │       ├── app-header.tsx               # Header mobile (masque sur desktop)
│   │       ├── bottom-nav.tsx               # Nav mobile avec indicateur anime (masquee sur desktop)
│   │       ├── sidebar-nav.tsx              # Navigation laterale desktop (visible lg:+) — 4 liens admin
│   │       ├── pwa-install-banner.tsx       # Banniere d'invitation a installer la PWA
│   │       ├── message-card.tsx             # Carte de message reutilisable
│   │       ├── category-chip.tsx            # Filtres par categorie
│   │       ├── comments-section.tsx         # Section commentaires
│   │       ├── search-overlay.tsx           # Overlay de recherche globale
│   │       ├── figma/
│   │       │   └── ImageWithFallback.tsx    # Composant image avec fallback
│   │       └── pages/
│   │           ├── home-page.tsx            # Accueil
│   │           ├── audio-page.tsx           # Liste messages audio
│   │           ├── video-page.tsx           # Liste messages video
│   │           ├── textes-page.tsx          # Liste messages texte
│   │           ├── detail-page.tsx          # Detail d'un message
│   │           ├── profil-page.tsx          # Profil utilisateur
│   │           ├── login-page.tsx           # Connexion
│   │           ├── signup-page.tsx          # Inscription
│   │           ├── admin-page.tsx           # Admin : ajouter un message
│   │           ├── admin-users-page.tsx     # Admin : gestion utilisateurs
│   │           ├── admin-stats-page.tsx     # Admin : tableau de bord statistiques
│   │           ├── admin-dashboard-page.tsx # Admin : dashboard complet desktop (12 sections)
│   │           ├── downloads-page.tsx       # Telechargements hors-ligne
│   │           ├── series-list-page.tsx     # Liste des series
│   │           └── series-detail-page.tsx   # Detail d'une serie
│   └── styles/
│       ├── fonts.css                        # Import de polices
│       ├── index.css                        # CSS principal
│       ├── tailwind.css                     # Configuration Tailwind
│       └── theme.css                        # Design tokens
├── supabase/
│   └── functions/
│       └── server/
│           ├── index.tsx                    # Serveur Hono (routes API)
│           └── kv_store.tsx                 # Utilitaire KV Store (protege)
├── utils/
│   └── supabase/
│       └── info.tsx                         # projectId et publicAnonKey
└── package.json
```

---

# 5. AUTHENTIFICATION ET ROLES

## Flux d'authentification

### Inscription (`/signup`)
1. L'utilisateur remplit email, nom et mot de passe
2. Le frontend appelle `POST /auth/signup` sur le serveur
3. Le serveur cree l'utilisateur via `supabase.auth.admin.createUser()` avec `email_confirm: true`
4. Un enregistrement de role est cree dans le KV store (cle `role:{userId}`)
5. **Le tout premier utilisateur cree recoit automatiquement le role `admin`**
6. Les utilisateurs suivants recoivent le role `user`

### Connexion (`/login`)
1. L'utilisateur saisit email et mot de passe
2. Le frontend appelle `supabase.auth.signInWithPassword()` directement
3. Le `session.access_token` est stocke dans le contexte React
4. Les favoris et le role sont charges automatiquement

### Deconnexion
1. Appel `supabase.auth.signOut()`
2. Reset du contexte (user, session, favoris, role)

### Persistance de session
- Au chargement, `supabase.auth.getSession()` restaure la session existante
- `onAuthStateChange` met a jour l'etat en temps reel

## Systeme de roles

| Role | Capacites |
|------|-----------|
| `user` | Consulter les messages, commenter, ajouter aux favoris, telecharger, suivre les series |
| `admin` | Tout ce que `user` peut faire + publier des messages, gerer les utilisateurs, changer les roles, supprimer des commentaires |

### Verification du role
- **Frontend** : `useAuth()` expose `isAdmin` et `role`
- **Backend** : la fonction `requireAdmin(req)` verifie le token ET le role dans le KV store

### Protection des routes admin
- Le serveur renvoie 401 (non authentifie) ou 403 (non admin) si le role est insuffisant
- Le frontend affiche un ecran "Acces restreint" avec un bouton de retour

---

# 6. NAVIGATION ET ECRANS PRINCIPAUX

## Barre de navigation fixe (bottom nav)

5 onglets toujours visibles en bas de l'ecran :

| Icone | Label | Route | Description |
|-------|-------|-------|-------------|
| Home | Accueil | `/` | Tableau de bord avec stats, acces rapide, series, recents |
| Mic | Audio | `/audio` | Liste des messages audio avec filtres par categorie |
| Video | Video | `/video` | Liste des messages video avec filtres |
| FileText | Textes | `/textes` | Liste des messages texte avec filtres |
| User | Profil | `/profil` | Profil utilisateur, parametres, admin |

## Ecrans sans bottom nav (navigation par retour)

| Route | Ecran |
|-------|-------|
| `/login` | Page de connexion |
| `/signup` | Page d'inscription |
| `/message/:id` | Detail d'un message |
| `/series/:id` | Detail d'une serie |
| `/admin` | Ajouter un message |
| `/admin/users` | Gestion des utilisateurs |
| `/admin/stats` | Tableau de bord statistiques |
| `/admin/dashboard` | Dashboard d'administration complet (desktop uniquement, 12 sections) |

## Ecrans avec bottom nav (dans le Layout)

| Route | Ecran |
|-------|-------|
| `/downloads` | Telechargements hors-ligne |
| `/series` | Liste des series |

## Header fixe

- Logo ECODIS cliquable (retour a l'accueil)
- Nom "ECODIS" avec "DIS" en rouge bordeaux
- Badge "Admin" si l'utilisateur est admin
- Bouton profil (connecte) ou "Connexion" (non connecte)

---

# 7. PAGE D'ACCUEIL

**Route** : `/`

## Sections de la page d'accueil (de haut en bas)

### 1. Hero Banner
- Image de fond (Unsplash) avec overlay gradient bleu marine
- Logo ECODIS en haut a droite
- "Message du jour" avec un verset biblique (Jeremie 29:11)

### 2. Barre de recherche
- Flottante, positionnee entre le hero et les stats (`-mt-5`)
- Ouvre le `SearchOverlay` en plein ecran au tap
- Affiche le nombre total de messages

### 3. Statistiques
- 3 cartes en grille : nombre de messages Audio, Video, Texte
- Icone coloree par type
- Affiche "-" pendant le chargement

### 4. Acces rapide
- 3 boutons gradient (Audio, Video, Textes)
- Navigation directe vers les pages de listing

### 5. Series & Programmes (nouveau)
- Titre avec icone Layers et lien "Voir tout" vers `/series`
- Carrousel horizontal de cartes de series (max 4)
- Chaque carte : image de couverture, badge "X modules", titre, auteur
- N'apparait que si des series existent

### 6. Messages recents
- 4 derniers messages toutes categories
- Chaque item : icone type, titre, auteur, date
- Clic = navigation vers `/message/:id`

## Donnees chargees
- `seedData()` est appele au premier chargement pour s'assurer que les messages de demo existent
- `fetchMessages()` et `fetchAllSeries()` sont charges en parallele

---

# 8. MESSAGES AUDIO, VIDEO ET TEXTE

## Pages de listing

### Page Audio (`/audio`)
- **Filtres** : Tout, Predications, Enseignements, Louanges, Temoignages
- **Recherche** : barre de recherche locale sur le titre
- **Cartes** : mini-lecteur avec bouton play, barre de progression, duree
- **Actions** : J'aime/Favori, compteur de commentaires, Partager

### Page Video (`/video`)
- **Filtres** : Tout, Cultes, Seminaires, Formations, Conferences
- **Recherche** : barre de recherche locale
- **Cartes** : vignette video avec overlay play, badge duree, badge hors-ligne
- **Actions** : J'aime/Favori, compteur de commentaires, Partager

### Page Textes (`/textes`)
- **Filtres** : Tout, Etudes bibliques, Meditations, Articles, Notes de predication
- **Recherche** : barre de recherche locale
- **Cartes** : titre, auteur, date, apercu du texte (3 lignes)
- **Actions** : J'aime/Favori, compteur de commentaires, Partager

## Composant MessageCard

Composant reutilisable (`/src/app/components/message-card.tsx`) qui s'adapte au type :

- **Audio** : affiche un mini-lecteur avec bouton play et barre de progression
- **Video** : affiche une vignette avec overlay play central et badge de duree
- **Texte** : affiche un apercu textuel (line-clamp-3)

Props : `type`, `title`, `author`, `date`, `duration`, `description`, `thumbnail`, `liked`, `messageId`, `commentCount`

Badges additionnels :
- Badge "Hors-ligne" (vert emeraude avec icone WifiOff) si le message est telecharge

---

# 9. PAGE DE DETAIL D'UN MESSAGE

**Route** : `/message/:id` (accepte aussi `?series={seriesId}` en parametre)

## Structure de la page

### Header fixe
- Bouton retour (fleche gauche)
- Titre du message (tronque)
- Badge hors-ligne si telecharge
- Icone de type (pastille coloree)

### Bandeau de serie (conditionnel)
Affiche si le message appartient a une serie :
- Icone Layers + nom de la serie (cliquable vers `/series/:id`)
- "Module X/N"
- Mini barre de progression par segments colores :
  - Vert : modules precedents
  - Bleu marine : module actuel
  - Gris clair : modules suivants

### Lecteur video
Pour les messages video :
- Zone aspect-video avec fond noir
- Lecteur natif `<video>` avec controles custom
- Barre de progression (seek)
- Boutons : Play/Pause, timestamp, Mute, Plein ecran
- Si aucun fichier : vignette avec overlay "Aucun fichier video attache"

### Lecteur audio
Pour les messages audio :
- Zone gradient bleu marine
- Disque anime (rotation quand lecture en cours)
- Badge hors-ligne sur le disque
- Barre de progression (seek)
- Controles : Skip -15s, Play/Pause (gros bouton blanc), Skip +15s
- Bouton mute
- Si aucun fichier : message "Aucun fichier audio attache"

### Contenu textuel
Pour les 3 types :
- Titre complet
- Auteur (lien colore) + date de publication
- Badge categorie (colore par type) + badge duree
- Description / contenu du texte

### Bouton de telechargement (audio/video uniquement)
3 etats possibles :
1. **Non telecharge** : bouton "Telecharger pour ecoute hors-ligne"
2. **En cours** : barre de progression avec pourcentage ou pulsation
3. **Telecharge** : badge vert "Disponible hors-ligne" + bouton supprimer

### Bouton "Marquer comme termine" (contexte serie)
Si le message fait partie d'une serie et l'utilisateur est connecte :
- Bouton vert "Marquer ce module comme termine"
- Une fois clique : badge vert "Module termine"
- Notification toast de felicitations si la serie est terminee

### Actions
- **J'aime / Favori** : coeur rouge quand active
- **Partager** : utilise l'API Web Share native

### Navigation serie (precedent/suivant)
Si le message fait partie d'une serie :
- Section "Navigation dans la serie" avec icone Layers
- 2 boutons en grille : "Precedent" et "Suivant"
- Chaque bouton affiche le titre du message adjacent
- Navigation preservee dans la serie via `?series={id}`

### Section commentaires
Composant `CommentsSection` integre (voir section 11)

## Detection automatique de la serie

1. Si `?series={id}` est dans l'URL : utilise cette serie
2. Sinon : appelle `GET /messages/:id/series` pour trouver la serie
3. Charge les messages de la serie pour la navigation prev/next

---

# 10. SYSTEME DE FAVORIS

## Fonctionnement

- **Toggle** : un clic sur le coeur ajoute/retire le message des favoris
- **Persistance** : stocke dans le KV store avec cle `fav:{userId}:{messageId}`
- **Synchronisation** : les favoris sont charges au login et mis a jour en temps reel dans le contexte

## Points d'acces

- **Cartes de messages** : icone coeur dans chaque `MessageCard`
- **Page de detail** : bouton "J'aime" / "Favori" dans la barre d'actions
- **Profil** : compteur de favoris dans les stats et dans le menu

## API

| Methode | Route | Description |
|---------|-------|-------------|
| POST | `/favorites/toggle` | Ajoute ou retire un favori |
| GET | `/favorites` | Liste les IDs des messages favoris de l'utilisateur |

## Securite

- Requiert un `accessToken` valide
- Chaque utilisateur ne peut gerer que ses propres favoris

---

# 11. SYSTEME DE COMMENTAIRES

## Fonctionnement

- Les commentaires sont affiches sous chaque message dans la page de detail
- Chaque commentaire inclut : avatar colore (initiales), nom, date relative, texte
- Les commentaires sont tries du plus recent au plus ancien

## Ecrire un commentaire

- Zone de texte avec avatar de l'utilisateur
- Bouton d'envoi (icone Send)
- Requiert d'etre connecte (sinon, bouton "Connectez-vous pour commenter")

## Supprimer un commentaire

- Un utilisateur peut supprimer ses propres commentaires
- Un admin peut supprimer n'importe quel commentaire
- Confirmation visuelle par toast

## Dates relatives

Format intelligent :
- "A l'instant" (< 1 min)
- "Il y a X min" (< 60 min)
- "Il y a Xh" (< 24h)
- "Il y a Xj" (< 7 jours)
- Date complete sinon

## API

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/messages/:id/comments` | Liste les commentaires d'un message |
| POST | `/messages/:id/comments` | Ajoute un commentaire |
| DELETE | `/comments/:messageId/:commentId` | Supprime un commentaire |
| GET | `/comments/counts` | Compteurs de commentaires pour les cartes |

---

# 12. TELECHARGEMENT ET LECTURE HORS-LIGNE

## Architecture

Le systeme hors-ligne repose sur 3 mecanismes :

1. **Cache API** : stocke les fichiers media dans un cache nomme `ecodis-offline-media-v1`
2. **localStorage** : stocke les metadonnees des telechargements (cle `ecodis-downloads`)
3. **Object URLs** : URLs temporaires generees pour la lecture des fichiers caches

## Provider `DownloadContext`

Expose via `useDownloads()` :

| Propriete/Methode | Description |
|-------------------|-------------|
| `downloads` | Liste des messages telecharges |
| `activeDownloads` | Telechargements en cours avec progression |
| `storageUsed` | Espace utilise (octets) |
| `storageQuota` | Quota total disponible |
| `isDownloaded(id)` | Verifie si un message est telecharge |
| `getOfflineUrl(id)` | Retourne l'URL offline d'un message |
| `downloadMessage(msg)` | Telecharge un message |
| `removeDownload(id)` | Supprime un telechargement |
| `clearAllDownloads()` | Supprime tout |
| `refreshStorage()` | Rafraichit les infos de stockage |

## Processus de telechargement

1. Fetch du fichier media avec suivi de progression (streaming)
2. Stockage dans le Cache API sous la cle `offline-media-{messageId}`
3. Generation d'un Object URL pour lecture immediate
4. Sauvegarde des metadonnees dans localStorage
5. Notification toast de succes

## Page de telechargements (`/downloads`)

- **Vue du stockage** : barre de progression avec pourcentage et code couleur
  - Vert/bleu : < 50%
  - Ambre : 50-80%
  - Rouge : > 80%
  - Alerte visuelle si > 80%
- **Liste par type** : sections Audio et Video separees
- **Actions** : lien vers le message, suppression individuelle, suppression globale avec confirmation
- **Etat vide** : illustration + bouton "Explorer les messages"

## Restauration au rechargement

Au montage du `DownloadProvider`, les Object URLs sont regenerees a partir du cache pour tous les fichiers precedemment telecharges. Les metadonnees invalides (fichiers supprimes du cache) sont nettoyees.

---

# 13. RECHERCHE GLOBALE

## Composant `SearchOverlay`

Overlay plein ecran (`fixed inset-0 z-[100]`) active depuis la barre de recherche de l'accueil.

## Fonctionnalites

### Recherche en temps reel
- Filtre sur : titre, auteur, categorie, description
- Mise a jour instantanee a chaque frappe
- Insensible a la casse

### Onglets avec compteurs
- **Tous** : tous les resultats
- **Audio** : filtres par type audio
- **Video** : filtres par type video
- **Textes** : filtres par type text
- Chaque onglet affiche le nombre de resultats

### Surlignage des termes
Les termes recherches sont surlightes en jaune (`bg-amber-200/80`) dans les titres, auteurs et descriptions des resultats.

### Resultats groupes
En onglet "Tous", les resultats sont groupes par type avec un en-tete colore :
- Audio (bleu marine)
- Video (rouge bordeaux)
- Textes (bleu intermediaire)

### Historique des recherches
- Stocke dans localStorage (cle `ecodis-search-history`)
- Maximum 8 entrees (FIFO)
- Affiche avec icone horloge au lancement
- Suppression individuelle ou globale
- Clic sur un terme = relance la recherche

### Suggestions
- Categories existantes (max 6)
- Auteurs existants (max 4)
- Chips cliquables pour lancer une recherche rapide

## Navigation
- Clic sur un resultat = navigation vers `/message/:id`
- La recherche est ajoutee a l'historique
- Le scroll du body est verrouille pendant l'overlay

---

# 14. SERIES ET PROGRAMMES D'ETUDES

## Concept

Les series regroupent des messages dans un ordre specifique pour creer un parcours d'apprentissage structure. Chaque serie a :

- Un titre et une description
- Un auteur et une categorie
- Une image de couverture
- Une liste ordonnee de messages (modules)
- Un suivi de progression par utilisateur

## Modele de donnees

### Serie (`series:{id}`)
```json
{
  "id": "series-1",
  "title": "Formation des leaders",
  "description": "...",
  "coverImage": "https://...",
  "author": "Frere Paul",
  "category": "Formation",
  "messageIds": ["seed-9", "seed-8", "seed-10"],
  "totalModules": 3,
  "createdAt": "2026-02-10T10:00:00Z",
  "updatedAt": "2026-02-10T10:00:00Z"
}
```

### Progression (`sprogress:{userId}:{seriesId}`)
```json
{
  "userId": "user-uuid",
  "seriesId": "series-1",
  "completedMessageIds": ["seed-9", "seed-8"],
  "lastAccessedAt": "2026-02-28T14:00:00Z"
}
```

## Page liste des series (`/series`)

### Section "Recommande pour vous"
- Grande carte gradient bleu marine avec image de couverture
- Logique de recommandation : premiere serie non commencee, sinon premiere en cours
- Badge categorie + nombre de modules
- Barre de progression si commencee

### Sections categorisees
Les series sont groupees en 3 sections :
1. **En cours** (icone BookOpen, bleu) : progression > 0% et < 100%
2. **A decouvrir** (icone Layers, bleu intermediaire) : progression 0%
3. **Terminees** (icone Trophy, ambre) : progression 100%

### Cartes de series
Chaque carte affiche :
- Vignette de couverture (ou placeholder)
- Titre et auteur
- Nombre de modules
- Barre de progression avec compteur "X/Y termines"
- Icone trophee si terminee
- Fleche de navigation

## Page detail d'une serie (`/series/:id`)

### Header immersif
- Image de couverture en fond (opacite 30%) avec gradient
- Bouton retour
- Badge "Serie"
- Badge categorie + modules
- Titre et auteur

### Carte de progression
- Barre de progression animee (width transition 500ms)
- Pourcentage ou badge "Terminee !" avec trophee
- Compteur "X sur Y modules termines"

### Description
- Texte descriptif de la serie

### Bouton Commencer/Continuer
- Bouton bleu marine pleine largeur
- Texte : "Commencer" si 0% ou "Continuer" si en cours
- Affiche le titre du prochain module non termine
- Navigue vers `/message/:id?series={seriesId}`

### Liste des modules
Chaque module dans une carte avec :
- **Numero/Check** : cercle numerote (gris/bleu/vert)
  - Gris : non commence
  - Bleu marine : module actuel
  - Vert (CheckCircle2) : termine
- **Ligne connectrice** entre les modules
- **Icone de type** : badge colore (audio/video/texte)
- **Titre et metadonnees** : auteur, duree
- **Actions** :
  - Cercle vide (clic = marquer comme termine)
  - Fleche droite (clic = naviguer vers le message)

### Mise en evidence du module actuel
- Bordure bleue + ring
- Contraste visuel avec les modules termines (fond vert clair) et non commences

## Navigation dans la serie (page de detail)

Quand un message fait partie d'une serie :

1. **Bandeau serie** en haut du contenu : nom de la serie, position, mini barre de progression
2. **Bouton "Marquer comme termine"** : permet de valider le module sans le quitter
3. **Navigation prev/next** : 2 boutons en bas avec le titre du message adjacent
4. L'URL contient `?series={id}` pour maintenir le contexte

## API Series

| Methode | Route | Description |
|---------|-------|-------------|
| GET | `/series` | Liste toutes les series |
| GET | `/series/:id` | Detail d'une serie avec ses messages |
| POST | `/series` | Creer une serie (admin) |
| PUT | `/series/:id` | Modifier une serie (admin) |
| DELETE | `/series/:id` | Supprimer une serie (admin) |
| GET | `/series/:id/progress` | Progression de l'utilisateur |
| POST | `/series/:id/progress` | Marquer un module comme termine |
| GET | `/series-progress` | Toutes les progressions de l'utilisateur |
| GET | `/messages/:id/series` | Trouver les series d'un message |

---

# 15. ADMINISTRATION

## Acces admin

Accessible depuis la page profil pour les utilisateurs avec le role `admin` :
- Badge "Admin" avec couronne doree dans le header
- Section "Administration" dans le profil avec 4 liens :
  - **Dashboard (Desktop)** (icone LayoutDashboard, fond bleu marine) -> `/admin/dashboard`
  - **Ajouter un message** (icone Plus, fond bleu marine) -> `/admin`
  - **Gestion des utilisateurs** (icone Users, fond rouge bordeaux) -> `/admin/users`
  - **Tableau de bord** (icone BarChart3, fond ambre) -> `/admin/stats`

### Sidebar desktop (4 liens admin)

Sur desktop (>= 1024px), la sidebar affiche une section "Administration" avec :
  - **Dashboard** (icone LayoutDashboard) -> `/admin/dashboard`
  - **Ajouter** (icone Plus) -> `/admin`
  - **Utilisateurs** (icone Users) -> `/admin/users`
  - **Statistiques** (icone BarChart3) -> `/admin/stats`

## Ajouter un message (`/admin`)

### Formulaire
1. **Type de message** : selecteur 3 boutons (Audio, Video, Texte) avec icone et couleur
2. **Titre** (obligatoire)
3. **Auteur** (obligatoire)
4. **Categorie** (obligatoire) : chips filtrees par type selectionne
5. **Duree** (audio/video) : format libre (ex: "45:30")
6. **URL de vignette** (video) : URL d'image
7. **Description / Contenu** : textarea (obligatoire pour texte, optionnel sinon)
8. **Fichier media** (audio/video) : upload avec drag zone, affichage du nom et taille

### Processus
1. Construction d'un `FormData`
2. Upload du fichier vers Supabase Storage (bucket prive)
3. Creation du message dans le KV store
4. Notification de succes
5. Reset du formulaire

## Gestion des utilisateurs (`/admin/users`)

### Fonctionnalites
- **Liste** : tous les utilisateurs avec email, nom, role, date de creation, derniere connexion
- **Recherche** : filtre par nom ou email
- **Modifier le role** : basculer entre "user" et "admin"
- **Supprimer un utilisateur** : avec confirmation

### Protections
- Un admin ne peut pas retirer son propre role admin
- Un admin ne peut pas supprimer son propre compte
- Les actions destructives necessitent une confirmation

---

# 16. STATISTIQUES ADMIN (DASHBOARD)

## Acces

**Route** : `/admin/stats`

Accessible depuis **Profil > Administration > Tableau de bord**. Reserve aux utilisateurs avec le role `admin`. Les utilisateurs non autorises voient un ecran "Acces reserve aux administrateurs" avec bouton de retour.

## Header

- Bouton retour (fleche gauche)
- Icone graphique + titre "Tableau de bord"
- Bouton rafraichir (icone rotation) pour recharger les stats a la demande

## KPI principaux (6 cartes)

Premiere rangee (grille 2 colonnes) :
| Carte | Icone | Couleur | Donnee |
|-------|-------|---------|--------|
| Utilisateurs | Users | Bleu marine | Nombre total d'utilisateurs inscrits (via Supabase Auth) |
| Messages | MessageSquare | Bleu intermediaire | Nombre total de messages publies |
| Favoris | Heart | Rouge bordeaux | Nombre total de favoris toutes confondues |
| Commentaires | MessageSquare | Emeraude | Nombre total de commentaires |

Seconde rangee (grille 2 colonnes) :
| Carte | Icone | Couleur | Donnee |
|-------|-------|---------|--------|
| Engagement | Percent | Ambre | Taux d'engagement (commenteurs + likers uniques / utilisateurs) |
| Series | Layers | Violet | Nombre de series + total d'inscrits |

## Graphique d'activite (AreaChart)

- **Plage temporelle** : selecteur 7j / 14j / 30j
- **3 courbes** avec remplissage gradient :
  - **Commentaires** (bleu marine) : nombre de commentaires par jour
  - **Favoris** (rouge bordeaux) : nombre de favoris ajoutes par jour
  - **Inscriptions** (emeraude) : nombre de nouveaux utilisateurs par jour
- **Tooltip** personnalise avec date et valeurs
- **Legende** sous le graphique avec pastilles de couleur
- Les donnees couvrent les 30 derniers jours cote serveur, filtrees cote client

## Repartition par type (PieChart)

- **Donut chart** a 3 segments : Audio, Video, Texte
- Couleurs : bleu marine / rouge bordeaux / bleu intermediaire
- **A droite** : legende detaillee avec nom du type, nombre de messages et pourcentage

## Messages par categorie (BarChart horizontal)

- Barres horizontales pour les 8 categories les plus representees
- Noms tronques a 14 caracteres si necessaire
- Tooltip avec nombre exact de messages

## Messages les plus aimes (Top 5)

- Liste cliquable (navigation vers `/message/:id`)
- Chaque item : rang, icone type coloree, titre (tronque), auteur, compteur de coeurs
- Icone coeur rouge avec nombre a droite

## Messages les plus commentes (Top 5)

- Meme structure que "les plus aimes"
- Icone commentaire bleu marine avec nombre a droite

## Auteurs les plus actifs (Top 5)

- Nom de l'auteur avec barre de progression proportionnelle
- Nombre de messages publie a droite
- Barre ambre avec ratio relatif (le premier a 100%)

## Membres les plus actifs (Top 5)

- Avatar rond avec initiales (fond emeraude)
- Nom du membre
- Nombre de commentaires a droite

## Progression des series

- Liste de toutes les series, chacune cliquable (navigation vers `/series/:id`)
- Icone Layers violet
- Informations par serie : nombre de modules, nombre d'inscrits, nombre de termines (icone trophee)

## API Backend

| Methode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/admin/stats` | Admin | Statistiques agreguees (KPIs, classements, timeline d'activite) |

### Structure de la reponse `GET /admin/stats`

```json
{
  "stats": {
    "totals": {
      "users": 42,
      "messages": 16,
      "comments": 128,
      "favorites": 89,
      "series": 3
    },
    "messagesByType": { "audio": 6, "video": 4, "text": 6 },
    "messagesByCategory": { "Predications": 2, "Enseignements": 2, ... },
    "topFavorited": [
      { "messageId": "seed-1", "title": "...", "author": "...", "type": "audio", "favoriteCount": 12 }
    ],
    "topCommented": [
      { "messageId": "seed-7", "title": "...", "author": "...", "type": "video", "commentCount": 8 }
    ],
    "topAuthors": [
      { "author": "Pasteur Jean", "messageCount": 5 }
    ],
    "topCommenters": [
      { "userId": "...", "name": "Jean", "commentCount": 15 }
    ],
    "activityTimeline": [
      { "date": "2026-02-01", "comments": 3, "favorites": 5, "signups": 1 }
    ],
    "messagesByDay": { "2026-02-28": 2 },
    "engagementRate": 65,
    "uniqueCommenters": 12,
    "uniqueFavoriters": 18,
    "seriesStats": [
      { "seriesId": "series-1", "title": "...", "totalModules": 3, "enrolled": 8, "completed": 2 }
    ]
  }
}
```

### Calcul du taux d'engagement

```
engagementRate = ((uniqueCommenters + uniqueFavoriters) / (totalUsers * 2)) * 100
```

Ce taux mesure la proportion d'utilisateurs qui ont interagi (commente ou like) par rapport au maximum theorique (si tous commentaient ET likaient).

## Consulter le tableau de bord statistiques

1. Aller dans **Profil > Tableau de bord** (ou `/admin/stats`)
2. Les statistiques sont chargees automatiquement depuis le serveur
3. Consulter les **KPI** en haut de page : utilisateurs, messages, favoris, commentaires, taux d'engagement, series
4. Analyser le **graphique d'activite** : basculer entre 7, 14 ou 30 jours pour observer les tendances
5. Examiner la **repartition par type** (donut) et par **categorie** (barres horizontales)
6. Identifier les **messages les plus populaires** (favoris et commentaires)
7. Reperer les **auteurs les plus prolifiques** et les **membres les plus actifs**
8. Suivre la **progression des series** : nombre d'inscrits et de completions
9. Utiliser le **bouton rafraichir** en haut a droite pour recharger les donnees

### Indicateurs cles a surveiller

- **Taux d'engagement** : un taux eleve (> 50%) indique une communaute active
- **Ratio commentaires/favoris** : les commentaires signalent un engagement plus profond
- **Inscriptions quotidiennes** : suivre la croissance de la communaute
- **Completion des series** : mesurer l'efficacite des programmes d'etude

---

# 17. BACKEND ET API

## Serveur Hono

Le serveur est defini dans `/supabase/functions/server/index.tsx` et deploye comme Supabase Edge Function.

### Configuration
- **Prefix** : `/make-server-1c1fff69`
- **CORS** : ouvert (`origin: "*"`)
- **Logger** : `logger(console.log)`
- **Bucket** : `make-1c1fff69-media` (prive, cree au demarrage)

### Authentification
- Token dans le header `Authorization: Bearer {token}`
- Fonction `getUser(req)` : extrait et verifie le token via Supabase Auth
- Fonction `getUserRole(userId)` : lit le role dans le KV store
- Fonction `requireAdmin(req)` : combine les deux verifications

## Routes API completes

### Authentification
| Methode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/auth/signup` | Non | Inscription |

### Roles et utilisateurs
| Methode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/users/me/role` | Oui | Role de l'utilisateur courant |
| GET | `/users` | Admin | Liste tous les utilisateurs |
| PUT | `/users/:id/role` | Admin | Modifier un role |
| DELETE | `/users/:id` | Admin | Supprimer un utilisateur |

### Messages
| Methode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/messages` | Non | Lister (filtre optionnel `?type=`) |
| GET | `/messages/:id` | Non | Detail avec signed URL |
| POST | `/messages` | Admin | Creer (FormData) |
| DELETE | `/messages/:id` | Admin | Supprimer |

### Favoris
| Methode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/favorites/toggle` | Oui | Toggle favori |
| GET | `/favorites` | Oui | Liste des IDs favoris |

### Commentaires
| Methode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/messages/:id/comments` | Non | Commentaires d'un message |
| POST | `/messages/:id/comments` | Oui | Ajouter un commentaire |
| DELETE | `/comments/:msgId/:cmtId` | Oui* | Supprimer (* propre ou admin) |
| GET | `/comments/counts` | Non | Compteurs pour les cartes |

### Series
| Methode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/series` | Non | Lister toutes les series |
| GET | `/series/:id` | Non | Detail avec messages |
| POST | `/series` | Admin | Creer |
| PUT | `/series/:id` | Admin | Modifier |
| DELETE | `/series/:id` | Admin | Supprimer |
| GET | `/series/:id/progress` | Oui | Progression utilisateur |
| POST | `/series/:id/progress` | Oui | Marquer module termine |
| GET | `/series-progress` | Oui | Toutes les progressions |
| GET | `/messages/:id/series` | Non | Series d'un message |

### Administration avancee (v3.1.0)
| Methode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/admin/config` | Admin | Recuperer la configuration de l'application |
| PUT | `/admin/config` | Admin | Mettre a jour la configuration (log audit automatique) |
| GET | `/admin/audit-log` | Admin | Lister les 200 derniers evenements d'audit |
| DELETE | `/admin/audit-log` | Admin | Effacer tous les logs d'audit |
| GET | `/admin/storage` | Admin | Statistiques de stockage media (fichiers, tailles) |
| POST | `/admin/messages/bulk-delete` | Admin | Suppression groupee de messages |
| PUT | `/messages/:id` | Admin | Mise a jour d'un message existant |
| GET | `/admin/health` | Admin | Verification de sante du systeme (DB, Auth, Storage) |
| GET | `/admin/categories` | Admin | Lister les categories personnalisees |
| PUT | `/admin/categories` | Admin | Mettre a jour les categories |
| GET | `/admin/announcements` | Admin | Lister les annonces |
| POST | `/admin/announcements` | Admin | Creer une annonce |
| DELETE | `/admin/announcements/:id` | Admin | Supprimer une annonce |
| GET | `/admin/export` | Admin | Exporter les donnees en JSON (param `?type=users|messages|all`) |

### Utilitaires
| Methode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/seed` | Non | Initialisation des donnees de demo |
| GET | `/health` | Non | Health check |
| GET | `/admin/stats` | Admin | Statistiques agreguees (KPIs, classements, timeline d'activite) |

## Module API frontend (`api.ts`)

Le fichier `/src/app/components/api.ts` centralise tous les appels au serveur :

- `getHeaders(token?)` : en-tetes avec Authorization
- `jsonHeaders(token?)` : en-tetes JSON + Authorization
- Chaque fonction gere ses erreurs avec `try/catch` et `console.error`
- Les fonctions de lecture retournent des valeurs par defaut en cas d'erreur (tableau vide, null, etc.)
- Les fonctions d'ecriture propagent les erreurs (`throw`)

### Fonctions disponibles

| Fonction | Auth | Description |
|----------|------|-------------|
| `seedData()` | Non | Initialise les donnees de demo |
| `fetchMessages(type?)` | Non | Liste les messages (optionnel: filtre par type) |
| `fetchMessage(id)` | Non | Detail d'un message avec signed URL |
| `createMessage(formData, token)` | Admin | Creer un message (FormData) |
| `deleteMessage(id, token)` | Admin | Supprimer un message |
| `toggleFavorite(messageId, token)` | Oui | Ajouter/retirer un favori |
| `fetchFavorites(token)` | Oui | Liste des IDs favoris |
| `signupUser(email, password, name)` | Non | Inscription |
| `fetchUserRole(token)` | Oui | Role de l'utilisateur courant |
| `fetchAllUsers(token)` | Admin | Liste de tous les utilisateurs |
| `updateUserRole(userId, role, token)` | Admin | Modifier un role |
| `deleteUser(userId, token)` | Admin | Supprimer un utilisateur |
| `fetchComments(messageId)` | Non | Commentaires d'un message |
| `addComment(messageId, text, token)` | Oui | Ajouter un commentaire |
| `deleteComment(messageId, commentId, token)` | Oui | Supprimer un commentaire |
| `fetchCommentCounts()` | Non | Compteurs de commentaires |
| `fetchAllSeries()` | Non | Liste de toutes les series |
| `fetchSeries(id)` | Non | Detail d'une serie avec messages |
| `fetchSeriesProgress(seriesId, token)` | Oui | Progression utilisateur |
| `markSeriesProgress(seriesId, messageId, token)` | Oui | Marquer un module termine |
| `fetchAllSeriesProgress(token)` | Oui | Toutes les progressions |
| `fetchMessageSeries(messageId)` | Non | Series contenant un message |
| `createSeries(data, token)` | Admin | Creer une serie |
| `deleteSeries(id, token)` | Admin | Supprimer une serie |
| `fetchAdminStats(token)` | Admin | Statistiques agreguees (retourne `AdminStats`) |
| `fetchAppConfig(token)` | Admin | Recuperer la configuration de l'application |
| `updateAppConfig(config, token)` | Admin | Mettre a jour la configuration |
| `fetchAuditLogs(token)` | Admin | Lister les evenements d'audit |
| `clearAuditLogs(token)` | Admin | Effacer tous les logs d'audit |
| `fetchStorageStats(token)` | Admin | Statistiques des fichiers media |
| `bulkDeleteMessages(ids, token)` | Admin | Suppression groupee de messages |
| `updateMessage(id, updates, token)` | Admin | Mise a jour d'un message existant |
| `fetchSystemHealth(token)` | Admin | Sante du systeme (DB, Auth, Storage) |
| `fetchCategories(token)` | Admin | Lister les categories personnalisees |
| `updateCategories(categories, token)` | Admin | Mettre a jour les categories |
| `fetchAnnouncements(token)` | Admin | Lister les annonces |
| `createAnnouncement(data, token)` | Admin | Creer une annonce |
| `deleteAnnouncement(id, token)` | Admin | Supprimer une annonce |
| `exportDataAsJson(type, token)` | Admin | Exporter les donnees (users, messages, all) |

### Interface `AdminStats`

Type TypeScript definissant la structure des statistiques retournees par `fetchAdminStats()` :

- `totals` : compteurs globaux (users, messages, comments, favorites, series)
- `messagesByType` : repartition audio/video/text
- `messagesByCategory` : compteurs par categorie
- `topFavorited` / `topCommented` : classements de messages (top 10)
- `topAuthors` / `topCommenters` : classements d'auteurs et de membres (top 5)
- `activityTimeline` : activite jour par jour sur 30 jours
- `engagementRate` / `uniqueCommenters` / `uniqueFavoriters` : metriques d'engagement
- `seriesStats` : progression par serie (inscrits, termines)

### Interface `AppUser`

Type TypeScript pour les utilisateurs retournes par `fetchAllUsers()` :

- `id` : identifiant unique
- `email` : adresse email
- `name` : nom affiche
- `role` : `"admin"` ou `"user"`
- `createdAt` : date de creation
- `lastSignIn` : derniere connexion

### Interface `AppConfig`

Voir section 26 pour le detail complet.

### Interface `AuditLog`

Voir section 26 pour le detail complet.

### Interface `StorageStats`

Type TypeScript pour les statistiques de stockage :

- `totalFiles` : nombre total de fichiers
- `totalSize` : taille totale en octets
- `audioFiles` / `audioSize` : nombre et taille des fichiers audio
- `videoFiles` / `videoSize` : nombre et taille des fichiers video
- `files[]` : liste detaillee (name, folder, size, mimetype, createdAt)

### Interface `SystemHealth`

Type TypeScript pour l'etat de sante du systeme :

- `status` : `"healthy"` | `"degraded"` | `"down"`
- `uptime` : temps de fonctionnement
- `serverVersion` : version du serveur
- `dbConnected` / `storageConnected` / `authServiceUp` : statut des services
- `lastChecked` : date de derniere verification
- `memoryUsage` : utilisation memoire
- `kvEntries` : nombre d'entrees dans le KV store

### Interface `Announcement`

Type TypeScript pour les annonces :

- `id` : identifiant unique
- `title` : titre de l'annonce
- `message` : contenu
- `type` : `"info"` | `"warning"` | `"success"`
- `active` : annonce active ou non
- `createdAt` : date de creation
- `expiresAt` : date d'expiration (nullable)

---

# 18. MODELE DE DONNEES (KV STORE)

Toutes les donnees sont stockees dans une table PostgreSQL `kv_store_1c1fff69` via les fonctions utilitaires du fichier `kv_store.tsx`.

## Schema des cles

| Pattern de cle | Type | Description |
|---------------|------|-------------|
| `msg:{id}` | Message | Un message (audio/video/texte) |
| `msg_counter` | number | Compteur auto-increment pour les IDs |
| `fav:{userId}:{messageId}` | Favori | Lien favori utilisateur-message |
| `role:{userId}` | Role | Role d'un utilisateur (admin/user) |
| `cmt:{messageId}:{commentId}` | Commentaire | Un commentaire sur un message |
| `comment_counter` | number | Compteur auto-increment pour les commentaires |
| `series:{id}` | Serie | Une serie / programme d'etude |
| `series_counter` | number | Compteur auto-increment pour les series |
| `sprogress:{userId}:{seriesId}` | Progression | Progression d'un utilisateur dans une serie |
| `config:app` | AppConfig | Configuration globale de l'application (v3.1.0) |
| `audit:{id}` | AuditLog | Evenement d'audit (action, utilisateur, description, metadata) |
| `audit_counter` | number | Compteur auto-incremente pour les IDs d'audit |
| `config:categories` | string[] | Liste des categories personnalisees |
| `announcement:{id}` | Announcement | Annonce publiee par un admin |
| `announcement_counter` | number | Compteur auto-incremente pour les IDs d'annonces |

## Operations KV utilisees

| Fonction | Description |
|----------|-------------|
| `kv.get(key)` | Lire une valeur |
| `kv.set(key, value)` | Ecrire une valeur |
| `kv.del(key)` | Supprimer une valeur |
| `kv.mget(keys)` | Lire plusieurs valeurs |
| `kv.mset(keys, values)` | Ecrire plusieurs valeurs |
| `kv.mdel(keys)` | Supprimer plusieurs valeurs |
| `kv.getByPrefix(prefix)` | Lire toutes les valeurs dont la cle commence par le prefix |

---

# 19. SEED ET DONNEES DE DEMONSTRATION

## Declenchement

Le seed est appele automatiquement au chargement de la page d'accueil via `seedData()`. Il est **idempotent** : si des messages existent deja, il ne les recree pas.

## Messages de demo (16 messages)

### Audio (6 messages, IDs seed-1 a seed-6)
| ID | Titre | Auteur | Categorie |
|----|-------|--------|-----------|
| seed-1 | La puissance de la priere dans la vie du disciple | Pasteur Jean | Predications |
| seed-2 | Comment etudier la Bible efficacement | Pasteur Marie | Enseignements |
| seed-3 | Louange et adoration : une arme spirituelle | Frere David | Louanges |
| seed-4 | Mon temoignage de conversion | Soeur Ruth | Temoignages |
| seed-5 | La foi qui deplace les montagnes | Pasteur Jean | Predications |
| seed-6 | Les dons du Saint-Esprit | Pasteur Esther | Enseignements |

### Video (4 messages, IDs seed-7 a seed-10)
| ID | Titre | Auteur | Categorie |
|----|-------|--------|-----------|
| seed-7 | Culte dominical - Marcher dans la foi | Pasteur Jean | Cultes |
| seed-8 | Seminaire sur le discipulat - Session 1 | Pasteur Marie | Seminaires |
| seed-9 | Formation des leaders - Module 3 | Frere Paul | Formations |
| seed-10 | Conference annuelle - L'appel de Dieu | Evangeliste Samuel | Conferences |

### Texte (6 messages, IDs seed-11 a seed-16)
| ID | Titre | Auteur | Categorie |
|----|-------|--------|-----------|
| seed-11 | Les beatitudes : un chemin de bonheur | Pasteur Jean | Etudes bibliques |
| seed-12 | Meditation du matin : Psaume 23 | Soeur Ruth | Meditations |
| seed-13 | Comment devenir un disciple engage | Pasteur Marie | Articles |
| seed-14 | Notes : La grace suffisante de Dieu | Frere Paul | Notes de predication |
| seed-15 | L'importance de la communion fraternelle | Pasteur Esther | Articles |
| seed-16 | Etude : Le livre des Actes - Chapitre 2 | Pasteur Jean | Etudes bibliques |

## Series de demo (3 series)

| ID | Titre | Auteur | Messages inclus | Type dominant |
|----|-------|--------|----------------|---------------|
| series-1 | Formation des leaders | Frere Paul | seed-9, seed-8, seed-10 | Video |
| series-2 | Fondements de la foi chretienne | Pasteur Jean | seed-1, seed-5, seed-2, seed-6 | Audio |
| series-3 | Etudes bibliques essentielles | Pasteur Jean | seed-11, seed-16, seed-13, seed-15 | Texte |

Les series sont seeded **en meme temps** que les messages la premiere fois, ou ajoutees a posteriori si les messages existaient deja mais pas les series.

---

# 20. GUIDE D'UTILISATION POUR LES UTILISATEURS

## Premiers pas

### 1. Creer un compte
1. Ouvrir l'application
2. Aller dans **Profil** (onglet en bas a droite)
3. Cliquer sur **Creer un compte**
4. Remplir : email, nom, mot de passe (min 6 caracteres)
5. Cliquer sur **S'inscrire**
6. Vous etes automatiquement connecte

### 2. Se connecter
1. Aller sur la page **Connexion** (`/login`)
2. Saisir email et mot de passe
3. Cliquer sur **Se connecter**

## Parcourir les messages

### Depuis l'accueil
- Utilisez les **3 boutons d'acces rapide** (Audio, Video, Textes) pour acceder directement a un type
- Consultez les **messages recents** en bas de la page
- Parcourez les **series disponibles** en scroll horizontal

### Depuis les onglets
- Utilisez la **barre de navigation en bas** pour acceder aux onglets Audio, Video, Textes
- Filtrez par **categorie** avec les chips en haut
- **Recherchez** par titre avec la barre de recherche

### Recherche globale
1. Depuis l'accueil, **cliquez sur la barre de recherche**
2. Tapez votre recherche (titre, auteur, categorie, contenu)
3. Les resultats apparaissent en temps reel
4. Utilisez les **onglets** pour filtrer par type
5. Cliquez sur un resultat pour ouvrir le message

## Consulter un message

1. Cliquez sur un message depuis n'importe quelle liste
2. Pour **l'audio** : utilisez les boutons Play/Pause, Skip, la barre de progression
3. Pour la **video** : utilisez les controles video (play, mute, plein ecran)
4. Pour le **texte** : lisez le contenu dans la section "Contenu"
5. Ajoutez un **commentaire** en bas de page
6. Marquez en **favori** avec le bouton coeur

## Telecharger pour ecoute hors-ligne

1. Ouvrez un message audio ou video
2. Cliquez sur **Telecharger pour ecoute hors-ligne**
3. La progression s'affiche en temps reel
4. Un badge vert "Disponible hors-ligne" confirme le succes
5. Retrouvez vos telechargements dans **Profil > Telechargements**
6. Les fichiers sont accessibles meme sans connexion Internet

## Suivre une serie

### Decouvrir les series
1. Depuis l'accueil, scrollez vers la section **Series & Programmes**
2. Ou allez dans **Profil > Series & Programmes**
3. Ou naviguez vers `/series`

### Commencer une serie
1. Ouvrez une serie depuis la liste
2. Lisez la description et consultez les modules
3. Cliquez sur **Commencer** (ou **Continuer** si deja en cours)
4. Vous etes redirige vers le premier module non termine

### Progresser dans une serie
1. Ecoutez/lisez le message
2. Cliquez sur **Marquer ce module comme termine** dans la page du message
3. Utilisez les boutons **Precedent / Suivant** pour naviguer dans la serie
4. Votre progression est sauvegardee automatiquement

### Suivre sa progression
- La **page de la serie** affiche une barre de progression detaillee
- La **page liste** montre les series "En cours", "A decouvrir" et "Terminees"
- Le **bandeau serie** dans la page de detail montre la position actuelle

---

# 21. GUIDE D'UTILISATION POUR LES ADMINISTRATEURS

## Devenir administrateur

Le **premier utilisateur** a s'inscrire recoit automatiquement le role `admin`. Les administrateurs suivants sont nommes par un admin existant.

## Publier un message

1. Aller dans **Profil > Ajouter un message** (ou `/admin`)
2. Selectionner le **type** : Audio, Video ou Texte
3. Remplir les champs obligatoires : Titre, Auteur, Categorie
4. Pour audio/video : indiquer la duree et uploader le fichier media
5. Pour video : ajouter une URL de vignette
6. Ajouter une description (obligatoire pour les textes)
7. Cliquer sur **Publier le message**
8. Le fichier est uploade dans Supabase Storage et le message est cree

## Gestion des utilisateurs

1. Aller dans **Profil > Gestion des utilisateurs** (ou `/admin/users`)
2. **Rechercher** un utilisateur par nom ou email
3. **Modifier le role** : cliquer pour basculer entre "Utilisateur" et "Admin"
4. **Supprimer un utilisateur** : cliquer sur le bouton de suppression (confirmation requise)

### Restrictions
- Vous ne pouvez pas retirer votre propre role admin
- Vous ne pouvez pas supprimer votre propre compte

## Moderer les commentaires

- Sur n'importe quel message, un admin peut **supprimer n'importe quel commentaire**
- Les utilisateurs normaux ne peuvent supprimer que leurs propres commentaires

## Dashboard d'administration (v3.1.0)

Le dashboard complet est accessible depuis **Profil > Dashboard (Desktop)** ou `/admin/dashboard` (desktop uniquement).

### Fonctionnalites principales

1. **Vue d'ensemble** : KPIs en temps reel, graphique d'activite, journal d'audit, derniers inscrits
2. **Gestion du contenu** : messages ET series dans un meme onglet, avec selection multiple et suppression groupee
3. **Configuration** : editer le nom de l'app, les toggles fonctionnalites, les couleurs
4. **Categories** : ajouter/supprimer des categories personnalisees
5. **Annonces** : publier des notifications pour les utilisateurs
6. **Securite** : consulter le journal d'audit, verifier le statut HTTPS
7. **Stockage** : voir la repartition des fichiers media
8. **Sante systeme** : verifier le statut de la DB, Auth et Storage
9. **Export** : telecharger les donnees en JSON

> Voir la section 26 pour le detail complet du dashboard.

## Creer une serie

La gestion des series est disponible dans le **Dashboard > Contenu > onglet Series**. La creation de series peut aussi se faire via l'API backend :

```
POST /make-server-1c1fff69/series
Authorization: Bearer {admin_access_token}
Content-Type: application/json

{
  "title": "Ma nouvelle serie",
  "description": "Description de la serie...",
  "coverImage": "https://...",
  "author": "Nom de l'auteur",
  "category": "Formation",
  "messageIds": ["msg-id-1", "msg-id-2", "msg-id-3"]
}
```

---

# 22. FEUILLE DE ROUTE ET EVOLUTIONS FUTURES

## Fonctionnalites implementees (v3.0.0)

- [x] Messages audio, video et texte
- [x] Systeme d'authentification (login/signup)
- [x] Systeme de roles (admin/user)
- [x] Favoris
- [x] Commentaires
- [x] Telechargement hors-ligne avec Cache API
- [x] Recherche globale avec surlignage et historique
- [x] Series et programmes d'etudes avec progression
- [x] Statistiques Admin (Dashboard)
- [x] Documentation hebergement et deploiement autonome
- [x] Guide de commercialisation (modeles economiques, plan d'action)
- [x] **Refonte multi-plateforme : Web + iOS + Android via PWA**
- [x] **Police Inter (Google Fonts) avec anti-aliasing**
- [x] **Navigation adaptative : sidebar desktop (lg:) + bottom nav mobile**
- [x] **Detection de plateforme (iOS / Android / Web) + mode standalone**
- [x] **Banniere d'installation PWA contextuelle (iOS Safari, Android Chrome)**
- [x] **Safe area support (encoches iOS, home indicator)**
- [x] **Layout responsive : max-w-lg mobile, max-w-3xl desktop avec sidebar 240px**
- [x] **Bottom nav animee avec indicateur glissant**
- [x] **Design polish : rounded-2xl, ombres ameliorees, micro-interactions active:scale**

## Fonctionnalites implementees (v3.1.0 — Dashboard Admin)

- [x] **Dashboard d'administration complet (Desktop uniquement, 12 sections)**
- [x] **Vue d'ensemble : KPIs, graphique d'activite 14j, journal recent, derniers inscrits, actions rapides**
- [x] **Gestion des utilisateurs : tableau complet, recherche, promotion/retrograde admin, suppression**
- [x] **Gestion du contenu : messages + series, filtre par type, recherche, selection multiple, suppression groupee**
- [x] **Statistiques avancees : camembert types, barres categories, top favoris/commentes, progression series**
- [x] **Configuration de l'application (nom, sous-titre, couleurs, langue, toggles fonctionnalites)**
- [x] **Apparence : edition des couleurs du theme avec apercu en direct**
- [x] **Categories : gestion des categories personnalisees (ajout/suppression)**
- [x] **Annonces : publication de notifications avec type (info/warning/success) et expiration**
- [x] **Securite & Audit : journal d'audit filtrable, metriques securite, effacement des logs**
- [x] **Stockage : statistiques fichiers media (nombre, taille, repartition audio/video), liste detaillee**
- [x] **Sante systeme : etat des services (DB, Auth, Storage), version serveur, memoire, entrees KV**
- [x] **Export de donnees : telechargement JSON (utilisateurs, messages, tout)**
- [x] **15 nouvelles routes backend (config, audit, storage, health, categories, announcements, export, bulk-delete, message update)**
- [x] **15 nouvelles fonctions API frontend**
- [x] **6 nouvelles interfaces TypeScript (AppConfig, AuditLog, StorageStats, SystemHealth, Announcement, AppUser)**
- [x] **6 nouveaux patterns de cles KV (config:app, audit:*, config:categories, announcement:*)**
- [x] **Sidebar desktop avec lien Dashboard en premiere position**
- [x] **Page profil avec lien Dashboard (Desktop)**
- [x] **Creation d'utilisateurs directement depuis le dashboard**
- [x] **Publication de messages (audio/video/texte) inline dans le dashboard avec upload media**
- [x] **Creation de programmes d'etudes (series) en 3 etapes : informations, selection des modules, organisation & validation**

## Fonctionnalites envisagees

| Priorite | Fonctionnalite | Description |
|----------|---------------|-------------|
| Haute | Mini-player persistant | Continuer l'ecoute en naviguant entre les pages |
| Haute | Vitesse de lecture | Ajustable de 0.5x a 2x |
| Haute | Reprise de lecture | Memoriser la position et reprendre automatiquement |
| Moyenne | Mode sombre | Theme alternatif avec fond sombre |
| Moyenne | Notifications push | Alertes pour nouveaux messages et series |
| Moyenne | Playlists personnelles | Creer et gerer des playlists de messages |
| Moyenne | Notes personnelles | Annoter les messages et series |
| ~~Moyenne~~ | ~~Interface admin pour series~~ | ~~Formulaire graphique pour creer/modifier des series~~ **(integre dans Dashboard v3.1.0, onglet Contenu)** |
| Basse | Gamification | Points, badges, classements, streaks |
| Basse | Statistiques de lecture | Temps ecoute, messages lus, progression globale |
| Basse | Partage social avance | Partage d'extraits, deeplinks |
| Basse | Multi-langue | Support de l'anglais et d'autres langues |

---

# 23. HEBERGEMENT ET DEPLOIEMENT

## Etat actuel (Figma Make)

Dans l'environnement Figma Make, tout est heberge automatiquement :

| Couche | Hebergement | Statut |
|--------|------------|--------|
| Frontend React | Figma Make | Automatique |
| Serveur Hono | Supabase Edge Functions | Automatique |
| Base de donnees (KV) | Supabase PostgreSQL | Automatique |
| Authentification | Supabase Auth | Automatique |
| Fichiers media | Supabase Storage | Automatique |

## Deploiement autonome (hors Figma Make)

Pour deployer ECODIS en production independante, 4 etapes sont necessaires.

### Etape 1 : Creer un projet Supabase dedie

1. Aller sur [supabase.com](https://supabase.com) et creer un nouveau projet
2. Recuperer les nouvelles cles :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_URL`
3. Creer la table KV store dans l'editeur SQL :

```sql
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kv_store_key_prefix ON kv_store (key text_pattern_ops);
```

4. Creer le bucket de stockage prive `ecodis-media` dans Storage

### Etape 2 : Exporter et nettoyer le code source

Fichiers a recuperer :

```
/src/                  -> Frontend React complet
/supabase/functions/   -> Backend Hono (Edge Function)
/package.json          -> Dependances
/vite.config.*         -> Configuration build
```

Nettoyages obligatoires avant deploiement :

| Element a modifier | Valeur actuelle (Figma Make) | Valeur production |
|-------------------|------------------------------|-------------------|
| Prefixe des routes API | `/make-server-1c1fff69` | `/api/v1` (ou votre choix) |
| Nom du bucket Storage | `make-1c1fff69-media` | `ecodis-media` |
| Nom de la table KV | `kv_store_1c1fff69` | `kv_store` |
| Appel `seedData()` dans home-page | Present (auto-seed) | **A supprimer** en production |
| CORS dans le serveur Hono | `origin: "*"` | `origin: "https://votre-domaine.com"` |
| Variables d'environnement frontend | Codees en dur dans `info.tsx` | Variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` |

### Etape 3 : Deployer le backend (Supabase Edge Functions)

```bash
# Installer le CLI Supabase
npm install -g supabase

# Se connecter et lier au projet
supabase login
supabase link --project-ref VOTRE_PROJECT_ID

# Deployer la fonction serveur
supabase functions deploy server

# Configurer les secrets
supabase secrets set SUPABASE_URL=https://xxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set SUPABASE_ANON_KEY=eyJ...
```

### Etape 4 : Deployer le frontend

#### Option A : Vercel (recommande)

1. Creer un depot GitHub avec le code frontend
2. Connecter le depot a [vercel.com](https://vercel.com)
3. Configurer les variables d'environnement :
   - `VITE_SUPABASE_URL` -> URL du projet Supabase
   - `VITE_SUPABASE_ANON_KEY` -> Cle publique Supabase
   - `VITE_API_BASE_URL` -> URL de l'Edge Function
4. Build command : `npm run build`
5. Output directory : `dist`

#### Option B : Netlify

1. Meme processus que Vercel
2. Ajouter un fichier `_redirects` pour le SPA : `/* /index.html 200`

#### Option C : Cloudflare Pages

1. Connecter le depot GitHub
2. Build command : `npm run build`
3. Avantage : CDN global gratuit, tres rapide

### Nom de domaine personnalise

1. Acheter un domaine (ex: `ecodis.app`, `ecodis.org`, `ecodis.church`)
2. Configurer le DNS chez le fournisseur d'hebergement (CNAME)
3. Le SSL (HTTPS) est automatique sur Vercel/Netlify/Cloudflare

## Architecture de production recommandee

```
Utilisateur
    |
    | HTTPS
    v
Vercel / Netlify / Cloudflare Pages (Frontend React SPA)
    |
    | HTTPS (fetch)
    v
Supabase Edge Functions (Serveur Hono)
    |
    | SDK Supabase
    v
Supabase PostgreSQL (KV Store) + Supabase Storage (Media) + Supabase Auth
```

## Estimation des couts d'hebergement

### Phase MVP (0-100 utilisateurs)

| Poste | Cout/mois |
|-------|-----------|
| Supabase Free tier | 0 EUR |
| Vercel Free tier | 0 EUR |
| Domaine (.com / .org) | ~1 EUR |
| **Total** | **~1 EUR/mois** |

### Phase Croissance (100-1000 utilisateurs)

| Poste | Cout/mois |
|-------|-----------|
| Supabase Pro | ~25 EUR |
| Vercel Pro | ~20 EUR |
| Domaine + email professionnel | ~5 EUR |
| Cloudflare (CDN, optionnel) | 0 EUR |
| **Total** | **~50 EUR/mois** |

### Phase Scale (1000+ utilisateurs, multi-tenant)

| Poste | Cout/mois |
|-------|-----------|
| Supabase Team | 100-300 EUR |
| Vercel Team | ~50 EUR |
| Monitoring (Sentry) | ~25 EUR |
| Email transactionnel (Resend) | ~20 EUR |
| **Total** | **200-400 EUR/mois** |

## Checklist de mise en production

- [ ] Creer un projet Supabase dedie (pas celui de developpement)
- [ ] Creer la table KV store et le bucket Storage
- [ ] Exporter le code dans un depot Git prive
- [ ] Nettoyer les prefixes Figma Make (`make-server-1c1fff69`, `make-1c1fff69-media`, `kv_store_1c1fff69`)
- [ ] Supprimer l'appel `seedData()` automatique de la page d'accueil
- [ ] Remplacer les variables en dur par des variables d'environnement (`VITE_*`)
- [ ] Restreindre le CORS a votre domaine uniquement
- [ ] Deployer le serveur Hono via Supabase CLI
- [ ] Deployer le frontend sur Vercel/Netlify/Cloudflare
- [ ] Configurer le domaine personnalise et le SSL
- [ ] Tester l'inscription, la connexion, l'upload et la lecture de messages
- [ ] Creer le premier compte admin manuellement
- [ ] Configurer un service de monitoring (Sentry, LogFlare)

---

# 24. COMMERCIALISATION

## Adaptations techniques prealables

Avant de commercialiser ECODIS, certaines modifications sont necessaires :

### Securite (prioritaire)

| Action | Statut actuel | Requis en production |
|--------|--------------|---------------------|
| Supprimer le seed automatique | `seedData()` au chargement | A supprimer |
| Rate limiting | Aucun | Ajouter via Cloudflare ou middleware Hono |
| Validation des entrees | Basique | Renforcer (taille fichiers, types MIME, longueur textes) |
| CORS restrictif | `origin: "*"` | Limiter au domaine de production |
| Politique de confidentialite | Absente | Obligatoire (RGPD si utilisateurs europeens) |
| Politique de cookies | Absente | Obligatoire |
| Mentions legales | Absentes | Obligatoires |
| Sauvegarde des donnees | Aucune | Mettre en place des backups automatiques |

### Fonctionnalites critiques a ajouter

| Priorite | Fonctionnalite | Pourquoi |
|----------|---------------|----------|
| **Critique** | Multi-tenant (organisations) | Chaque eglise gere son propre contenu et ses utilisateurs |
| **Critique** | Paiement (Stripe / PayPal) | Gerer les abonnements et la facturation |
| **Critique** | Onboarding | Parcours de bienvenue guidant les nouveaux utilisateurs |
| **Critique** | Confirmation email | Serveur SMTP pour les emails d'inscription |
| **Haute** | PWA complete | Manifest + Service Worker pour installation mobile native |
| **Haute** | Notifications push | Alerter les membres des nouveaux contenus |
| **Haute** | Export/backup des donnees | Rassurer les clients (pas de lock-in) |
| **Moyenne** | App mobile native | React Native ou Capacitor pour iOS/Android (stores) |
| **Moyenne** | Analytics (Plausible / PostHog) | Comprendre l'usage pour ameliorer le produit |
| **Moyenne** | Export CSV/PDF des stats | Pour les rapports paroissiaux |

## Cible de marche

### Marche primaire

- **Eglises locales** : stocker et diffuser predications, enseignements, louanges
- **Missions et ONG chretiennes** : former des disciples a distance
- **Seminaires theologiques** : complement digital aux cours en presentiel

### Marche secondaire

- **Communautes religieuses** non chretiennes (adaptable)
- **Organisations de formation continue** : podcasts, formations video, contenus textuels
- **Associations culturelles** : conferences, ateliers, meditations

## Modeles economiques possibles

### Option 1 : Freemium

| Plan | Prix | Inclus |
|------|------|--------|
| Gratuit | 0 EUR/mois | 50 messages, 5 series, 100 utilisateurs, logo ECODIS |
| Standard | 15 EUR/mois | 500 messages, series illimitees, 1000 utilisateurs, sans logo |
| Premium | 40 EUR/mois | Messages illimites, utilisateurs illimites, stats avancees, support prioritaire |

### Option 2 : Abonnement par eglise

| Taille de l'eglise | Prix | Inclus |
|--------------------|------|--------|
| Petite (< 100 membres) | 15 EUR/mois | Fonctionnalites completes |
| Moyenne (100-500) | 35 EUR/mois | + stats avancees, multi-admin |
| Grande (500+) | 60 EUR/mois | + domaine personnalise, support dedie |

### Option 3 : SaaS multi-tenant

- Chaque eglise a sa propre instance isolee (sous-domaine : `moNeglise.ecodis.app`)
- Tableau de bord super-admin pour gerer toutes les instances
- Facturation centralisee via Stripe

### Option 4 : Licence perpetuelle

| Offre | Prix unique | Inclus |
|-------|-----------|--------|
| Licence standard | 500 EUR | Code source + 1 an de mises a jour |
| Licence premium | 1200 EUR | + installation, formation, 2 ans de support |

## Canaux de distribution

| Canal | Strategie | Cout |
|-------|-----------|------|
| **Site vitrine** | Landing page avec demos, temoignages, tarifs | ~20 EUR/mois |
| **Reseaux sociaux** | Facebook, Instagram, YouTube (tutoriels, temoignages) | Gratuit / pub payante |
| **Partenariats** | Eglises pilotes, leaders d'opinion chretiens | Gratuit (echange de visibilite) |
| **App stores** | Presence sur Google Play et Apple App Store (via PWA ou app native) | 25 USD (Google) + 99 USD/an (Apple) |
| **Bouche a oreille** | Programme de parrainage entre eglises | Faible |
| **Email marketing** | Newsletter, onboarding automatise (Resend, Mailchimp) | 0-50 EUR/mois |
| **Conferences chretiennes** | Stands, presentations lors d'evenements | Variable |

## Plan d'action en 6 etapes

### Etape 1 : Nettoyage et securisation (Semaines 1-2)

- Nettoyer les prefixes Figma Make
- Renforcer la securite (CORS, validation, rate limiting)
- Supprimer le seed automatique
- Ajouter mentions legales et politique de confidentialite

### Etape 2 : Deploiement autonome (Semaines 2-3)

- Creer le projet Supabase de production
- Deployer sur Vercel + domaine personnalise
- Configurer monitoring (Sentry) et analytics (Plausible)
- Tests end-to-end complets

### Etape 3 : Fonctionnalites commerciales (Semaines 3-6)

- Integration Stripe pour les paiements
- Systeme multi-tenant (si modele SaaS)
- Onboarding guide pour les nouveaux utilisateurs
- PWA complete (manifest + service worker)
- Confirmation email (SMTP via Resend)

### Etape 4 : Beta test (Semaines 6-8)

- Recruter 3-5 eglises pilotes
- Recueillir les retours utilisateurs
- Corriger les bugs et ajuster l'UX
- Preparer la documentation utilisateur finale

### Etape 5 : Lancement (Semaines 8-10)

- Creer le site vitrine avec tarifs et demonstrations
- Lancer les campagnes sur les reseaux sociaux
- Contacter les leaders d'opinion et partenaires
- Publier sur les app stores (si app native)

### Etape 6 : Croissance (Mois 3+)

- Ajouter les fonctionnalites de la feuille de route (mini-player, vitesse de lecture, etc.)
- Programme de parrainage inter-eglises
- Support client structure (ticketing, FAQ)
- Iteration basee sur les retours utilisateurs et les analytics

---

# 25. MULTI-PLATEFORME ET PWA (v3.0.0)

## Strategie multi-plateforme

ECODIS v3.0.0 adopte l'approche **Progressive Web App (PWA)** pour cibler simultanement Web, iOS et Android avec une seule base de code React.

| Plateforme | Methode d'acces | Experience |
|-----------|----------------|------------|
| **Web (desktop)** | Navigateur (Chrome, Firefox, Safari, Edge) | Sidebar laterale 240px + contenu max-w-3xl |
| **Web (mobile)** | Navigateur mobile | Bottom nav + contenu max-w-lg |
| **iOS** | Safari > Partager > Ecran d'accueil | Mode standalone, safe areas, pas de barre Safari |
| **Android** | Chrome > Installer l'application | Mode standalone, splash screen, icone native |

## Composants de la couche multi-plateforme

### PlatformProvider (`platform-utils.tsx`)

Context React global qui fournit a toute l'application :

| Propriete | Type | Description |
|-----------|------|-------------|
| `platform` | `"ios" \| "android" \| "web"` | Plateforme detectee via User-Agent |
| `standalone` | `boolean` | `true` si l'app tourne en mode installe (PWA standalone) |
| `canInstall` | `boolean` | `true` si le navigateur propose `beforeinstallprompt` |
| `installApp()` | `() => Promise` | Declenche la boite de dialogue d'installation native |
| `showInstallBanner` | `boolean` | `true` si la banniere d'installation doit etre affichee |
| `dismissInstall()` | `() => void` | Masque la banniere (persiste dans localStorage) |

### Detection de plateforme

```typescript
function detectPlatform(): Platform {
  // iOS : iPad, iPhone, iPod, ou iPad sur macOS (touch)
  if (/iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1))
    return "ios";
  // Android : mot-cle dans le user-agent
  if (/android/i.test(ua)) return "android";
  // Sinon : navigateur desktop
  return "web";
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as any).standalone === true; // Safari iOS
}
```

### Banniere d'installation PWA (`pwa-install-banner.tsx`)

- Apparait en bas de l'ecran (au-dessus de la bottom nav sur mobile)
- **Android/Chrome** : bouton "Installer maintenant" qui declenche `installApp()`
- **iOS/Safari** : instructions manuelles "Partager > Sur l'ecran d'accueil"
- Peut etre fermee ; le choix est memorise dans `localStorage`
- Ne s'affiche pas si l'app est deja en mode standalone

## Navigation adaptative

### Mobile (< 1024px)

- **Header fixe** (`app-header.tsx`) : logo ECODIS, titre de page, badge admin, bouton profil
- **Bottom nav fixe** (`bottom-nav.tsx`) : 5 onglets (Accueil, Audio, Video, Textes, Profil)
  - Indicateur anime glissant sur l'onglet actif (barre coloree en haut)
  - Icones avec `scale-110` et `stroke-[2.5]` pour l'onglet actif
  - Padding `env(safe-area-inset-bottom)` pour les appareils a encoche
- **Contenu** : `max-w-lg mx-auto` (512px)

### Desktop (>= 1024px, breakpoint `lg:`)

- **Sidebar fixe** (`sidebar-nav.tsx`) : panneau de 240px a gauche
  - Logo et nom de l'application
  - Section "Navigation" : 6 liens principaux (Accueil, Audio, Video, Textes, Series, Hors-ligne)
  - Section "Administration" (si admin) : 4 liens (Dashboard, Ajouter, Utilisateurs, Statistiques)
  - Section utilisateur en bas : avatar, nom, email
  - Lien actif : fond bleu marine avec ombre
  - Version de l'application
- **Header mobile masque** : `lg:hidden`
- **Bottom nav masquee** : `lg:hidden`
- **Contenu** : `lg:pl-[240px] lg:max-w-3xl` (decale a droite de la sidebar)

## Safe areas et gestion des encoches

| Zone | CSS utilise | Effet |
|------|-----------|-------|
| Header mobile | `pt-[env(safe-area-inset-top)]` | Decale le contenu sous l'encoche avant |
| Bottom nav | `pb-[env(safe-area-inset-bottom)]` | Remonte au-dessus de l'indicateur d'accueil iOS |

## Indicateur de plateforme

Un pill transparent en haut a gauche du hero banner de la page d'accueil affiche la plateforme detectee :

- Icone : `Globe` (Web), `Smartphone` (iOS / Android)
- Texte : "Web", "iOS", "Android" ou "App" (si standalone)

## Invite d'installation dans le profil

La page Profil propose un bouton "Installer l'application" (visible si `canInstall === true`) avec une explication contextuelle. Le pied de page du profil affiche :

```
ECODIS v3.1.0 | iOS App
```

## Architecture des providers (App.tsx)

```tsx
<PlatformProvider>       // Detection plateforme + PWA
  <AuthProvider>         // Authentification Supabase
    <DownloadProvider>   // Telechargement hors-ligne
      <RouterProvider /> // React Router (Data mode) — inclut /admin/dashboard
      <Toaster />        // Sonner (notifications toast)
    </DownloadProvider>
  </AuthProvider>
</PlatformProvider>
```

## Preparation pour les stores natifs

Pour publier sur les app stores iOS et Android, deux options sont possibles :

### Option A : PWA directe (recommande pour le lancement)

- **Android** : publier en tant que TWA (Trusted Web Activity) via Bubblewrap sur Google Play
- **iOS** : distribuer via Safari "Ajouter a l'ecran d'accueil" (pas de publication App Store)

### Option B : Wrapper natif (pour les stores)

- **Capacitor** (Ionic) : encapsule le code React existant dans un shell natif
  - `npx cap init` + `npx cap add ios` + `npx cap add android`
  - Acces aux APIs natives (notifications push, camera, etc.)
  - Publication sur App Store et Google Play
- **React Native (rewrite)** : reecrit l'interface avec React Native
  - Effort important mais performances natives maximales
  - Reutilisation de la logique metier et de l'API

---

# 26. DASHBOARD D'ADMINISTRATION (v3.1.0)

## Acces et restriction

Le dashboard d'administration est accessible uniquement :
- Par les utilisateurs avec le role **admin**
- Depuis un navigateur **desktop** (plateforme detectee = `"web"`)
- Route : `/admin/dashboard`
- Liens d'acces : **sidebar desktop** (1er lien admin), **page profil** > section "Administration" > "Dashboard (Desktop)"

Sur mobile (iOS/Android), une page bloquante avec icone `Monitor` invite l'utilisateur a acceder au dashboard depuis un ordinateur.

## Architecture a 12 sections

Le dashboard utilise une sidebar laterale interne avec 12 sections regroupees en 3 categories :

### Groupe "Principal"

| Section | Cle | Icone | Description |
|---------|-----|-------|-------------|
| **Vue d'ensemble** | `overview` | `LayoutDashboard` | KPIs en grille (6 metriques), graphique d'activite AreaChart 14j, journal d'audit recent, derniers inscrits, actions rapides (nouveau message, creer programme, creer utilisateur, exporter) |
| **Utilisateurs** | `users` | `Users` | **Creation de comptes** (nom, email, mot de passe) + Tableau complet avec recherche par nom/email, colonnes (nom, email, role, date creation, derniere connexion), promotion/retrograde admin, suppression avec confirmation |
| **Gestion du contenu** | `content` | `FileText` | Sous-onglets Messages + Series. **Messages** : formulaire de publication inline (type, titre, auteur, categorie, duree, vignette, description, upload media), filtre par type, recherche, selection multiple, suppression groupee. **Series** : creation de programmes en 3 etapes (informations, selection des modules, organisation & validation), liste avec modules et auteur, suppression |
| **Statistiques** | `stats` | `BarChart3` | Graphiques Recharts detailles : PieChart (repartition par type), BarChart horizontal (categories), top 5 messages favoris, top 5 messages commentes, progression des series avec barres |

### Groupe "Parametres"

| Section | Cle | Icone | Description |
|---------|-----|-------|-------------|
| **Configuration** | `config` | `Settings` | Formulaire editable : nom de l'application, sous-titre, message d'accueil, verset biblique, langue par defaut, taille max upload (Mo), toggles on/off (inscriptions, commentaires, telechargements, analytics, seed automatique, mode maintenance) |
| **Apparence** | `appearance` | `Palette` | Edition des couleurs du theme : couleur principale (`primaryColor`) et couleur accent (`accentColor`) avec input color picker, apercu visuel des boutons et badges en temps reel, bouton de sauvegarde |
| **Categories** | `categories` | `Tag` | Liste des categories personnalisees, ajout de nouvelles categories par formulaire texte, suppression individuelle, sauvegarde groupee |
| **Annonces** | `notifications` | `Bell` | Liste des annonces actives/inactives, creation d'annonces (titre, message, type info/warning/success, date d'expiration optionnelle), suppression, affichage de la date de creation |

### Groupe "Systeme"

| Section | Cle | Icone | Description |
|---------|-----|-------|-------------|
| **Securite & Audit** | `security` | `Shield` | Journal d'audit avec filtrage par type d'action (dropdown), affichage colore par action, metriques securite (total events, HTTPS, derniere activite), bouton d'effacement global des logs avec confirmation |
| **Stockage** | `storage` | `HardDrive` | KPIs stockage (fichiers totaux, taille totale, repartition audio/video en nombre et taille), liste detaillee des fichiers avec nom, type MIME, taille et date de creation |
| **Sante systeme** | `system` | `Zap` | Statut global (healthy/degraded/down) avec indicateur colore, verification des services (DB, Auth, Storage) avec StatusDot, version serveur, uptime, utilisation memoire, nombre d'entrees KV |
| **Export de donnees** | `export` | `FileDown` | 3 boutons d'export : Utilisateurs, Messages, Toutes les donnees. Export en JSON telecharge automatiquement via blob URL + lien de telechargement |

## Chargement des donnees

Au montage, le dashboard charge toutes les donnees en parallele via `Promise.all()` :

```typescript
const [stats, users, messages, series, config, auditLogs, storage, health, categories, announcements] =
  await Promise.all([
    fetchAdminStats(token),
    fetchAllUsers(token),
    fetchMessages(),
    fetchAllSeries(),
    fetchAppConfig(token),
    fetchAuditLogs(token),
    fetchStorageStats(token),
    fetchSystemHealth(token),
    fetchCategories(token),
    fetchAnnouncements(token),
  ]);
```

Un bouton "Rafraichir" (`RefreshCw`) permet de recharger toutes les donnees a la demande.

## Routes backend ajoutees (v3.1.0)

| Route | Methode | Description |
|-------|---------|-------------|
| `/admin/config` | `GET` | Recuperer la configuration de l'application |
| `/admin/config` | `PUT` | Mettre a jour la configuration (log audit automatique) |
| `/admin/audit-log` | `GET` | Lister les 200 derniers evenements d'audit |
| `/admin/audit-log` | `DELETE` | Effacer tous les logs d'audit |
| `/admin/storage` | `GET` | Statistiques de stockage media (fichiers, tailles) |
| `/admin/messages/bulk-delete` | `POST` | Suppression groupee de messages |
| `/messages/:id` | `PUT` | Mise a jour d'un message existant |
| `/admin/health` | `GET` | Verification de sante du systeme (DB, Auth, Storage, memoire, KV) |
| `/admin/categories` | `GET` | Lister les categories personnalisees |
| `/admin/categories` | `PUT` | Mettre a jour les categories |
| `/admin/announcements` | `GET` | Lister les annonces |
| `/admin/announcements` | `POST` | Creer une annonce |
| `/admin/announcements/:id` | `DELETE` | Supprimer une annonce |
| `/admin/export` | `GET` | Exporter les donnees en JSON (param `?type=users|messages|all`) |

## Modele de donnees ajoute (v3.1.0)

| Cle KV | Structure | Description |
|--------|-----------|-------------|
| `config:app` | `AppConfig` | Configuration globale de l'application |
| `audit:{id}` | `AuditLog` | Evenement d'audit (action, utilisateur, description, metadata) |
| `audit_counter` | `number` | Compteur auto-incremente pour les IDs d'audit |
| `config:categories` | `string[]` | Liste des categories personnalisees |
| `announcement:{id}` | `Announcement` | Annonce publiee par un admin |
| `announcement_counter` | `number` | Compteur auto-incremente pour les IDs d'annonces |

### Interface `AppConfig`

```typescript
interface AppConfig {
  appName: string;           // "ECODIS"
  appSubtitle: string;       // "Ecole des Disciples"
  maintenanceMode: boolean;  // Mode maintenance
  registrationEnabled: boolean; // Inscriptions ouvertes
  commentsEnabled: boolean;  // Commentaires actifs
  downloadsEnabled: boolean; // Telechargements hors-ligne
  maxUploadSizeMb: number;   // Taille max upload (Mo)
  defaultLanguage: string;   // "fr"
  welcomeMessage: string;    // Message d'accueil hero
  welcomeVerse: string;      // Reference biblique hero
  primaryColor: string;      // Couleur principale (#152a6b)
  accentColor: string;       // Couleur accent (#9b1b30)
  analyticsEnabled: boolean; // Analytics actifs
  autoSeedEnabled: boolean;  // Seed automatique
  updatedAt?: string;        // Date de derniere mise a jour
  updatedBy?: string;        // ID de l'admin qui a modifie
}
```

### Interface `AuditLog`

```typescript
interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;       // ex: "config_update", "bulk_delete_messages"
  description: string;  // Description humaine
  metadata: any;        // Donnees contextuelles (JSON)
  createdAt: string;
}
```

### Interface `SystemHealth`

```typescript
interface SystemHealth {
  status: "healthy" | "degraded" | "down";
  uptime: string;
  serverVersion: string;
  dbConnected: boolean;
  storageConnected: boolean;
  authServiceUp: boolean;
  lastChecked: string;
  memoryUsage: number;
  kvEntries: number;
}
```

### Interface `StorageStats`

```typescript
interface StorageStats {
  totalFiles: number;
  totalSize: number;
  audioFiles: number;
  audioSize: number;
  videoFiles: number;
  videoSize: number;
  files: {
    name: string;
    folder: string;
    size: number;
    mimetype: string;
    createdAt: string;
  }[];
}
```

### Interface `Announcement`

```typescript
interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success";
  active: boolean;
  createdAt: string;
  expiresAt: string | null;
}
```

## Journal d'audit automatique

Les actions suivantes generent automatiquement un log d'audit :
- Mise a jour de la configuration (`config_update`)
- Suppression groupee de messages (`bulk_delete_messages`)
- Mise a jour d'un message (`update_message`)

## Securite du dashboard

- Toutes les routes `/admin/*` requierent le role admin (via `requireAdmin()`)
- Le token d'acces est verifie a chaque requete
- Les logs d'audit permettent de tracer qui a fait quoi et quand
- Les confirmations sont demandees avant les actions destructives (suppressions)
- Restriction d'acces par plateforme : desktop uniquement (via `usePlatform()`)
- Les admins ne peuvent pas retirer leur propre role ni supprimer leur propre compte

## Composants UI internes du dashboard

Le dashboard utilise des composants reutilisables internes :

| Composant | Description |
|-----------|-------------|
| `Card` | Carte blanche avec bordure, arrondi 2xl et ombre |
| `SectionHeader` | En-tete de section avec icone et titre |
| `KpiCard` | Carte de metrique avec icone coloree, valeur et label |
| `Toggle` | Interrupteur on/off avec label et description |
| `StatusDot` | Pastille verte/rouge pour indiquer un statut |

## Guide d'utilisation du dashboard

### Acceder au dashboard

1. Se connecter avec un compte admin
2. Sur desktop : cliquer sur "Dashboard" dans la sidebar gauche
3. Ou : aller sur `/admin/dashboard` directement
4. Ou : aller dans Profil > Administration > Dashboard (Desktop)

### Creer un utilisateur

1. Aller dans l'onglet "Utilisateurs"
2. Cliquer sur "Creer un utilisateur" en haut a droite
3. Remplir nom complet, email et mot de passe (min. 6 caracteres)
4. Cliquer sur "Creer le compte"
5. L'utilisateur est cree avec le role "Membre" ; vous pouvez le promouvoir admin immediatement apres

### Publier un nouveau message

1. Aller dans l'onglet "Gestion du contenu" > sous-onglet "Messages"
2. Cliquer sur "Nouveau message"
3. Selectionner le type : Audio, Video ou Texte
4. Remplir titre, auteur, et cliquer sur la categorie souhaitee
5. Pour audio/video : ajouter la duree, et cliquer sur la zone d'upload pour selectionner le fichier media
6. Pour video : ajouter l'URL de vignette
7. Ajouter une description (obligatoire pour les textes)
8. Cliquer sur "Publier le message"
9. Le message apparait immediatement dans la liste

### Creer un programme d'etudes (serie)

Le formulaire de creation de programme se deroule en **3 etapes** :

**Etape 1 — Informations generales :**
1. Aller dans l'onglet "Gestion du contenu" > sous-onglet "Series"
2. Cliquer sur "Nouveau programme"
3. Remplir titre, auteur, categorie, image de couverture (URL) et description
4. Cliquer sur "Suivant"

**Etape 2 — Selection des modules :**
1. Parcourir ou rechercher les messages disponibles
2. Cliquer sur un message pour l'ajouter au programme (un numero d'ordre s'affiche)
3. Cliquer de nouveau pour le retirer
4. Minimum 2 modules requis
5. Cliquer sur "Suivant"

**Etape 3 — Organisation et validation :**
1. Verifier le resume (nombre de modules, titre, auteur, categorie)
2. Reorganiser l'ordre des modules avec les fleches haut/bas
3. Retirer un module avec le bouton X si necessaire
4. Cliquer sur "Creer le programme" pour finaliser
5. Le programme apparait immediatement dans la liste des series

### Gerer la configuration

1. Aller dans l'onglet "Configuration"
2. Modifier les champs souhaites (nom, sous-titre, message d'accueil, etc.)
3. Activer/desactiver les fonctionnalites avec les toggles
4. Cliquer sur "Enregistrer les modifications"

### Personnaliser l'apparence

1. Aller dans l'onglet "Apparence"
2. Utiliser les color pickers pour changer les couleurs
3. Previsualiser les changements dans la zone d'apercu
4. Sauvegarder

### Gerer les categories

1. Aller dans l'onglet "Categories"
2. Ajouter une categorie en tapant le nom et en cliquant "+"
3. Supprimer une categorie avec le bouton X
4. Sauvegarder les modifications

### Publier une annonce

1. Aller dans l'onglet "Annonces"
2. Remplir le titre, le message, le type (info/warning/success)
3. Optionnel : definir une date d'expiration
4. Cliquer sur "Publier"

### Exporter les donnees

1. Aller dans l'onglet "Export de donnees"
2. Choisir le type d'export : Utilisateurs, Messages, ou Tout
3. Le fichier JSON est telecharge automatiquement

---

# ANNEXES

## A. Variables d'environnement

| Variable | Couche | Description |
|----------|--------|-------------|
| `SUPABASE_URL` | Serveur + Client | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Serveur uniquement | Cle admin (ne jamais exposer cote client) |
| `SUPABASE_ANON_KEY` | Client | Cle publique pour les appels client |
| `SUPABASE_DB_URL` | Serveur | URL de connexion a la base de donnees |
| `VITE_SUPABASE_URL` | Client (production) | URL Supabase pour le build Vite |
| `VITE_SUPABASE_ANON_KEY` | Client (production) | Cle publique pour le build Vite |
| `VITE_API_BASE_URL` | Client (production) | URL de base de l'API backend |

## B. Conventions de nommage

- **Fichiers** : kebab-case (`series-list-page.tsx`, `auth-context.tsx`)
- **Composants React** : PascalCase (`SeriesListPage`, `MessageCard`)
- **Fonctions API** : camelCase (`fetchMessages`, `markSeriesProgress`)
- **Cles KV** : format `type:id` ou `type:id1:id2` (`msg:seed-1`, `fav:userId:msgId`)
- **Routes** : lowercase avec tirets (`/admin/users`, `/series/:id`)

## C. Gestion des erreurs

### Frontend
- Les fonctions de lecture (`fetch*`) retournent des valeurs par defaut et logguent l'erreur
- Les fonctions d'ecriture (`create*`, `delete*`) propagent l'erreur pour gestion par l'UI
- Les erreurs sont affichees via des toasts Sonner ou des bannieres rouges

### Backend
- Chaque route est enveloppee dans un `try/catch`
- Les erreurs sont logguees via `console.log`
- Les reponses d'erreur incluent un message descriptif avec contexte
- Codes HTTP : 400 (validation), 401 (non authentifie), 403 (non autorise), 404 (non trouve), 500 (erreur serveur)

## D. Performance et optimisations

- **Chargement parallele** : `Promise.all()` pour les requetes independantes
- **Lazy state** : les donnees sont chargees a la demande (pas de prefetch global)
- **Debounce implicite** : la recherche filtre en memoire (pas d'appel API)
- **Cache** : les Object URLs sont reutilisees entre les navigations
- **Memoisation** : `useMemo` pour les resultats de recherche, `useCallback` pour les handlers

---

*Document genere le 4 mars 2026 - ECODIS v3.1.0*
*Derniere mise a jour : 4 mars 2026 — Dashboard admin : creation utilisateurs, publication messages inline, creation programmes d'etudes en 3 etapes*