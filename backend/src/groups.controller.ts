import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard, AuthenticatedRequest } from "./auth.guard";
import { CreateGroupDto, JoinGroupDto } from "./groups.dto";
import { GroupsService } from "./groups.service";

@Controller("groups")
@UseGuards(AuthGuard)
export class GroupsController {
  // Initialise contrôleur
  constructor(private readonly groupsService: GroupsService) {}

  // Liste groupes
  @Get()
  findForUser(@Req() request: AuthenticatedRequest) {
    return this.groupsService.findForUser(request.user.sub);
  }

  // Crée groupe
  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateGroupDto) {
    return this.groupsService.createForUser(request.user.sub, dto);
  }

  // Rejoint groupe
  @Post("join")
  join(@Req() request: AuthenticatedRequest, @Body() dto: JoinGroupDto) {
    return this.groupsService.joinByCode(request.user.sub, dto);
  }

  // Affiche aperçu
  @Get(":groupId/overview")
  overview(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
  ) {
    return this.groupsService.getOverview(request.user.sub, groupId);
  }
}
