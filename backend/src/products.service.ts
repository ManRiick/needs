import {
  ConflictException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Pool } from "pg";
import { CreateProductDto } from "./products.dto";

export const PRODUCT_CATEGORIES = [
  "vegetables",
  "fruits",
  "dairy",
  "meat-fish",
  "starches",
  "grocery",
  "herbs-spices",
  "other",
] as const;

const INITIAL_PRODUCTS: readonly [string, string][] = [
  ["Tomates", "vegetables"],
  ["Oignons", "vegetables"],
  ["Ail", "vegetables"],
  ["Carottes", "vegetables"],
  ["Courgettes", "vegetables"],
  ["Aubergines", "vegetables"],
  ["Poivrons", "vegetables"],
  ["Pommes de terre", "vegetables"],
  ["Champignons", "vegetables"],
  ["Salade verte", "vegetables"],
  ["Brocoli", "vegetables"],
  ["Haricots verts", "vegetables"],
  ["Pommes", "fruits"],
  ["Bananes", "fruits"],
  ["Citrons", "fruits"],
  ["Oranges", "fruits"],
  ["Œufs", "dairy"],
  ["Lait", "dairy"],
  ["Beurre", "dairy"],
  ["Crème fraîche", "dairy"],
  ["Crème liquide", "dairy"],
  ["Fromage râpé", "dairy"],
  ["Parmesan", "dairy"],
  ["Mozzarella", "dairy"],
  ["Yaourt nature", "dairy"],
  ["Poulet", "meat-fish"],
  ["Bœuf haché", "meat-fish"],
  ["Steak de bœuf", "meat-fish"],
  ["Jambon", "meat-fish"],
  ["Saumon", "meat-fish"],
  ["Thon", "meat-fish"],
  ["Farine", "starches"],
  ["Riz", "starches"],
  ["Pâtes", "starches"],
  ["Semoule", "starches"],
  ["Pain", "starches"],
  ["Chapelure", "starches"],
  ["Sucre", "grocery"],
  ["Sel", "herbs-spices"],
  ["Poivre", "herbs-spices"],
  ["Huile d'olive", "grocery"],
  ["Huile de tournesol", "grocery"],
  ["Vinaigre", "grocery"],
  ["Moutarde", "grocery"],
  ["Sauce tomate", "grocery"],
  ["Levure chimique", "grocery"],
  ["Levure boulangère", "grocery"],
  ["Miel", "grocery"],
  ["Paprika", "herbs-spices"],
  ["Herbes de Provence", "herbs-spices"],
];

@Injectable()
export class ProductsService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Initialise catalogue
  async onModuleInit() {
    await this.pool.query("CREATE EXTENSION IF NOT EXISTS unaccent");
    await this.pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    await this.pool.query(
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS normalized_name TEXT",
    );
    await this.pool.query(
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other'",
    );
    await this.pool.query(
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL",
    );
    const products = await this.pool.query("SELECT id, name FROM products");
    for (const product of products.rows) {
      await this.pool.query(
        "UPDATE products SET normalized_name = $1 WHERE id = $2",
        [normalizeProductName(product.name), product.id],
      );
    }
    await this.pool.query(
      "ALTER TABLE products ALTER COLUMN normalized_name SET NOT NULL",
    );
    await this.pool.query("DROP INDEX IF EXISTS products_name_unique");
    await this.pool.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS products_name_unique ON products (normalized_name)",
    );
    await this.pool.query(
      "CREATE INDEX IF NOT EXISTS products_normalized_name_search_idx ON products USING gin (normalized_name gin_trgm_ops)",
    );
    await this.pool.query(
      `INSERT INTO units (name, abbreviation) VALUES
       ('gram', 'g'), ('kilogram', 'kg'), ('milliliter', 'ml'), ('centiliter', 'cl'),
       ('liter', 'l'), ('piece', 'pc'), ('tablespoon', 'tbsp'), ('teaspoon', 'tsp'), ('pinch', 'pinch')
       ON CONFLICT DO NOTHING`,
    );
    for (const [name, category] of INITIAL_PRODUCTS) {
      await this.pool.query(
        `INSERT INTO products (name, normalized_name, category)
         VALUES ($1, $2, $3) ON CONFLICT (normalized_name) DO NOTHING`,
        [name, normalizeProductName(name), category],
      );
    }
  }

  // Recherche produits
  async search(search?: string) {
    const normalizedSearch = normalizeProductName(search ?? "");
    const result = await this.pool.query(
      `SELECT id, name, description, category, normalized_name AS "normalizedName"
       FROM products
       WHERE $1 = '' OR normalized_name LIKE '%' || $1 || '%'
       ORDER BY CASE WHEN normalized_name = $1 THEN 0 WHEN normalized_name LIKE $1 || '%' THEN 1 ELSE 2 END, name
       LIMIT 20`,
      [normalizedSearch],
    );
    return result.rows;
  }

  // Charge produit
  async findOne(id: string) {
    const result = await this.pool.query(
      `SELECT id, name, description, category, normalized_name AS "normalizedName" FROM products WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  // Liste catégories
  async categories() {
    return PRODUCT_CATEGORIES.map((id) => ({ id, label: categoryLabel(id) }));
  }

  // Liste unités
  async units() {
    const result = await this.pool.query(
      `SELECT id, name, abbreviation FROM units ORDER BY id`,
    );
    return result.rows;
  }

  // Crée produit
  async create(userId: string, dto: CreateProductDto) {
    const name = dto.name.trim();
    const normalizedName = normalizeProductName(name);
    try {
      const result = await this.pool.query(
        `INSERT INTO products (name, normalized_name, description, category, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, description, category, normalized_name AS "normalizedName"`,
        [
          name,
          normalizedName,
          dto.description?.trim() || null,
          dto.category ?? "other",
          userId,
        ],
      );
      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          "Cet ingrédient existe déjà dans le catalogue.",
        );
      }
      throw error;
    }
  }

  // Ferme connexion
  async onModuleDestroy() {
    await this.pool.end();
  }
}

// Normalise produit
export function normalizeProductName(value: string) {
  let normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[œ]/g, "oe")
    .replace(/[æ]/g, "ae")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  normalized = normalized.replace(/\bd\b/g, "").replace(/\s+/g, " ").trim();
  if (normalized.length > 4 && normalized.endsWith("s"))
    normalized = normalized.slice(0, -1);
  return normalized;
}

// Libelle catégorie
function categoryLabel(category: string) {
  return (
    {
      vegetables: "Légumes",
      fruits: "Fruits",
      dairy: "Produits laitiers et œufs",
      "meat-fish": "Viandes et poissons",
      starches: "Féculents et céréales",
      grocery: "Épicerie et condiments",
      "herbs-spices": "Herbes et épices",
      other: "Autre",
    }[category] ?? category
  );
}

// Détecte doublon
function isUniqueViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
