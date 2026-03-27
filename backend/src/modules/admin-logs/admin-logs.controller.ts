import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminLogsService } from './admin-logs.service';
import { PaginationDto, PaginatedResponse } from '../../common';
import { AdminLog } from './entities/admin-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Throttle } from '@nestjs/throttler';

@Controller('admin/logs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminLogsController {
  constructor(private readonly adminLogsService: AdminLogsService) {}

  @Get()
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  async findAll(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<AdminLog>> {
    return await this.adminLogsService.findAll(paginationDto);
  }
}
