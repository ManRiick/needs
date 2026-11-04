import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard, AuthenticatedRequest } from "./auth.guard";
import { AddMealPlanEntryDto, MealPlanQueryDto } from "./meal-plans.dto";
import { MealPlansService } from "./meal-plans.service";

@Controller("groups/:groupId/meal-plan")
@UseGuards(AuthGuard)
export class MealPlansController {
  // Initialise contrôleur
  constructor(private readonly mealPlansService: MealPlansService) {}

  // Charge menu
  @Get()
  findWeek(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
    @Query() query: MealPlanQueryDto,
  ) {
    return this.mealPlansService.findWeek(
      request.user.sub,
      groupId,
      query.startDate,
    );
  }

  // Ajoute menu
  @Post("entries")
  addEntry(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
    @Body() dto: AddMealPlanEntryDto,
  ) {
    return this.mealPlansService.addEntry(request.user.sub, groupId, dto);
  }
}
