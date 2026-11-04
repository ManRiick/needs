import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { HealthController } from "./health.controller";
import { RealtimeGateway } from "./realtime.gateway";
import { GroupsController } from "./groups.controller";
import { GroupsService } from "./groups.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "dev-only-change-me",
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [AuthController, HealthController, GroupsController],
  providers: [AuthService, GroupsService, RealtimeGateway],
})
export class AppModule {}
