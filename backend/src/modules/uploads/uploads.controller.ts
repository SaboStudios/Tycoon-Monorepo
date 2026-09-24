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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB – also enforced in multer limits below

function buildMulterOptions() {
  return {
    storage: memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  };
}

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly virusScan: VirusScanService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Upload the authenticated user's avatar.
   * POST /uploads/avatar
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
   * Upload an admin asset (shop image, banner, etc.).
   * POST /uploads/admin/assets
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
   * Generate a fresh signed download URL for a stored file key.
   * GET /uploads/signed-url?key=<key>
   */
  @Get('signed-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getSignedUrl(@Query('key') key: string): Promise<{ url: string }> {
    if (!key) throw new BadRequestException('key query param required');
    const url = await this.uploadsService.signedUrl(key);
    return { url };
  }

  /**
   * Download a locally stored file by signed JWT token.
   * Only active when AWS_S3_BUCKET is not configured.
   * GET /uploads/download?token=<jwt>
   */
  @Get('download')
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
}
