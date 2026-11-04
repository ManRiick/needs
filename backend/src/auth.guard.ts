import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

export type AuthenticatedRequest = {
  headers: { authorization?: string };
  user: AccessTokenPayload;
};

@Injectable()
export class AuthGuard implements CanActivate {
  // Initialise garde
  constructor(private readonly jwtService: JwtService) {}

  // Vérifie session
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : undefined;

    if (!token) {
      throw new UnauthorizedException("Authentification requise.");
    }

    try {
      request.user = this.jwtService.verify<AccessTokenPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException("Session expiree.");
    }
  }
}

export type AccessTokenPayload = {
  sub: string;
  email: string;
};
