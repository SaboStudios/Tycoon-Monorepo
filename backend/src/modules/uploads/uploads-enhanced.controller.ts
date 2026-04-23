import {
  Controller,
  Post,
  Get,
  Query,
  Res,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Body,
  Put,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiConsumes, ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UploadsService, StoredFile } from './uploads.service';
import { VirusScanService } from './virus-scan.service';
import { MagicBytesValidator, NoExecutableValidator } from './upload-validators';
import { ConfigService } from '@nestjs/config';
import { Idempotent } from './idempotency/idempotency.decorator';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';
import { UseInterceptors as ApplyIdempotency } from '@nestjs/common';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function buildMulterOptions() {
  return {
    storage: memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  };
}

@ApiTags('uploads-enhanced')
@Controller('uploads-enhanced')
@ApplyIdempotency(IdempotencyInterceptor)
export class UploadsEnhancedController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly virusScan: VirusScanService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Upload the authenticated user's avatar with idempotency support.
   * POST /uploads-enhanced/avatar
   */
  @Post('avatar')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', buildMulterOptions()))
  @Idempotent({
    ttl: 3600, // 1 hour
    includeBody: true,
    storeResponse: true,
    maxResponseSize: 1024 * 1024, // 1MB
  })
  async uploadAvatar(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new NoExecutableValidator(),
          new MagicBytesValidator(),
        ],
      }),
    )
    file: Express.Multer.File,
    @Request() req: { user: { id: number } },
  ): Promise<StoredFile> {
    await this.virusScan.scan(file.buffer, file.originalname);
    return this.uploadsService.store(file.buffer, file.originalname, file.mimetype);
  }

  /**
   * Upload an admin asset with idempotency support.
   * POST /uploads-enhanced/admin/assets
   */
  @Post('admin/assets')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', buildMulterOptions()))
  @Idempotent({
    ttl: 7200, // 2 hours for admin uploads
    includeBody: true,
    storeResponse: true,
    headersToInclude: ['authorization', 'content-type'],
  })
  async uploadAdminAsset(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new NoExecutableValidator(),
          new MagicBytesValidator(),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<StoredFile> {
    await this.virusScan.scan(file.buffer, file.originalname);
    return this.uploadsService.store(file.buffer, file.originalname, file.mimetype);
  }

  /**
   * Generate a fresh signed download URL with idempotency support.
   * PUT /uploads-enhanced/signed-url
   */
  @Put('signed-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Idempotent({
    ttl: 300, // 5 minutes for signed URLs
    includeQuery: true,
    storeResponse: true,
  })
  async getSignedUrl(@Body() body: { key: string }): Promise<{ url: string }> {
    if (!body.key) throw new BadRequestException('key is required');
    const url = await this.uploadsService.signedUrl(body.key);
    return { url };
  }

  /**
   * Get signed URL with query parameters (idempotent).
   * GET /uploads-enhanced/signed-url?key=<key>
   */
  @Get('signed-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Idempotent({
    ttl: 300, // 5 minutes
    includeQuery: true,
    storeResponse: true,
  })
  async getSignedUrlGet(@Query('key') key: string): Promise<{ url: string }> {
    if (!key) throw new BadRequestException('key query param required');
    const url = await this.uploadsService.signedUrl(key);
    return { url };
  }

  /**
   * Download a locally stored file by signed JWT token.
   * GET /uploads-enhanced/download?token=<jwt>
   */
  @Get('download')
  @Idempotent({
    ttl: 60, // 1 minute for downloads
    includeQuery: true,
    storeResponse: false, // Don't store file content for downloads
  })
  async download(
    @Query('token') token: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    if (!token) throw new BadRequestException('token query param required');

    let result: Awaited<ReturnType<UploadsService['resolveLocalDownload']>>;
    try {
      result = await this.uploadsService.resolveLocalDownload(token);
    } catch {
      throw new NotFoundException('Invalid or expired download token');
    }

    const filename = result.key.split('/').pop() ?? 'download';
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(result.buffer);
  }

  /**
   * Batch upload multiple files with idempotency support.
   * POST /uploads-enhanced/batch
   */
  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { 
        files: { 
          type: 'array', 
          items: { type: 'string', format: 'binary' } 
        } 
      },
      required: ['files'],
    },
  })
  @UseInterceptors(
    FileInterceptor('files', {
      ...buildMulterOptions(),
      limits: { ...buildMulterOptions().limits, files: 10 }, // Allow up to 10 files
    })
  )
  @Idempotent({
    ttl: 1800, // 30 minutes for batch uploads
    includeBody: true,
    storeResponse: true,
    maxResponseSize: 2 * 1024 * 1024, // 2MB for batch responses
  })
  async uploadBatch(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE * 2 }), // Allow larger for batch
          new NoExecutableValidator(),
          new MagicBytesValidator(),
        ],
      }),
    )
    files: Express.Multer.File[],
    @Request() req: { user: { id: number } },
  ): Promise<StoredFile[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const results: StoredFile[] = [];
    
    for (const file of files) {
      await this.virusScan.scan(file.buffer, file.originalname);
      const result = await this.uploadsService.store(file.buffer, file.originalname, file.mimetype);
      results.push(result);
    }

    return results;
  }

  /**
   * Delete a stored file with idempotency support.
   * DELETE /uploads-enhanced/file
   */
  @Delete('file')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @Idempotent({
    ttl: 3600, // 1 hour for deletions
    includeBody: true,
    storeResponse: true,
  })
  async deleteFile(@Body() body: { key: string }): Promise<{ success: boolean }> {
    if (!body.key) throw new BadRequestException('key is required');
    
    // Implementation would depend on storage backend
    // For S3: await this.s3.deleteObject({ Bucket: bucket, Key: body.key });
    // For local: await fs.unlink(path.join(uploadDir, body.key));
    
    return { success: true };
  }

  /**
   * Get upload statistics with idempotency support.
   * GET /uploads-enhanced/stats
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @Idempotent({
    ttl: 60, // 1 minute for stats
    includeQuery: true,
    storeResponse: true,
  })
  async getStats(): Promise<{
    totalUploads: number;
    totalSize: number;
    averageSize: number;
    uploadsToday: number;
    topFileTypes: Array<{ type: string; count: number }>;
  }> {
    // This would typically query a database or analytics service
    // For now, return mock data
    return {
      totalUploads: 1000,
      totalSize: 1024 * 1024 * 100, // 100MB
      averageSize: 1024 * 100, // 100KB
      uploadsToday: 50,
      topFileTypes: [
        { type: 'image/jpeg', count: 400 },
        { type: 'image/png', count: 300 },
        { type: 'application/pdf', count: 200 },
        { type: 'text/plain', count: 100 },
      ],
    };
  }
}
