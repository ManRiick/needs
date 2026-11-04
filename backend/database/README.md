# XYZ database

Le schema PostgreSQL se trouve dans `init/001_schema.sql`. Docker PostgreSQL monte automatiquement ce dossier dans `/docker-entrypoint-initdb.d`.

Important : les scripts d'initialisation PostgreSQL ne sont executes que lorsque le volume `postgres_data` est vide. En developpement, pour recreer la base depuis zero :

```bash
docker compose down -v
docker compose up --build
```

Ne pas utiliser `down -v` sur un environnement contenant des donnees a conserver.

## Relations principales

- `users` 1-N `groups` via `groups.created_by`.
- `users` N-N `groups` via `group_members`, avec un role propre au groupe.
- Chaque groupe possede un `code` unique partageable pour rejoindre le groupe.
- `groups` 1-N `lists`, `meal_plans`, `conversations`, `categories` personnalisees et `dishes` privees.
- `categories` 1-N `lists`. Les categories systeme ont `group_id = NULL` et sont utilisables par tous les groupes.
- `lists` 1-N `list_items`; `list_items` peut avoir un responsable membre du groupe.
- `lists` 1-N `comments`; `comments` peut repondre a un autre commentaire de la meme liste.
- `list_items` 1-0..1 `shopping_items`; un article peut pointer vers `products` et `units`.
- `dishes` N-N `products` via `dish_ingredients`.
- `meal_plans` 1-N `meal_plan_entries`, chaque entree pointant vers un plat.
- `conversations` N-N `users` via `conversation_members`; `messages` appartient a une conversation.
- `messages` 1-N `message_attachments`.
- `media_items` 1-N `watchlist_items` et `media_reviews`.
- `users` 1-N `notifications` et `media_reviews`.
- `groups` 1-N `family_invitations`.

Les triggers verifient les relations qui ne peuvent pas etre exprimees par une cle etrangere simple : categorie personnalisee dans le bon groupe, auteurs et responsables membres du groupe, commentaire et parent dans la meme liste, plat prive dans le bon menu, membres et auteurs de conversations, et createur d'invitation.

## Isolation multi-tenant

Un `group_id` n'est pas une autorisation. Chaque endpoint NestJS doit :

1. Recuperer l'utilisateur authentifie depuis le guard JWT.
2. Verifier son appartenance a `group_members` et son role.
3. Ajouter le filtre `group_id` dans la requete Prisma.
4. Ne jamais accepter un `group_id` fourni par le client sans verifier l'appartenance.

Pour une defense supplementaire, PostgreSQL peut utiliser RLS avec un parametre de transaction :

```sql
SELECT set_config('app.user_id', 'uuid-de-l-utilisateur', true);
```

Les policies RLS doivent ensuite filtrer chaque table tenant via `EXISTS (SELECT 1 FROM group_members ...)`. Il est preferable d'activer RLS apres avoir implemente ce contexte dans un middleware Prisma, car une session qui oublie ce parametre serait volontairement bloquee.

## Compatibilite Prisma

Prisma peut introspecter ce schema avec `npx prisma db pull`. Pour utiliser les migrations Prisma comme source de verite, conserver les types enum et les contraintes metier dans les migrations SQL generees (`prisma/migrations/*/migration.sql`).

Points particuliers :

- Les tables et colonnes en snake_case necessitent `@@map` et `@map` dans `schema.prisma`.
- `groups` est un mot sensible dans certains contextes SQL : utiliser `@@map("groups")`.
- Les triggers, fonctions PL/pgSQL, index partiels et certaines contraintes `CHECK` ne sont pas representes completement par le schema Prisma ; les conserver dans une migration SQL personnalisee.
- `Decimal` est necessaire pour `NUMERIC` (`quantity`, `estimated_price`, `rating`, etc.).
- `Json` est utilise uniquement pour `notifications.data`.
- Les UUID avec `gen_random_uuid()` peuvent etre declares `@default(dbgenerated("gen_random_uuid()"))` ou geres par Prisma selon la version utilisee.
- Les enum Prisma doivent reprendre exactement les valeurs PostgreSQL.

## Requetes d'exemple

### Groupes d'un utilisateur

```sql
SELECT g.id, g.name, gm.role, gm.joined_at
FROM group_members gm
JOIN "groups" g ON g.id = gm.group_id
WHERE gm.user_id = $1
ORDER BY g.name;
```

### Listes d'un groupe

```sql
SELECT l.id, l.name, l.description, c.slug AS category, l.is_archived
FROM lists l
JOIN categories c ON c.id = l.category_id
WHERE l.group_id = $1
  AND NOT l.is_archived
ORDER BY l.updated_at DESC;
```

### Elements d'une liste

```sql
SELECT li.*, u.first_name, u.last_name
FROM list_items li
LEFT JOIN users u ON u.id = li.assigned_to
WHERE li.list_id = $1
ORDER BY li.position, li.created_at;
```

### Commentaires d'un element

```sql
SELECT c.id, c.content, c.parent_comment_id, c.created_at,
       u.first_name, u.last_name
FROM comments c
JOIN users u ON u.id = c.user_id
WHERE c.list_id = $1
  AND c.list_item_id = $2
  AND c.deleted_at IS NULL
ORDER BY c.created_at;
```

### Courses non achetees

```sql
SELECT li.id, li.name, si.quantity, un.abbreviation, p.name AS catalog_product
FROM shopping_items si
JOIN list_items li ON li.id = si.list_item_id
LEFT JOIN products p ON p.id = si.product_id
LEFT JOIN units un ON un.id = si.unit_id
JOIN lists l ON l.id = li.list_id
WHERE l.group_id = $1
  AND NOT si.is_purchased
ORDER BY li.due_date NULLS LAST, li.position;
```

### Menu d'une semaine

```sql
SELECT mpe.date, mpe.meal_type, d.name AS dish, mpe.servings, mpe.notes
FROM meal_plan_entries mpe
JOIN meal_plans mp ON mp.id = mpe.meal_plan_id
JOIN dishes d ON d.id = mpe.dish_id
WHERE mp.group_id = $1
  AND mp.start_date <= $2::date
  AND mp.end_date >= $3::date
ORDER BY mpe.date, mpe.meal_type, d.name;
```

### Conversations et dernier message

```sql
SELECT c.id, c.name, c.type,
       last_message.content AS last_message,
       last_message.created_at AS last_message_at
FROM conversations c
JOIN conversation_members cm
  ON cm.conversation_id = c.id AND cm.user_id = $1
LEFT JOIN LATERAL (
    SELECT m.content, m.created_at
    FROM messages m
    WHERE m.conversation_id = c.id
      AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC
    LIMIT 1
) last_message ON true
WHERE c.group_id = $2
ORDER BY last_message.created_at DESC NULLS LAST;
```

## Points de vigilance

- Le script ne supprime pas automatiquement les utilisateurs : les donnees qui les referencent utilisent `RESTRICT` lorsque l'historique doit etre conserve.
- Les suppressions d'un groupe, d'une liste ou d'une conversation sont en cascade, car ces donnees n'ont plus de sens sans leur parent.
- `list_items` reste volontairement generique ; les tables specialisees (`shopping_items`, `watchlist_items`) portent les donnees propres au domaine.
- Les statuts d'un element generique sont volontairement limites a un cycle commun. Si un module a besoin d'un workflow plus riche, ajouter une table de transition ou un statut specialise plutot que de multiplier les colonnes nullables.
- Le script d'initialisation et les migrations Prisma ne doivent pas etre utilises simultanement comme sources de verite en production.
