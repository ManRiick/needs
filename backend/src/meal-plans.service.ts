import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Pool } from "pg";
import { AddMealPlanEntryDto } from "./meal-plans.dto";

@Injectable()
export class MealPlansService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Initialise menus
  async onModuleInit() {
    await this.pool.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS meal_plans_group_start_unique ON meal_plans (group_id, start_date)",
    );
  }

  // Charge menu
  async findWeek(userId: string, groupId: string, startDate?: string) {
    await this.assertMembership(userId, groupId);
    const start = startDate ?? mondayOfCurrentWeek();
    const result = await this.pool.query(
      `SELECT mpe.id, mpe.date, mpe.meal_type AS "mealType", mpe.servings, mpe.notes,
              d.id AS "dishId", d.name AS "dishName"
       FROM meal_plans mp
       JOIN meal_plan_entries mpe ON mpe.meal_plan_id = mp.id
       JOIN dishes d ON d.id = mpe.dish_id
       WHERE mp.group_id = $1 AND mp.start_date = $2
       ORDER BY mpe.date, mpe.meal_type, d.name`,
      [groupId, start],
    );
    return { startDate: start, entries: result.rows };
  }

  // Ajoute menu
  async addEntry(userId: string, groupId: string, dto: AddMealPlanEntryDto) {
    await this.assertMembership(userId, groupId);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const dish = await client.query(
        `SELECT id FROM dishes WHERE id = $1 AND group_id = $2`,
        [dto.dishId, groupId],
      );
      if (!dish.rows[0])
        throw new NotFoundException("Plat introuvable dans ce groupe.");
      const startDate = mondayOf(dto.date);
      const endDate = addDays(startDate, 6);
      const plan = await client.query(
        `INSERT INTO meal_plans (group_id, name, start_date, end_date, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [groupId, "Menu de la semaine", startDate, endDate, userId],
      );
      const planId =
        plan.rows[0]?.id ??
        (
          await client.query(
            `SELECT id FROM meal_plans WHERE group_id = $1 AND start_date = $2 LIMIT 1`,
            [groupId, startDate],
          )
        ).rows[0]?.id;
      if (!planId)
        throw new BadRequestException("Menu hebdomadaire indisponible.");
      const entry = await client.query(
        `INSERT INTO meal_plan_entries (meal_plan_id, dish_id, date, meal_type, servings, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, date, meal_type AS "mealType", servings, notes`,
        [
          planId,
          dto.dishId,
          dto.date,
          dto.mealType,
          dto.servings ?? 1,
          dto.notes?.trim() || null,
        ],
      );
      await client.query("COMMIT");
      return { ...entry.rows[0], dishId: dto.dishId };
    } catch (error) {
      await client.query("ROLLBACK");
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      if (isUniqueViolation(error))
        throw new ConflictException("Ce plat est déjà prévu à ce créneau.");
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

function mondayOfCurrentWeek() {
  return mondayOf(new Date().toISOString().slice(0, 10));
}

function mondayOf(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
