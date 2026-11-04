import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard, AuthenticatedRequest } from "./auth.guard";
import { CreateDishDto } from "./dishes.dto";
import { DishesService } from "./dishes.service";

@Controller("dishes")
@UseGuards(AuthGuard)
export class DishesController {
  // Initialise contrôleur
  constructor(private readonly dishesService: DishesService) {}

  // Liste plats
  @Get("group/:groupId")
  findForGroup(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
  ) {
    return this.dishesService.findForGroup(request.user.sub, groupId);
  }

  // Recherche plats
  @Get()
  findForQuery(
    @Req() request: AuthenticatedRequest,
    @Query("groupId") groupId: string,
  ) {
    return this.dishesService.findForGroup(request.user.sub, groupId);
  }

  // Crée plat
  @Post("group/:groupId")
  create(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
    @Body() dto: CreateDishDto,
  ) {
    return this.dishesService.create(request.user.sub, groupId, dto);
  }

  // Crée plat
  @Post()
  createForQuery(
    @Req() request: AuthenticatedRequest,
    @Query("groupId") groupId: string,
    @Body() dto: CreateDishDto,
  ) {
    return this.dishesService.create(request.user.sub, groupId, dto);
  }

  // Modifie plat
  @Patch(":id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Query("groupId") groupId: string,
    @Body() dto: CreateDishDto,
  ) {
    return this.dishesService.update(request.user.sub, id, groupId, dto);
  }
}
