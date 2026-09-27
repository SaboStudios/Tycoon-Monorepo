import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDataExportJob } from './entities/user-data-export-job.entity';

export type DataExportStatusResponse = {
  jobId: number;
  status: string;
  errorMessage?: string;
  expiresAt?: string;
  completedAt?: string;
  /** Present when status is `ready`; short-lived signed URL for GET download. */
  downloadUrl?: string;
};

@Injectable()
export class UserDataExportService {
  constructor(
    @InjectQueue('user-data') private readonly userDataQueue: Queue,
    @InjectRepository(UserDataExportJob)
    private readonly jobs: Repository<UserDataExportJob>,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async requestExport(userId: number): Promise<{ jobId: number }> {
    const job = this.jobs.create({
      userId,
      status: 'pending',
    });
    await this.jobs.save(job);
    await this.userDataQueue.add(
      'export-user-data',
      { jobId: job.id, userId },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
    return { jobId: job.id };
  }

  async getJobForUser(
    userId: number,
    jobId: number,
  ): Promise<UserDataExportJob> {
    const job = await this.jobs.findOne({ where: { id: jobId, userId } });
    if (!job) {
      throw new NotFoundException('Export job not found');
    }
    return job;
  }

  async getStatus(
    userId: number,
    jobId: number,
  ): Promise<DataExportStatusResponse> {
    const job = await this.getJobForUser(userId, jobId);
    const base: DataExportStatusResponse = {
      jobId: job.id,
      status: job.status,
      errorMessage: job.errorMessage ?? undefined,
      expiresAt: job.expiresAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    };

    if (job.status !== 'ready' || !job.filePath) {
      return base;
    }

    const ttlHours = this.config.get<number>('app.dataExportTtlHours') ?? 24;
    const token = await this.jwt.signAsync(
      {
        sub: userId,
        typ: 'data-export',
        jobId: job.id,
      },
      { expiresIn: `${ttlHours}h` },
    );

    const apiPrefix = this.config.get<string>('app.apiPrefix') || 'api';
    const defaultVersion = this.config.get<string>('app.defaultApiVersion') || '1';
    const downloadUrl = `/${apiPrefix}/v${defaultVersion}/data-export/download?token=${encodeURIComponent(token)}`;

    return { ...base, downloadUrl };
  }
}
