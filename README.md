# 🏡 XYZ

**XYZ** est une application familiale collaborative qui centralise l'organisation et la vie quotidienne d'une famille dans un seul espace.

L'objectif est de réunir plusieurs outils du quotidien dans une application simple, intuitive, accessible depuis ordinateur, tablette et smartphone.

L'application est conçue comme une **Progressive Web App (PWA)** : elle peut être installée directement depuis un navigateur, sans passer par l'App Store ou le Google Play Store.

---

## ✨ Fonctionnalités

### ✅ To-do List

- Création et gestion de tâches.
- Attribution des tâches aux membres de la famille.
- Gestion des priorités et des échéances.
- Suivi des tâches terminées.
- Tâches récurrentes.
- Synchronisation en temps réel.

### 💬 Messagerie

- Conversations familiales.
- Messages entre membres.
- Notifications de nouveaux messages.
- Partage de fichiers et de photos.

### 🍽️ Menus de la semaine

- Planification des repas.
- Organisation des menus par jour.
- Gestion des recettes.
- Historique des menus.
- Suggestions de repas générées par IA.
- Adaptation aux préférences alimentaires et au budget familial.

### 🛒 Liste de courses

- Liste de courses partagée.
- Ajout et suppression de produits.
- Gestion des quantités.
- Catégorisation des produits.
- Synchronisation en temps réel.
- Génération automatique depuis les menus de la semaine.

### 🎬 Films et séries

- Liste des films et séries à regarder.
- Gestion des contenus déjà vus.
- Notes et avis des membres.
- Suggestions personnalisées.

### 📅 Calendrier familial

- Événements partagés.
- Anniversaires.
- Rendez-vous.
- Activités familiales.
- Rappels et notifications.

### 🤖 Assistant intelligent (IA)

- Suggestions de menus.
- Génération de listes de courses.
- Suggestions de films et séries.
- Recommandations adaptées aux préférences de la famille.
- Assistance pour l'organisation quotidienne.

---

## 🛠️ Stack technique

Le projet repose sur une architecture full-stack TypeScript avec une base de données relationnelle auto-hébergée.

| Technologie   | Utilisation                     |
| ------------- | ------------------------------- |
| React         | Frontend                        |
| TypeScript    | Typage statique                 |
| Vite          | Build et développement frontend |
| Tailwind CSS  | Styling                         |
| shadcn/ui     | Composants UI                   |
| NestJS        | Backend / API                   |
| PostgreSQL    | Base de données                 |
| Prisma ORM    | Accès aux données et migrations |
| Redis         | Cache et tâches asynchrones     |
| Socket.IO     | Communication temps réel        |
| OpenAI API    | Fonctionnalités IA              |
| PWA / Workbox | Installation et mode hors ligne |
| Docker        | Conteneurisation                |
| Nginx         | Reverse proxy et HTTPS          |

## 🗄️ Base de données

La base de données utilise PostgreSQL.

Chaque famille dispose d'un espace privé. Les données collaboratives sont associées à une famille via un identifiant `family_id`.

Principales entités :

- `users` : utilisateurs.
- `families` : familles.
- `family_members` : membres et rôles.
- `family_invitations` : invitations.
- `tasks` : tâches.
- `messages` : messages.
- `conversations` : conversations.
- `meal_plans` : menus hebdomadaires.
- `recipes` : recettes.
- `shopping_lists` : listes de courses.
- `shopping_items` : articles des listes de courses.
- `movies` : films et séries.
- `watchlist` : contenus à regarder.
- `events` : événements familiaux.
- `notifications` : notifications.

Les relations et contraintes seront définies dans le schéma Prisma.

### Sécurité

- Authentification sécurisée.
- Gestion des rôles et permissions.
- Isolation des données entre familles.
- Validation des données côté backend.
- Protection des routes API.
- Secrets et clés API stockés dans les variables d'environnement.
- Sauvegardes régulières de PostgreSQL.

---

## 🚀 Installation en développement

### Prérequis

- Node.js (version LTS).
- npm.
- Docker et Docker Compose.
- Git.

### 1. Cloner le repository

```bash
git clone <REPOSITORY_URL>
cd family-hub
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Renseigner les variables nécessaires dans `.env`.

### 3. Démarrer toute la stack avec Docker

```bash
docker compose up --build
```

Cette commande démarre le frontend, l'API NestJS, PostgreSQL et Redis. Les
données PostgreSQL et Redis sont conservees dans des volumes Docker.

Le schema relationnel PostgreSQL est initialise depuis
`backend/database/init/001_schema.sql`. Sa documentation, les relations, les
requêtes d'exemple et les recommandations Prisma/RLS sont dans
`backend/database/README.md`.

L'application est accessible sur `http://localhost:5173` et l'API de sante sur
`http://localhost:3000/api/health`.

L'accueil propose la connexion, la creation de groupe et un espace de travail
responsive avec groupe actif, overview et navigation par fonctionnalite. Le
fonctionnement du formulaire et du websocket Socket.IO est documente dans
`docs/LOGIN_AND_WEBSOCKET.md`.

