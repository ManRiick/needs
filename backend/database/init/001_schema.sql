-- XYZ relational schema for PostgreSQL 16+
-- This file is executed automatically only when PostgreSQL initializes an empty volume.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_status AS ENUM ('active', 'inactive', 'banned');
CREATE TYPE system_role AS ENUM ('user', 'super_admin');
CREATE TYPE group_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE list_item_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
CREATE TYPE conversation_type AS ENUM ('group', 'private');
CREATE TYPE media_type AS ENUM ('movie', 'series', 'book');
CREATE TYPE watchlist_status AS ENUM ('to_watch', 'watching', 'watched');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    status user_status NOT NULL DEFAULT 'active',
    system_role system_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
    CONSTRAINT users_email_not_blank CHECK (length(trim(email)) > 3),
    CONSTRAINT users_first_name_not_blank CHECK (length(trim(first_name)) > 0),
    CONSTRAINT users_last_name_not_blank CHECK (length(trim(last_name)) > 0)
);

CREATE UNIQUE INDEX users_email_unique ON users (email);

CREATE TABLE "groups" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT groups_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX groups_created_by_idx ON "groups" (created_by);

CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role group_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT group_members_group_user_unique UNIQUE (group_id, user_id),
    CONSTRAINT group_members_group_id_user_id_unique UNIQUE (id, group_id, user_id)
);

CREATE INDEX group_members_user_id_idx ON group_members (user_id);
CREATE INDEX group_members_group_role_idx ON group_members (group_id, role);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    icon TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    group_id UUID REFERENCES "groups"(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT categories_scope_check CHECK (is_system OR group_id IS NOT NULL),
    CONSTRAINT categories_system_scope_check CHECK (NOT is_system OR group_id IS NULL),
    CONSTRAINT categories_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT categories_slug_not_blank CHECK (length(trim(slug)) > 0)
);

CREATE UNIQUE INDEX categories_system_slug_unique
    ON categories (slug) WHERE is_system;
CREATE UNIQUE INDEX categories_group_slug_unique
    ON categories (group_id, slug) WHERE NOT is_system;
CREATE INDEX categories_group_id_idx ON categories (group_id);

CREATE TABLE lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT lists_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT lists_group_id_id_unique UNIQUE (id, group_id)
);

CREATE INDEX lists_group_id_idx ON lists (group_id);
CREATE INDEX lists_category_id_idx ON lists (category_id);
CREATE INDEX lists_created_by_idx ON lists (created_by);
CREATE INDEX lists_active_group_idx ON lists (group_id) WHERE NOT is_archived;

CREATE TABLE list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status list_item_status NOT NULL DEFAULT 'pending',
    position NUMERIC(12, 4) NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT list_items_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT list_items_position_non_negative CHECK (position >= 0),
    CONSTRAINT list_items_id_list_id_unique UNIQUE (id, list_id)
);

CREATE INDEX list_items_list_position_idx ON list_items (list_id, position, created_at);
CREATE INDEX list_items_assigned_to_idx ON list_items (assigned_to);
CREATE INDEX list_items_due_date_idx ON list_items (due_date) WHERE due_date IS NOT NULL;
CREATE INDEX list_items_open_idx ON list_items (list_id) WHERE status <> 'completed';

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    list_item_id UUID,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT comments_content_not_blank CHECK (length(trim(content)) > 0),
    CONSTRAINT comments_id_list_id_unique UNIQUE (id, list_id)
);

CREATE INDEX comments_list_created_idx ON comments (list_id, created_at);
CREATE INDEX comments_item_created_idx ON comments (list_item_id, created_at)
    WHERE list_item_id IS NOT NULL;
CREATE INDEX comments_parent_idx ON comments (parent_comment_id)
    WHERE parent_comment_id IS NOT NULL;

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    estimated_price NUMERIC(12, 2),
    currency CHAR(3) NOT NULL DEFAULT 'EUR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT products_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT products_estimated_price_non_negative CHECK (estimated_price IS NULL OR estimated_price >= 0),
    CONSTRAINT products_currency_uppercase CHECK (currency = upper(currency))
);

CREATE UNIQUE INDEX products_name_unique ON products (lower(name));

CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT units_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT units_abbreviation_not_blank CHECK (length(trim(abbreviation)) > 0)
);

CREATE UNIQUE INDEX units_name_unique ON units (lower(name));
CREATE UNIQUE INDEX units_abbreviation_unique ON units (lower(abbreviation));

