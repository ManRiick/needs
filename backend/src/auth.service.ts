import {
  ConflictException,
  Injectable,
  OnModuleDestroy,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { Pool } from "pg";
import { LoginDto, RegisterDto } from "./auth.dto";

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Initialise service
  constructor(private readonly jwtService: JwtService) {}

  // Crée utilisateur
  async register(registerDto: RegisterDto) {
    const email = registerDto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(registerDto.password, 12);

    try {
      const result = await this.pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, first_name, last_name, created_at`,
        [
          email,
          passwordHash,
          registerDto.firstName.trim(),
          registerDto.lastName.trim(),
        ],
      );

      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Cette adresse email est déjà utilisée.");
      }

      throw error;
    }
  }

  // Authentifie utilisateur
  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const result = await this.pool.query(
      `SELECT id, email, first_name, last_name, password_hash, status
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email],
    );
    const user = result.rows[0];

    if (
      !user ||
      user.status !== "active" ||
      !(await bcrypt.compare(loginDto.password, user.password_hash))
    ) {
      throw new UnauthorizedException("Email ou mot de passe incorrect.");
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    };
  }

  // Recherche profil
  async findProfile(userId: string) {
    const result = await this.pool.query(
      `SELECT id, email, first_name AS "firstName", last_name AS "lastName"
       FROM users WHERE id = $1 AND status = 'active' LIMIT 1`,
      [userId],
    );
    return { user: result.rows[0] ?? null };
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