La creation de compte et la connexion JWT sont disponibles depuis cette page.
Les utilisateurs et groupes sont enregistres dans PostgreSQL avec un mot de
passe hashe. Les routes groupe protegees sont `GET /api/groups`,
`POST /api/groups` et `GET /api/groups/:groupId/overview`.

### 4. Utiliser le backend en dehors de Docker (optionnel)

```bash
cd backend
npm install
```

### 5. Configurer Prisma

```bash
npx prisma generate
npx prisma migrate dev
```

### 6. Démarrer le backend

```bash
npm run start:dev
```

### 7. Installer les dépendances du frontend

Dans un autre terminal :

```bash
cd frontend
npm install
```

### 8. Démarrer le frontend

```bash
npm run dev
```

L'application sera accessible via l'adresse locale indiquée par Vite.

---

## 🐳 Déploiement

Le projet est conçu pour être auto-hébergé sur un serveur Linux avec Docker.

Architecture de production :

```text
                   INTERNET
                       |
                       v
                 +-----------+
                 |   NGINX   |
                 | HTTPS/SSL |
                 +-----------+
                       |
             +---------+---------+
             |                   |
             v                   v
       +-----------+       +-----------+
       |  React    |       |  NestJS   |
       |  Frontend |       |    API    |
       +-----------+       +-----------+
                                 |
                    +------------+------------+
                    |                         |
                    v                         v
              +-----------+             +-----------+
              | PostgreSQL|             |   Redis   |
              +-----------+             +-----------+
```

Le serveur héberge l'ensemble des services.

PostgreSQL et Redis ne doivent pas être exposés directement sur Internet.

Les sauvegardes de la base de données doivent être stockées sur un emplacement distinct du serveur principal.

---

## 📱 Progressive Web App (PWA)

XYZ est développé en PWA pour permettre une installation directe sur les appareils des utilisateurs.

Fonctionnalités prévues :

- Installation depuis le navigateur.
- Icône sur l'écran d'accueil.
- Interface adaptée aux mobiles.
- Expérience proche d'une application native.
- Cache des ressources statiques.
- Consultation de certaines données hors ligne.
- Notifications push compatibles avec les navigateurs pris en charge.

Aucune publication sur les stores n'est nécessaire.

---

## 🧠 Intelligence artificielle

Les fonctionnalités IA seront intégrées côté backend via l'API OpenAI.

Les appels IA passeront exclusivement par le backend afin de ne jamais exposer les clés API dans le frontend.

Exemples d'utilisation :

- Génération de menus hebdomadaires.
- Suggestions de recettes.
- Génération de listes de courses.
- Recommandations de films.
- Assistant conversationnel familial.

Les fonctionnalités IA seront conçues sous forme de modules indépendants afin de faciliter leur évolution.

---

## 🔐 Gestion des utilisateurs

Le système est conçu pour prendre en charge plusieurs familles indépendantes.

Chaque utilisateur peut :

- Créer une famille.
- Rejoindre une famille via une invitation.
- Accéder aux fonctionnalités autorisées.
- Partager des informations avec les autres membres.

Les rôles et permissions permettront de gérer les droits d'accès.

---

## 🗺️ Roadmap

### Phase 1 — Fondations

- [ ] Initialisation du repository.
- [ ] Configuration React et NestJS.
- [ ] Configuration Docker.
- [ ] Installation PostgreSQL et Redis.
- [ ] Configuration Prisma.
- [ ] Authentification.
- [ ] Gestion des familles et des membres.

### Phase 2 — Organisation familiale

- [ ] To-do list.
- [ ] Attribution des tâches.
- [ ] Liste de courses.
- [ ] Synchronisation temps réel.

### Phase 3 — Menus

- [ ] Gestion des recettes.
- [ ] Planification hebdomadaire.
- [ ] Génération automatique des courses.
- [ ] Préférences alimentaires.

### Phase 4 — Communication

- [ ] Messagerie.
- [ ] Conversations.
- [ ] Notifications push.

### Phase 5 — Divertissement

- [ ] Liste de films et séries.
- [ ] Historique des contenus regardés.
- [ ] Notes et recommandations.

### Phase 6 — Intelligence artificielle

- [ ] Génération de menus.
- [ ] Suggestions de recettes.
- [ ] Assistant familial.
- [ ] Recommandations personnalisées.

### Phase 7 — Finalisation

- [ ] Calendrier familial.
- [ ] Mode hors ligne.
- [ ] Optimisation mobile.
- [ ] Tests.
- [ ] Déploiement en production.

---

## 🎯 Philosophie du projet

XYZ a pour objectif de simplifier l'organisation familiale en centralisant les outils du quotidien dans une seule application.

Principes fondamentaux :

- **Simplicité** : une interface intuitive et agréable.
- **Collaboration** : toutes les fonctionnalités essentielles sont partagées.
- **Confidentialité** : les données restent hébergées sur notre propre infrastructure.
- **Modularité** : chaque fonctionnalité peut évoluer indépendamment.
- **Accessibilité** : une application disponible sur tous les appareils.
- **Intelligence** : l'IA aide à organiser et simplifier le quotidien.

---

## 📄 Licence

À définir.

---

**XYZ — Toute la vie familiale au même endroit.** 🏡
