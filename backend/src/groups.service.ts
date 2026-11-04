import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { CreateGroupDto } from "./groups.dto";

@Injectable()
export class GroupsService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Initialise groupes
  async onModuleInit() {
    await this.pool.query(
      `ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS code TEXT`,
    );
    await this.pool.query(
      `UPDATE "groups" SET code = upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8)) WHERE code IS NULL`,
    );
    await this.pool.query(
      `ALTER TABLE "groups" ALTER COLUMN code SET NOT NULL`,
    );
    await this.pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS groups_code_unique ON "groups" (code)`,
    );
  }

  // Recherche groupes
  async findForUser(userId: string) {
    const result = await this.pool.query(
      `SELECT g.id, g.name, g.code, gm.role, gm.joined_at AS "joinedAt"
       FROM "groups" g JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = $1 ORDER BY gm.joined_at DESC`,
      [userId],
    );
    return result.rows;
  }

  // Crée groupe
  async createForUser(userId: string, dto: CreateGroupDto) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const groupResult = await client.query(
        `INSERT INTO "groups" (name, code, created_by) VALUES ($1, $2, $3)
         RETURNING id, name, code, created_at AS "createdAt"`,
        [dto.name.trim(), this.createCode(), userId],
      );
      const group = groupResult.rows[0];
      await client.query("COMMIT");
      return { ...group, role: "owner" };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Rejoint groupe
  async joinByCode(userId: string, dto: { code: string }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT id, name, code FROM "groups" WHERE code = $1 FOR UPDATE`,
        [dto.code.trim().toUpperCase()],
      );
      const group = result.rows[0];
      if (!group)
        throw new NotFoundException("Aucun groupe ne correspond a ce code.");

      const membership = await client.query(
        `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [group.id, userId],
      );
      if (!membership.rows[0]) {
        await client.query(
          `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member')`,
          [group.id, userId],
        );
      }
      await client.query("COMMIT");
      return { ...group, role: membership.rows[0]?.role ?? "member" };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Génère code
  private createCode() {
    return randomBytes(5).toString("hex").slice(0, 8).toUpperCase();
  }

  // Charge aperçu
  async getOverview(userId: string, groupId: string) {
    const membership = await this.pool.query(
      `SELECT g.id, g.name, gm.role FROM "groups" g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE g.id = $1 AND gm.user_id = $2`,
      [groupId, userId],
    );
    if (!membership.rows[0]) throw new NotFoundException("Groupe introuvable.");

    const [lists, members] = await Promise.all([
      this.pool.query(
        `SELECT l.id, l.name, COUNT(li.id)::int AS "itemCount",
                COUNT(li.id) FILTER (WHERE li.status = 'completed')::int AS "completedCount"
         FROM lists l LEFT JOIN list_items li ON li.list_id = l.id
         WHERE l.group_id = $1 AND NOT l.is_archived
         GROUP BY l.id ORDER BY l.updated_at DESC LIMIT 5`,
        [groupId],
      ),
      this.pool.query(
        `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", gm.role
         FROM group_members gm JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = $1 ORDER BY gm.joined_at`,
        [groupId],
      ),
    ]);
    return {
      group: membership.rows[0],
      lists: lists.rows,
      members: members.rows,
    };
  }

  // Ferme connexion
  async onModuleDestroy() {
    await this.pool.end();
  }
}