CREATE TABLE shopping_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_item_id UUID NOT NULL UNIQUE REFERENCES list_items(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 1,
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
    is_purchased BOOLEAN NOT NULL DEFAULT false,
    purchased_by UUID REFERENCES users(id) ON DELETE SET NULL,
    purchased_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT shopping_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT shopping_items_purchase_state_check CHECK (
        (is_purchased = false AND purchased_at IS NULL) OR
        (is_purchased = true AND purchased_at IS NOT NULL)
    )
);

CREATE INDEX shopping_items_product_idx ON shopping_items (product_id);
CREATE INDEX shopping_items_pending_idx ON shopping_items (list_item_id) WHERE NOT is_purchased;

CREATE TABLE dishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES "groups"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    calories INTEGER,
    preparation_time INTEGER,
    cooking_time INTEGER,
    servings NUMERIC(8, 2) NOT NULL DEFAULT 1,
    instructions TEXT,
    image_url TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT dishes_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT dishes_calories_non_negative CHECK (calories IS NULL OR calories >= 0),
    CONSTRAINT dishes_preparation_time_non_negative CHECK (preparation_time IS NULL OR preparation_time >= 0),
    CONSTRAINT dishes_cooking_time_non_negative CHECK (cooking_time IS NULL OR cooking_time >= 0),
    CONSTRAINT dishes_servings_positive CHECK (servings > 0)
);

CREATE UNIQUE INDEX dishes_global_name_unique ON dishes (lower(name)) WHERE group_id IS NULL;
CREATE UNIQUE INDEX dishes_group_name_unique ON dishes (group_id, lower(name)) WHERE group_id IS NOT NULL;
CREATE INDEX dishes_group_id_idx ON dishes (group_id);

CREATE TABLE dish_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 3) NOT NULL,
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT dish_ingredients_quantity_positive CHECK (quantity > 0),
    CONSTRAINT dish_ingredients_dish_product_unique UNIQUE (dish_id, product_id)
);

CREATE INDEX dish_ingredients_product_idx ON dish_ingredients (product_id);

CREATE TABLE meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT meal_plans_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT meal_plans_date_range_check CHECK (start_date <= end_date)
);

CREATE INDEX meal_plans_group_date_idx ON meal_plans (group_id, start_date, end_date);

CREATE TABLE meal_plan_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    meal_type meal_type NOT NULL,
    servings NUMERIC(8, 2) NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT meal_plan_entries_servings_positive CHECK (servings > 0),
    CONSTRAINT meal_plan_entries_unique_slot UNIQUE (meal_plan_id, date, meal_type, dish_id)
);

CREATE INDEX meal_plan_entries_plan_date_idx ON meal_plan_entries (meal_plan_id, date);
CREATE INDEX meal_plan_entries_dish_idx ON meal_plan_entries (dish_id);

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
    name TEXT,
    type conversation_type NOT NULL DEFAULT 'group',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT conversations_private_name_check CHECK (type = 'group' OR name IS NULL),
    CONSTRAINT conversations_id_group_id_unique UNIQUE (id, group_id)
);

CREATE INDEX conversations_group_updated_idx ON conversations (group_id, updated_at DESC);

CREATE TABLE conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_read_at TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX conversation_members_user_idx ON conversation_members (user_id);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT messages_content_not_blank CHECK (length(trim(content)) > 0)
);

CREATE INDEX messages_conversation_created_idx ON messages (conversation_id, created_at DESC);
CREATE INDEX messages_user_idx ON messages (user_id);

CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT message_attachments_file_name_not_blank CHECK (length(trim(file_name)) > 0),
    CONSTRAINT message_attachments_file_path_not_blank CHECK (length(trim(file_path)) > 0),
    CONSTRAINT message_attachments_file_size_positive CHECK (file_size > 0)
);

CREATE INDEX message_attachments_message_idx ON message_attachments (message_id);

CREATE TABLE media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type media_type NOT NULL,
    description TEXT,
    release_date DATE,
    image_url TEXT,
    external_id TEXT,
    external_source TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT media_items_title_not_blank CHECK (length(trim(title)) > 0),
    CONSTRAINT media_items_external_pair_check CHECK (
        (external_id IS NULL AND external_source IS NULL) OR
        (external_id IS NOT NULL AND external_source IS NOT NULL)
    )
);

CREATE UNIQUE INDEX media_items_external_unique
    ON media_items (external_source, external_id)
    WHERE external_id IS NOT NULL AND external_source IS NOT NULL;
CREATE INDEX media_items_type_title_idx ON media_items (type, lower(title));

