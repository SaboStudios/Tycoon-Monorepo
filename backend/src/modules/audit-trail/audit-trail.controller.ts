import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditTrailService } from './audit-trail.service';
import { AuditTrail } from './entities/audit-trail.entity';
import {
  QueryAuditTrailDto,
  PaginationQueryDto,
} from './dto/query-audit-trail.dto';
import {
  UserAuditTrailParamsDto,
  ActionAuditTrailParamsDto,
} from './dto/params-audit-trail.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('audit-trail')
@ApiBearerAuth()
@Controller('admin/audit-trail')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AuditTrailController {
  constructor(private readonly auditTrailService: AuditTrailService) {}

  @Get()
  @ApiOperation({
    summary: 'Retrieve audit trail logs with optional filters and pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved audit logs',
    type: [AuditTrail],
  })
  async findAll(@Query() query: QueryAuditTrailDto) {
    return this.auditTrailService.findAll(query);
  }

  /**
   * GET /admin/audit-trail/export
   * Admin export: returns all matching logs as a JSON array.
   * Optional query filters: userId, action (same as findAll).
   * Retention policy: logs older than 90 days are purged nightly at 02:00 UTC.
   */
  @Get('export')
  @ApiOperation({
    summary: 'Export audit trail logs as JSON (admin, compliance)',
    description:
      'Returns all matching audit log entries. Retention policy: entries older than 90 days are purged nightly.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit log export',
    type: [AuditTrail],
  })
  async exportLogs(@Query() query: QueryAuditTrailDto) {
    return this.auditTrailService.exportLogs(query);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Retrieve audit trail logs for a specific user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved user audit logs',
    type: [AuditTrail],
  })
  async getUserAuditTrail(
    @Param() params: UserAuditTrailParamsDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.auditTrailService.getUserAuditTrail(
      params.userId,
      query.limit,
      query.offset,
    );
  }

  @Get('action/:action')
  @ApiOperation({
    summary: 'Retrieve audit trail logs for a specific action type',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Successfully retrieved action audit logs',
    type: [AuditTrail],
  })
  async getAuditTrailByAction(
    @Param() params: ActionAuditTrailParamsDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.auditTrailService.getAuditTrailByAction(
      params.action,
      query.limit,
      query.offset,
    );
  }
}
