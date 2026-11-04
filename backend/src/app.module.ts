import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { HealthController } from "./health.controller";
import { RealtimeGateway } from "./realtime.gateway";
import { GroupsController } from "./groups.controller";
import { GroupsService } from "./groups.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { DishesController } from "./dishes.controller";
import { DishesService } from "./dishes.service";
import { GroupDishesController } from "./group-dishes.controller";
import { MealPlansController } from "./meal-plans.controller";
import { MealPlansService } from "./meal-plans.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "dev-only-change-me",
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [
    AuthController,
    HealthController,
    GroupsController,
    ProductsController,
    DishesController,
    GroupDishesController,
    MealPlansController,
  ],
  providers: [
    AuthService,
    GroupsService,
    ProductsService,
    DishesService,
    MealPlansService,
    RealtimeGateway,
  ],
})
export class AppModule {}
