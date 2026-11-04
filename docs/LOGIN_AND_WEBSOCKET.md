# Connexion et temps reel

## Etat actuel

L'accueil de XYZ est la page de connexion. Elle contient :

- un champ email ;
- un champ mot de passe ;
- un mode creation de compte avec prenom et nom ;
- une validation minimale du formulaire ;
- un message utilisateur apres soumission ;
- un indicateur de connexion Socket.IO.

La creation de compte est active via `POST /api/auth/register`. Le backend valide les champs, normalise l'email, hash le mot de passe avec bcrypt et enregistre l'utilisateur dans PostgreSQL. Le hash n'est jamais retourne au frontend.

La connexion des comptes existants est active via `POST /api/auth/login`. Le backend compare le mot de passe avec son hash bcrypt et retourne un access token JWT valable 15 minutes.

Le frontend conserve temporairement cet access token dans `localStorage` sous la cle `xyz_access_token`. En production, prevoir une strategie de refresh token et une politique de stockage adaptee au niveau de risque de l'application.

Le secret de signature est fourni par `JWT_SECRET`. Il doit etre long, aleatoire et defini dans `.env` en dehors du mode developpement.

## Creation de compte

Le frontend appelle :

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "firstName": "Alex",
  "lastName": "Martin",
  "password": "password123"
}
```

Le mot de passe doit contenir au moins 8 caracteres. L'email est unique et une seconde inscription avec la meme adresse renvoie `409 Conflict`.

## Websocket

Le backend expose une gateway Socket.IO sur le namespace :

```text
/realtime
```

URL locale depuis le frontend :

```text
http://localhost:3000/realtime
```

Le frontend utilise `socket.io-client` et force le transport websocket. Apres connexion, il transmet le JWT dans le handshake et affiche `Session securisee en temps reel` quand le serveur le valide. Sans token valide, le canal reste disponible mais la session est marquee non authentifiee.

### Evenements actuels

A la connexion, le serveur envoie :

```json
{
  "event": "connection:ready",
  "data": {
    "service": "xyz-api",
    "authenticated": true,
    "user": {
      "id": "uuid-utilisateur",
      "email": "user@example.com"
    }
  }
}
```

Le client peut demander l'etat de session avec `session:check` :

```ts
socket.emit("session:check", { email });
```

Le serveur repond avec `session:status` :

```json
{
  "authenticated": false,
  "email": "user@example.com"
}
```

Ces evenements sont volontairement simples. Ils servent a verifier le canal temps reel avant d'ajouter les droits et les evenements metier.

## Demarrage

Depuis la racine du projet :

```bash
docker compose up --build
```

Puis ouvrir :

```text
http://localhost:5173
```

L'API reste disponible sur `http://localhost:3000`.

## Prochaines etapes : autorisation metier

1. Ajouter Prisma Client au backend et mapper `users` depuis le schema PostgreSQL.
2. Ajouter un refresh token protege et une deconnexion cote serveur si necessaire.
3. Ajouter un `AuthGuard` HTTP pour proteger les routes metier.
4. Remplacer les rooms generiques par des rooms par groupe.
5. Autoriser les rooms Socket.IO uniquement apres verification de `group_members`.

Le `group_id` envoye par un client ne doit jamais suffire a autoriser un evenement. Le backend doit verifier l'appartenance de l'utilisateur a chaque groupe avant de rejoindre ou publier dans une room.

## Exemple de handshake futur

```ts
const socket = io(`${apiUrl}/realtime`, {
  auth: { token: accessToken },
  transports: ["websocket"],
});
```

Le serveur devra refuser la connexion si le token est absent, expire ou invalide. Les tokens ne doivent pas etre journalises.
