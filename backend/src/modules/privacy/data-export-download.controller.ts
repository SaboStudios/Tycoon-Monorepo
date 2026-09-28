import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { createReadStream } from 'fs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDataExportJob } from './entities/user-data-export-job.entity';
import { UserDataExportService } from './user-data-export.service';

interface DataExportJwtPayload {
  sub: number;
  typ: string;
  jobId: number;
}

/**
 * Token-authenticated download (no Authorization header). The token is a
 * `typ: data-export` JWT bound to one job and user, issued by the status
 * endpoint. It is redacted from request logs (common/logger/redact-url.ts).
 */
@Controller('data-export')
export class DataExportDownloadController {
  private readonly logger = new Logger(DataExportDownloadController.name);

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(UserDataExportJob)
    private readonly jobs: Repository<UserDataExportJob>,
    private readonly exports: UserDataExportService,
  ) {}

  // Rate-limited per IP to bound token guessing / scraping; a real user
  // downloads a handful of times per export.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('download')
  async download(
    @Query('token') token: string,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    if (!token) {
      throw new BadRequestException('token query param required');
    }

    let payload: DataExportJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<DataExportJwtPayload>(token);
    } catch {
      throw new BadRequestException('Invalid or expired download token');
    }

    if (
      payload.typ !== 'data-export' ||
      !Number.isInteger(payload.jobId) ||
      !Number.isInteger(payload.sub)
    ) {
      throw new BadRequestException('Invalid token type');
    }

    const job = await this.jobs.findOne({
      where: { id: payload.jobId, userId: payload.sub },
    });
    if (!job || job.status !== 'ready' || !job.filePath) {
      throw new NotFoundException('Export not available');
    }
    if (job.expiresAt && job.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('Export has expired');
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="export-${job.id}.json"`,
    );

    const stream = createReadStream(job.filePath);
    stream.on('open', () =>
      this.exports.recordDownload(payload.sub, job.id, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }),
    );
    stream.on('error', (error) => {
      // File purged/missing on disk: never leave the request hanging.
      this.logger.error(
        `Export file for job ${job.id} unreadable: ${error.message}`,
      );
      if (!res.headersSent) {
        res.removeHeader('Content-Disposition');
        res.status(404).json({ statusCode: 404, message: 'Export not available' });
      } else {
        res.destroy(error);
      }
    });
    stream.pipe(res);
  }
}
