import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Pool } from "pg";
import { CreateDishDto } from "./dishes.dto";

@Injectable()
export class DishesService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Initialise recettes
  async onModuleInit() {
    await this.pool.query(
      "ALTER TABLE dishes ADD COLUMN IF NOT EXISTS category TEXT",
    );
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS dish_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        description TEXT NOT NULL,
        duration_minutes INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT dish_steps_number_positive CHECK (step_number > 0),
        CONSTRAINT dish_steps_description_not_blank CHECK (length(trim(description)) > 0),
        CONSTRAINT dish_steps_duration_non_negative CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
        CONSTRAINT dish_steps_dish_number_unique UNIQUE (dish_id, step_number)
      )`);
    await this.pool.query(
      "CREATE INDEX IF NOT EXISTS dish_steps_dish_idx ON dish_steps (dish_id, step_number)",
    );
  }

  // Liste plats
  async findForGroup(userId: string, groupId: string) {
    await this.assertMembership(userId, groupId);
    const result = await this.pool.query(
      `SELECT d.id, d.name, d.description, d.category, d.servings,
              d.preparation_time AS "preparationTime", d.cooking_time AS "cookingTime",
              d.instructions, d.image_url AS "imageUrl", d.created_by AS "createdBy",
              d.created_at AS "createdAt", d.updated_at AS "updatedAt",
              u.first_name AS "creatorFirstName", u.last_name AS "creatorLastName",
              COALESCE((SELECT json_agg(json_build_object(
                'id', di.id, 'productId', p.id, 'name', p.name, 'quantity', di.quantity,
                'unitId', un.id, 'unit', un.abbreviation, 'notes', di.notes
              ) ORDER BY di.created_at) FROM dish_ingredients di
              JOIN products p ON p.id = di.product_id LEFT JOIN units un ON un.id = di.unit_id
              WHERE di.dish_id = d.id), '[]') AS ingredients,
              COALESCE((SELECT json_agg(json_build_object(
                'id', ds.id, 'stepNumber', ds.step_number, 'description', ds.description,
                'durationMinutes', ds.duration_minutes
              ) ORDER BY ds.step_number) FROM dish_steps ds WHERE ds.dish_id = d.id), '[]') AS steps
       FROM dishes d JOIN users u ON u.id = d.created_by
       WHERE d.group_id = $1 ORDER BY d.updated_at DESC`,
      [groupId],
    );
    return result.rows;
  }

  // Charge recette
  async findOne(userId: string, groupId: string, dishId: string) {
    const dishes = await this.findForGroup(userId, groupId);
    const dish = dishes.find((item) => item.id === dishId);
    if (!dish) throw new NotFoundException("Plat introuvable.");
    return dish;
  }

  // Crée plat
  async create(userId: string, groupId: string, dto: CreateDishDto) {
    await this.assertMembership(userId, groupId);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const dishResult = await client.query(
        `INSERT INTO dishes (group_id, name, description, category, servings, preparation_time, cooking_time, instructions, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, name, description, category, servings, preparation_time AS "preparationTime", cooking_time AS "cookingTime", instructions`,
        [
          groupId,
          dto.name.trim(),
          dto.description?.trim() || null,
          dto.category?.trim() || null,
          dto.servings ?? 1,
          dto.preparationTime ?? null,
          dto.cookingTime ?? null,
          dto.instructions?.trim() || null,
          userId,
        ],
      );
      const dish = dishResult.rows[0];
      for (const ingredient of dto.ingredients ?? []) {
        await client.query(
          `INSERT INTO dish_ingredients (dish_id, product_id, quantity, unit_id, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            dish.id,
            ingredient.productId,
            ingredient.quantity,
            ingredient.unitId ?? null,
            ingredient.notes?.trim() || null,
          ],
        );
      }
      for (const step of normalizeSteps(dto.steps ?? [])) {
        await client.query(
          `INSERT INTO dish_steps (dish_id, step_number, description, duration_minutes) VALUES ($1, $2, $3, $4)`,
          [
            dish.id,
            step.stepNumber,
            step.description.trim(),
            step.durationMinutes ?? null,
          ],
        );
      }
      await client.query("COMMIT");
      return dish;
    } catch (error) {
      await client.query("ROLLBACK");
      if (isUniqueViolation(error))
        throw new ConflictException(
          "Ce plat contient déjà cet ingrédient ou existe déjà dans le groupe.",
        );
      if (isForeignKeyViolation(error))
        throw new BadRequestException(
          "Un ingrédient ou une unité sélectionnée est introuvable.",
        );
      throw error;
    } finally {
      client.release();
    }
  }

  // Modifie plat
  async update(
    userId: string,
    dishId: string,
    groupId: string,
    dto: CreateDishDto,
  ) {
    await this.assertMembership(userId, groupId);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const dishResult = await client.query(
        `UPDATE dishes SET name = $1, description = $2, category = $3, servings = $4,
          preparation_time = $5, cooking_time = $6, instructions = $7
         WHERE id = $8 AND group_id = $9 AND created_by = $10
         RETURNING id, name, description, category, servings, preparation_time AS "preparationTime", cooking_time AS "cookingTime", instructions`,
        [
          dto.name.trim(),
          dto.description?.trim() || null,
          dto.category?.trim() || null,
          dto.servings ?? 1,
          dto.preparationTime ?? null,
          dto.cookingTime ?? null,
          dto.instructions?.trim() || null,
          dishId,
          groupId,
          userId,
        ],
      );
      if (!dishResult.rows[0]) {
        const owner = await client.query(
          "SELECT created_by FROM dishes WHERE id = $1 AND group_id = $2",
          [dishId, groupId],
        );
        if (owner.rows[0])
          throw new ForbiddenException(
            "Seul le créateur peut modifier ce plat.",
          );
        throw new NotFoundException("Plat introuvable.");
      }
      await client.query("DELETE FROM dish_ingredients WHERE dish_id = $1", [
        dishId,
      ]);
      for (const ingredient of dto.ingredients ?? []) {
        await client.query(
          `INSERT INTO dish_ingredients (dish_id, product_id, quantity, unit_id, notes) VALUES ($1, $2, $3, $4, $5)`,
          [
            dishId,
            ingredient.productId,
            ingredient.quantity,
            ingredient.unitId ?? null,
            ingredient.notes?.trim() || null,
          ],
        );
      }
      await client.query("DELETE FROM dish_steps WHERE dish_id = $1", [dishId]);
      for (const step of normalizeSteps(dto.steps ?? [])) {
        await client.query(
          `INSERT INTO dish_steps (dish_id, step_number, description, duration_minutes) VALUES ($1, $2, $3, $4)`,
          [
            dishId,
            step.stepNumber,
            step.description.trim(),
            step.durationMinutes ?? null,
          ],
        );
      }
      await client.query("COMMIT");
      return dishResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      )
        throw error;
      if (isUniqueViolation(error))
        throw new ConflictException("Ce plat contient déjà cet ingrédient.");
      if (isForeignKeyViolation(error))
        throw new BadRequestException(
          "Un ingrédient ou une unité sélectionnée est introuvable.",
        );
      throw error;
    } finally {
      client.release();
    }
  }

  // Supprime recette
  async remove(userId: string, groupId: string, dishId: string) {
    await this.assertMembership(userId, groupId);
    const result = await this.pool.query(
      `DELETE FROM dishes WHERE id = $1 AND group_id = $2 AND created_by = $3 RETURNING id`,
      [dishId, groupId, userId],
    );
    if (!result.rows[0])
      throw new ForbiddenException("Seul le créateur peut supprimer ce plat.");
    return { deleted: true };
  }

  // Vérifie membre
  private async assertMembership(userId: string, groupId: string) {
    const result = await this.pool.query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId],
    );
    if (!result.rows[0]) throw new NotFoundException("Groupe introuvable.");
  }

  // Ferme connexion
  async onModuleDestroy() {
    await this.pool.end();
  }
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

// Détecte référence
function isForeignKeyViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23503"
  );
}

function normalizeSteps(
  steps: {
    stepNumber: number;
    description: string;
    durationMinutes?: number;
  }[],
) {
  const sorted = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);
  const numbers = new Set<number>();
  for (const step of sorted) {
    if (numbers.has(step.stepNumber))
      throw new BadRequestException(
        "Les numéros d'étapes doivent être uniques.",
      );
    numbers.add(step.stepNumber);
  }
  return sorted.map((step, index) => ({ ...step, stepNumber: index + 1 }));
}
