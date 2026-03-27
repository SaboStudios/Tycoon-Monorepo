import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { QueryUsersDto } from "./dto/query-users.dto";
import { QueryAuditLogsDto } from "./dto/query-audit-logs.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "./entities/user.entity";
import { IdempotencyInterceptor } from "../idempotency/idempotency.interceptor";

@Controller("admin/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() queryDto: QueryUsersDto) {
    return this.usersService.findAll(queryDto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(":id/role")
  @UseInterceptors(IdempotencyInterceptor)
  updateRole(
    @Param("id") id: string,
    @Body() updateRoleDto: UpdateUserRoleDto,
    @Request() req,
  ) {
    return this.usersService.updateRole(id, updateRoleDto, req.user.userId);
  }

  @Patch(":id/status")
  @UseInterceptors(IdempotencyInterceptor)
  updateStatus(
    @Param("id") id: string,
    @Body() updateStatusDto: UpdateUserStatusDto,
    @Request() req,
  ) {
    return this.usersService.updateStatus(id, updateStatusDto, req.user.userId);
  }

  @Post(":id/reset-password")
  @UseInterceptors(IdempotencyInterceptor)
  resetPassword(
    @Param("id") id: string,
    @Body() resetPasswordDto: ResetPasswordDto,
    @Request() req,
  ) {
    return this.usersService.resetPassword(
      id,
      resetPasswordDto,
      req.user.userId,
    );
  }

  @Get(":id/audit-logs")
  getAuditLogs(
    @Param("id") id: string,
    @Query() queryDto: QueryAuditLogsDto,
  ) {
    return this.usersService.getAuditLogs(id, queryDto.page, queryDto.limit);
  }
}
