import {
  Controller,
  Get,
  HttpStatus,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import * as express from 'express';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { WaitlistPaginationDto } from './dto/waitlist-pagination.dto';
import { ExportWaitlistDto } from './dto/export-waitlist.dto';
import { Waitlist } from './entities/waitlist.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  RedisRateLimitGuard,
  RateLimit,
} from '../../common/guards/redis-rate-limit.guard';
import { PaginatedResponse } from '../../common';

@ApiTags('admin-waitlist')
@ApiBearerAuth()
@Controller('admin/waitlist')
@UseGuards(JwtAuthGuard, AdminGuard, RedisRateLimitGuard)
export class WaitlistAdminController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Get()
  @RateLimit(50, 60)
  @ApiOperation({
    summary: 'Retrieve all waitlist entries with pagination and filtering',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated list of waitlist entries with statistics.',
    type: [Waitlist], // Swagger might need a proper paginated wrapper for better documentation
  })
  async findAll(
    @Query() paginationDto: WaitlistPaginationDto,
  ): Promise<PaginatedResponse<Waitlist> & { stats: any }> {
    const paginatedData =
      await this.waitlistService.findAllAdmin(paginationDto);
    const stats = await this.waitlistService.getStats();

    return {
      ...paginatedData,
      stats,
    };
  }

  @Get('export')
  @RateLimit(10, 60)
  @ApiOperation({
    summary: 'Export waitlist entries as CSV or Excel',
  })
  async export(
    @Query() exportWaitlistDto: ExportWaitlistDto,
    @Res() res: express.Response,
  ): Promise<void> {
    await this.waitlistService.exportWaitlist(exportWaitlistDto, res);
  }
}