CREATE TABLE watchlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_item_id UUID NOT NULL REFERENCES list_items(id) ON DELETE CASCADE,
    media_item_id UUID NOT NULL REFERENCES media_items(id) ON DELETE RESTRICT,
    status watchlist_status NOT NULL DEFAULT 'to_watch',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT watchlist_items_unique UNIQUE (list_item_id, media_item_id)
);

CREATE INDEX watchlist_items_media_idx ON watchlist_items (media_item_id);

CREATE TABLE media_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_item_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating NUMERIC(2, 1) NOT NULL,
    review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT media_reviews_rating_range CHECK (rating >= 0 AND rating <= 5),
    CONSTRAINT media_reviews_user_media_unique UNIQUE (media_item_id, user_id)
);

CREATE INDEX media_reviews_media_idx ON media_reviews (media_item_id);
CREATE INDEX media_reviews_user_idx ON media_reviews (user_id);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES "groups"(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    data JSONB,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT notifications_type_not_blank CHECK (length(trim(type)) > 0),
    CONSTRAINT notifications_title_not_blank CHECK (length(trim(title)) > 0)
);

CREATE INDEX notifications_user_unread_idx ON notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;
CREATE INDEX notifications_group_idx ON notifications (group_id);

CREATE TABLE family_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES "groups"(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT family_invitations_email_lowercase CHECK (email = lower(email)),
    CONSTRAINT family_invitations_token_hash_unique UNIQUE (token_hash),
    CONSTRAINT family_invitations_expiry_check CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX family_invitations_active_email_unique
    ON family_invitations (group_id, email)
    WHERE accepted_at IS NULL;
CREATE INDEX family_invitations_token_idx ON family_invitations (token_hash);
CREATE INDEX family_invitations_email_idx ON family_invitations (email);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users', 'groups', 'categories', 'lists', 'list_items', 'comments',
        'products', 'shopping_items', 'dishes', 'meal_plans',
        'meal_plan_entries', 'conversations', 'messages', 'media_items',
        'watchlist_items', 'media_reviews', 'notifications'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            table_name || '_set_updated_at', table_name
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION validate_list_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    category_group_id UUID;
    category_is_system BOOLEAN;
BEGIN
    SELECT group_id, is_system INTO category_group_id, category_is_system
    FROM categories WHERE id = NEW.category_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Category % does not exist', NEW.category_id;
    END IF;

    IF NOT category_is_system AND category_group_id <> NEW.group_id THEN
        RAISE EXCEPTION 'Category % does not belong to group %', NEW.category_id, NEW.group_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = NEW.group_id AND user_id = NEW.created_by
    ) THEN
        RAISE EXCEPTION 'List creator % is not a member of group %', NEW.created_by, NEW.group_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER lists_validate_category
    BEFORE INSERT OR UPDATE ON lists
    FOR EACH ROW EXECUTE FUNCTION validate_list_category();

CREATE OR REPLACE FUNCTION validate_list_item_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    item_group_id UUID;
BEGIN
    SELECT group_id INTO item_group_id FROM lists WHERE id = NEW.list_id;

    IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = item_group_id AND user_id = NEW.assigned_to
    ) THEN
        RAISE EXCEPTION 'Assigned user % is not a member of list group %', NEW.assigned_to, item_group_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = item_group_id AND user_id = NEW.created_by
    ) THEN
        RAISE EXCEPTION 'Item creator % is not a member of list group %', NEW.created_by, item_group_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER list_items_validate_scope
    BEFORE INSERT OR UPDATE ON list_items
    FOR EACH ROW EXECUTE FUNCTION validate_list_item_scope();

CREATE OR REPLACE FUNCTION validate_comment_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    item_list_id UUID;
    parent_list_id UUID;
BEGIN
    IF NEW.list_item_id IS NOT NULL THEN
        SELECT list_id INTO item_list_id FROM list_items WHERE id = NEW.list_item_id;
        IF item_list_id IS NULL OR item_list_id <> NEW.list_id THEN
            RAISE EXCEPTION 'Comment item must belong to comment list';
        END IF;
    END IF;

    IF NEW.parent_comment_id IS NOT NULL THEN
        SELECT list_id INTO parent_list_id FROM comments WHERE id = NEW.parent_comment_id;
        IF parent_list_id IS NULL OR parent_list_id <> NEW.list_id THEN
            RAISE EXCEPTION 'Parent comment must belong to comment list';
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM group_members gm
        JOIN lists l ON l.group_id = gm.group_id
        WHERE l.id = NEW.list_id AND gm.user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Comment author % cannot access list %', NEW.user_id, NEW.list_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER comments_validate_scope
    BEFORE INSERT OR UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION validate_comment_scope();

