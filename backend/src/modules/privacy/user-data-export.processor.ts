import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { UserDataExportJob } from './entities/user-data-export-job.entity';
import { UserDataCollectorService } from './user-data-collector.service';

export type UserDataExportJobPayload = {
  jobId: number;
  userId: number;
};

@Processor('user-data')
export class UserDataExportProcessor extends WorkerHost {
  private readonly logger = new Logger(UserDataExportProcessor.name);

  constructor(
    private readonly config: ConfigService,
    private readonly collector: UserDataCollectorService,
    @InjectRepository(UserDataExportJob)
    private readonly jobs: Repository<UserDataExportJob>,
  ) {
    super();
  }

  async process(job: Job<UserDataExportJobPayload>): Promise<void> {
    if (job.name !== 'export-user-data') {
      return;
    }
    const { jobId, userId } = job.data;
    const row = await this.jobs.findOne({ where: { id: jobId, userId } });
    if (!row) {
      this.logger.warn(`Missing export job ${jobId} for user ${userId}`);
      return;
    }

    row.status = 'processing';
    await this.jobs.save(row);

    const ttlHours = this.config.get<number>('app.dataExportTtlHours') ?? 24;
    const baseDir =
      this.config.get<string>('app.dataExportDir') || './storage/data-exports';

    try {
      const payload = await this.collector.buildExportPayload(userId);
      const dir = join(baseDir, String(userId));
      await mkdir(dir, { recursive: true });
      const fileName = `export-${jobId}.json`;
      const filePath = join(dir, fileName);
      await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ttlHours);

      row.status = 'ready';
      row.filePath = filePath;
      row.completedAt = new Date();
      row.expiresAt = expiresAt;
      row.errorMessage = null;
      await this.jobs.save(row);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Export job ${jobId} failed: ${msg}`);
      row.status = 'failed';
      row.errorMessage = msg;
      await this.jobs.save(row);
    }
  }
}
