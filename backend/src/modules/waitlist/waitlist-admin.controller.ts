import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { UpdateWaitlistDto } from './dto/update-waitlist.dto';
import { WaitlistPaginationDto } from './dto/waitlist-pagination.dto';
import { ExportWaitlistDto } from './dto/export-waitlist.dto';
import { BulkImportResponseDto } from './dto/bulk-import-waitlist.dto';
import { Waitlist } from './entities/waitlist.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  RedisRateLimitGuard,
  RateLimit,
} from '../../common/guards/redis-rate-limit.guard';
import { PaginatedResponse } from '../../common';
import { AdminLogsService } from '../admin-logs/admin-logs.service';

@ApiTags('admin-waitlist')
@ApiBearerAuth()
@Controller('admin/waitlist')
@UseGuards(JwtAuthGuard, AdminGuard, RedisRateLimitGuard)
export class WaitlistAdminController {
  constructor(
    private readonly waitlistService: WaitlistService,
    private readonly adminLogsService: AdminLogsService,
  ) {}

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

  /**
   * POST /admin/waitlist/bulk-import
   *
   * Bulk import waitlist entries from a CSV file.
   *
   * The CSV must include a header row with at least one of:
   *   wallet_address, email_address, telegram_username
   *
   * - Validates each row (email format, telegram format, at-least-one-field)
   * - Deduplicates against existing DB entries and within the CSV itself
   * - Processes in batches for large file support
   * - Returns a detailed error report for any failed rows
   */
  @Post('bulk-import')
  @HttpCode(HttpStatus.OK)
  @RateLimit(10, 60)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
      fileFilter: (
        _req: unknown,
        file: { mimetype: string; originalname: string },
        callback: (error: Error | null, accept: boolean) => void,
      ) => {
        if (
          file.mimetype === 'text/csv' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.originalname.endsWith('.csv')
        ) {
          callback(null, true);
        } else {
          callback(new Error('Only CSV files are allowed.'), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'CSV file containing waitlist entries',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'CSV file with header row (wallet_address, email_address, telegram_username)',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: 'Bulk import waitlist entries from CSV',
    description:
      'Upload a CSV file to bulk import waitlist entries. ' +
      'Handles deduplication and returns an error report.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Import completed with a summary report.',
    type: BulkImportResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid CSV file or no file uploaded.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin role required.',
  })
  async bulkImport(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BulkImportResponseDto> {
    if (!file) {
      throw new BadRequestException('CSV file is required.');
    }
    return this.waitlistService.bulkImport(file.buffer);
  }

  @Patch(':id')
  @RateLimit(30, 60)
  @ApiOperation({
    summary: 'Update a waitlist entry',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Waitlist entry updated successfully.',
    type: Waitlist,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid data or entry not found.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Duplicate wallet or email address.',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateWaitlistDto,
    @Req() req: express.Request & { user: { id: number } },
  ): Promise<Waitlist> {
    const updated = await this.waitlistService.update(id, updateDto);

    await this.adminLogsService.createLog(
      req.user.id,
      'waitlist:update',
      id,
      { changes: updateDto },
      req,
    );

    return updated;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit(30, 60)
  @ApiOperation({
    summary: 'Soft delete a waitlist entry',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Waitlist entry soft deleted successfully.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Entry not found.',
  })
  async softDelete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: express.Request & { user: { id: number } },
  ): Promise<void> {
    await this.waitlistService.softDelete(id);

    await this.adminLogsService.createLog(
      req.user.id,
      'waitlist:soft_delete',
      id,
      null,
      req,
    );
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit(10, 60)
  @ApiOperation({
    summary: 'Permanently delete a waitlist entry',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Waitlist entry permanently deleted.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Entry not found.',
  })
  async hardDelete(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: express.Request & { user: { id: number } },
  ): Promise<void> {
    await this.waitlistService.hardDelete(id);

    await this.adminLogsService.createLog(
      req.user.id,
      'waitlist:hard_delete',
      id,
      null,
      req,
    );
  }
}
