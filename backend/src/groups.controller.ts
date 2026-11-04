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
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  findForUser(@Req() request: AuthenticatedRequest) {
    return this.groupsService.findForUser(request.user.sub);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateGroupDto) {
    return this.groupsService.createForUser(request.user.sub, dto);
  }

  @Post("join")
  join(@Req() request: AuthenticatedRequest, @Body() dto: JoinGroupDto) {
    return this.groupsService.joinByCode(request.user.sub, dto);
  }

  @Get(":groupId/overview")
  overview(
    @Req() request: AuthenticatedRequest,
    @Param("groupId") groupId: string,
  ) {
    return this.groupsService.getOverview(request.user.sub, groupId);
  }
}
