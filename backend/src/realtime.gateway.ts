import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";

@WebSocketGateway({
  namespace: "/realtime",
  cors: {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  },
})
export class RealtimeGateway {
  constructor(private readonly jwtService: JwtService) {}

  handleConnection(socket: Socket) {
    const user = this.getUserFromSocket(socket);
    socket.data.user = user;
    socket.emit("connection:ready", {
      service: "xyz-api",
      authenticated: Boolean(user),
      user: user ? { id: user.sub, email: user.email } : null,
    });
  }

  @SubscribeMessage("session:check")
  handleSessionCheck(
    @ConnectedSocket() socket: Socket,
    @MessageBody() _payload: { email?: string } = {},
  ) {
    const user = socket.data.user as AccessTokenPayload | undefined;
    socket.emit("session:status", {
      authenticated: Boolean(user),
      email: user?.email ?? null,
    });
  }

  private getUserFromSocket(socket: Socket): AccessTokenPayload | null {
    const token = socket.handshake.auth?.token;

    if (typeof token !== "string") {
      return null;
    }

    try {
      return this.jwtService.verify<AccessTokenPayload>(token);
    } catch {
      return null;
    }
  }
}

type AccessTokenPayload = {
  sub: string;
  email: string;
};
