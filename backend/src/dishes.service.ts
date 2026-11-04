import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from "@nestjs/common";
import { Pool } from "pg";
import { CreateDishDto } from "./dishes.dto";

@Injectable()
export class DishesService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Liste plats
  async findForGroup(userId: string, groupId: string) {
    await this.assertMembership(userId, groupId);
    const result = await this.pool.query(
      `SELECT d.id, d.name, d.description, d.servings, d.preparation_time AS "preparationTime",
              d.cooking_time AS "cookingTime", d.instructions,
              COALESCE(json_agg(json_build_object(
                'id', di.id, 'productId', p.id, 'name', p.name, 'quantity', di.quantity,
                'unitId', u.id, 'unit', u.abbreviation, 'notes', di.notes
              ) ORDER BY di.created_at) FILTER (WHERE di.id IS NOT NULL), '[]') AS ingredients
       FROM dishes d
       LEFT JOIN dish_ingredients di ON di.dish_id = d.id
       LEFT JOIN products p ON p.id = di.product_id
       LEFT JOIN units u ON u.id = di.unit_id
       WHERE d.group_id = $1
       GROUP BY d.id
       ORDER BY d.updated_at DESC`,
      [groupId],
    );
    return result.rows;
  }

  // Crée plat
  async create(userId: string, groupId: string, dto: CreateDishDto) {
    await this.assertMembership(userId, groupId);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const dishResult = await client.query(
        `INSERT INTO dishes (group_id, name, description, servings, preparation_time, cooking_time, instructions, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, description, servings, preparation_time AS "preparationTime", cooking_time AS "cookingTime", instructions`,
        [
          groupId,
          dto.name.trim(),
          dto.description?.trim() || null,
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
        `UPDATE dishes SET name = $1, description = $2, servings = $3,
          preparation_time = $4, cooking_time = $5, instructions = $6
         WHERE id = $7 AND group_id = $8
         RETURNING id, name, description, servings, preparation_time AS "preparationTime", cooking_time AS "cookingTime", instructions`,
        [
          dto.name.trim(),
          dto.description?.trim() || null,
          dto.servings ?? 1,
          dto.preparationTime ?? null,
          dto.cookingTime ?? null,
          dto.instructions?.trim() || null,
          dishId,
          groupId,
        ],
      );
      if (!dishResult.rows[0]) throw new NotFoundException("Plat introuvable.");
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
      await client.query("COMMIT");
      return dishResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof NotFoundException) throw error;
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
