import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDataExportJob } from './entities/user-data-export-job.entity';

interface DataExportJwtPayload {
  sub: number;
  typ: string;
  jobId: number;
}

@SkipThrottle()
@Controller('data-export')
export class DataExportDownloadController {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(UserDataExportJob)
    private readonly jobs: Repository<UserDataExportJob>,
  ) {}

  @Get('download')
  async download(
    @Query('token') token: string,
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

    if (payload.typ !== 'data-export') {
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
    stream.pipe(res);
  }
}