CREATE OR REPLACE FUNCTION validate_group_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = NEW.id AND user_id = NEW.created_by AND role = 'owner'
    ) THEN
        RAISE EXCEPTION 'Group creator must be an owner member of the group';
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER groups_validate_owner
    AFTER INSERT OR UPDATE OF created_by ON "groups"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION validate_group_owner();

CREATE OR REPLACE FUNCTION validate_dish_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.group_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM group_members WHERE group_id = NEW.group_id AND user_id = NEW.created_by
    ) THEN
        RAISE EXCEPTION 'Dish creator % is not a member of dish group %', NEW.created_by, NEW.group_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER dishes_validate_scope
    BEFORE INSERT OR UPDATE ON dishes
    FOR EACH ROW EXECUTE FUNCTION validate_dish_scope();

CREATE OR REPLACE FUNCTION validate_meal_entry_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    plan_group_id UUID;
    plan_start DATE;
    plan_end DATE;
    dish_group_id UUID;
BEGIN
    SELECT group_id, start_date, end_date INTO plan_group_id, plan_start, plan_end
    FROM meal_plans WHERE id = NEW.meal_plan_id;
    SELECT group_id INTO dish_group_id FROM dishes WHERE id = NEW.dish_id;

    IF NEW.date < plan_start OR NEW.date > plan_end THEN
        RAISE EXCEPTION 'Meal entry date must be inside meal plan range';
    END IF;
    IF dish_group_id IS NOT NULL AND dish_group_id <> plan_group_id THEN
        RAISE EXCEPTION 'Dish % does not belong to meal plan group %', NEW.dish_id, plan_group_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER meal_plan_entries_validate_scope
    BEFORE INSERT OR UPDATE ON meal_plan_entries
    FOR EACH ROW EXECUTE FUNCTION validate_meal_entry_scope();

CREATE OR REPLACE FUNCTION validate_conversation_member_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM conversations c
        JOIN group_members gm ON gm.group_id = c.group_id
        WHERE c.id = NEW.conversation_id AND gm.user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Conversation member % is not a member of its group', NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER conversation_members_validate_scope
    BEFORE INSERT OR UPDATE ON conversation_members
    FOR EACH ROW EXECUTE FUNCTION validate_conversation_member_scope();

CREATE OR REPLACE FUNCTION validate_message_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_id = NEW.conversation_id AND user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Message author must be a member of the conversation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER messages_validate_scope
    BEFORE INSERT OR UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION validate_message_scope();

CREATE OR REPLACE FUNCTION validate_invitation_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = NEW.group_id AND user_id = NEW.invited_by
    ) THEN
        RAISE EXCEPTION 'Inviter % is not a member of group %', NEW.invited_by, NEW.group_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER family_invitations_validate_scope
    BEFORE INSERT OR UPDATE ON family_invitations
    FOR EACH ROW EXECUTE FUNCTION validate_invitation_scope();

CREATE OR REPLACE FUNCTION create_group_owner_member()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner');
    RETURN NEW;
END;
$$;

CREATE TRIGGER groups_create_owner_member
    AFTER INSERT ON "groups"
    FOR EACH ROW EXECUTE FUNCTION create_group_owner_member();

INSERT INTO categories (name, slug, icon, is_system) VALUES
    ('Shopping', 'shopping', 'shopping-cart', true),
    ('Movies', 'movies', 'film', true),
    ('Series', 'series', 'tv', true),
    ('Books', 'books', 'book', true),
    ('Tasks', 'tasks', 'check-square', true),
    ('Recipes', 'recipes', 'utensils', true),
    ('Restaurants', 'restaurants', 'store', true),
    ('Outings', 'outings', 'map', true),
    ('Gifts', 'gifts', 'gift', true),
    ('Other', 'other', 'list', true)
ON CONFLICT DO NOTHING;

INSERT INTO units (name, abbreviation) VALUES
    ('gram', 'g'),
    ('kilogram', 'kg'),
    ('milliliter', 'ml'),
    ('liter', 'l'),
    ('piece', 'pc'),
    ('tablespoon', 'tbsp'),
    ('teaspoon', 'tsp'),
    ('pinch', 'pinch')
ON CONFLICT DO NOTHING;

-- Authorization note:
-- The application must always authorize a request through group_members.
-- group_id alone is not an authorization boundary. For defense in depth,
-- enable RLS after defining an application transaction setting, for example:
--   SELECT set_config('app.user_id', '<authenticated-user-uuid>', true);
-- Then add policies using EXISTS against group_members for each tenant table.
