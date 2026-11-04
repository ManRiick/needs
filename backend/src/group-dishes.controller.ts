import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard, AuthenticatedRequest } from "./auth.guard";
import { CreateDishDto } from "./dishes.dto";
import { DishesService } from "./dishes.service";

@Controller("groups/:groupId/dishes")
@UseGuards(AuthGuard)
export class GroupDishesController {
  // Initialise contrôleur
  constructor(private readonly dishesService: DishesService) {}

  // Liste plats
  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
  ) {
    return this.dishesService.findForGroup(request.user.sub, groupId);
  }

  // Charge plat
  @Get(":dishId")
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
    @Param("dishId") dishId: string,
  ) {
    return this.dishesService.findOne(request.user.sub, groupId, dishId);
  }

  // Crée plat
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
    @Body() dto: CreateDishDto,
  ) {
    return this.dishesService.create(request.user.sub, groupId, dto);
  }

  // Modifie plat
  @Patch(":dishId")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
    @Param("dishId") dishId: string,
    @Body() dto: CreateDishDto,
  ) {
    return this.dishesService.update(request.user.sub, dishId, groupId, dto);
  }

  // Supprime plat
  @Delete(":dishId")
  remove(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
    @Param("dishId") dishId: string,
  ) {
    return this.dishesService.remove(request.user.sub, groupId, dishId);
  }
}
