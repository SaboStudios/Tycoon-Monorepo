import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';
import * as express from 'express';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminLogsService } from './admin-logs.service';
import { PaginatedResponse } from '../../common';
import { AdminLog } from './entities/admin-log.entity';
import { AdminLogQueryDto } from './dto/admin-log-query.dto';
import { AdminLogExportDto } from './dto/admin-log-export.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  RedisRateLimitGuard,
  RateLimit,
} from '../../common/guards/redis-rate-limit.guard';

@ApiTags('admin-logs')
@ApiBearerAuth()
@Controller('admin/logs')
@UseGuards(JwtAuthGuard, AdminGuard, RedisRateLimitGuard)
export class AdminLogsController {
  constructor(private readonly adminLogsService: AdminLogsService) {}

  @Get()
  @RateLimit(50, 60)
  @ApiOperation({ summary: 'Retrieve admin audit logs with filters and pagination' })
  @ApiResponse({ status: HttpStatus.OK, type: [AdminLog] })
  async findAll(
    @Query() queryDto: AdminLogQueryDto,
  ): Promise<PaginatedResponse<AdminLog>> {
    return await this.adminLogsService.findAll(queryDto);
  }

  @Get('export')
  @RateLimit(10, 60)
  @ApiOperation({ summary: 'Export admin audit logs as CSV' })
  async export(
    @Query() queryDto: AdminLogExportDto,
    @Res() res: express.Response,
  ): Promise<void> {
    await this.adminLogsService.exportLogs(queryDto, res);
  }
}
