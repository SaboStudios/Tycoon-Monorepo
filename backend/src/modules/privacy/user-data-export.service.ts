import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserDataExportJob } from './entities/user-data-export-job.entity';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';
import { DataExportMetrics } from './data-export.metrics';

export type DataExportStatusResponse = {
  jobId: number;
  status: string;
  errorMessage?: string;
  expiresAt?: string;
  completedAt?: string;
  /** Present when status is `ready`; short-lived signed URL for GET download. */
  downloadUrl?: string;
};

export type DataExportRequestResponse = {
  jobId: number;
  status: string;
  /** True when an already-active export was returned instead of a new one. */
  reused: boolean;
};

export type DataExportRequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

/**
 * An active job older than this is assumed to be wedged (worker crash, lost
 * Bull job) and is superseded so the user is not blocked forever by the
 * one-active-export-per-user constraint.
 */
export const STALE_ACTIVE_EXPORT_MS = 60 * 60 * 1000;

const ACTIVE_STATUSES = ['pending', 'processing'] as const;
const UNAVAILABLE_MESSAGE =
  'Data export is temporarily unavailable; please retry later';

@Injectable()
export class UserDataExportService {
  private readonly logger = new Logger(UserDataExportService.name);

  constructor(
    @InjectQueue('user-data') private readonly userDataQueue: Queue,
    @InjectRepository(UserDataExportJob)
    private readonly jobs: Repository<UserDataExportJob>,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly auditTrail: AuditTrailService,
    private readonly metrics: DataExportMetrics,
  ) {}

  /**
   * Starts (or returns the already-active) export for `userId`.
   *
   * Idempotent per user: double clicks, client retries and concurrent requests
   * all resolve to the single active job (enforced by the partial unique index
   * `UQ_user_data_export_jobs_active_user`). Fails closed with 503 — and keeps
   * no job row — when Postgres or the Redis-backed queue is unavailable.
   */
  async requestExport(
    userId: number,
    context: DataExportRequestContext = {},
  ): Promise<DataExportRequestResponse> {
    if (this.config.get<boolean>('app.dataExportEnabled') === false) {
      this.metrics.recordRequest('disabled');
      throw new ServiceUnavailableException(
        'Data export is temporarily disabled',
      );
    }

    return this.failClosed(async () => {
      const active = await this.findActiveJob(userId);
      if (active) {
        this.metrics.recordRequest('reused');
        return { jobId: active.id, status: active.status, reused: true };
      }

      let job: UserDataExportJob;
      try {
        job = await this.jobs.save(
          this.jobs.create({ userId, status: 'pending' }),
        );
      } catch (error) {
        // Lost a race with a concurrent request for the same user.
        if (isUniqueViolation(error)) {
          const winner = await this.findActiveJob(userId);
          if (winner) {
            this.metrics.recordRequest('reused');
            return { jobId: winner.id, status: winner.status, reused: true };
          }
        }
        throw error;
      }

      await this.enqueueOrRollback(job);

      this.metrics.recordRequest('created');
      this.logger.log(`Export job ${job.id} queued for user ${userId}`);
      this.audit(AuditAction.DATA_EXPORT_REQUESTED, userId, job.id, context);
      return { jobId: job.id, status: job.status, reused: false };
    });
  }

  async getJobForUser(
    userId: number,
    jobId: number,
  ): Promise<UserDataExportJob> {
    // Scoped by owner: another user's jobId is indistinguishable from a
    // missing one (404, not 403) so job ids cannot be enumerated.
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
    const job = await this.failClosed(() => this.getJobForUser(userId, jobId));
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

  recordDownload(userId: number, jobId: number, context: DataExportRequestContext) {
    this.audit(AuditAction.DATA_EXPORT_DOWNLOADED, userId, jobId, context);
  }

  private async findActiveJob(
    userId: number,
  ): Promise<UserDataExportJob | null> {
    const active = await this.jobs.findOne({
      where: { userId, status: In([...ACTIVE_STATUSES]) },
      order: { createdAt: 'DESC' },
    });
    if (!active) {
      return null;
    }
    if (Date.now() - active.createdAt.getTime() > STALE_ACTIVE_EXPORT_MS) {
      this.logger.warn(
        `Superseding stale export job ${active.id} (status ${active.status})`,
      );
      active.status = 'failed';
      active.errorMessage = 'Export timed out; please request a new export.';
      await this.jobs.save(active);
      return null;
    }
    return active;
  }

  /**
   * Queue the job; if Redis is down or slow, delete the row so no orphaned
   * `pending` job is left behind, then fail with 503.
   */
  private async enqueueOrRollback(job: UserDataExportJob): Promise<void> {
    const timeoutMs =
      this.config.get<number>('app.dataExportEnqueueTimeoutMs') ?? 5000;
    try {
      await withTimeout(
        this.userDataQueue.add(
          'export-user-data',
          { jobId: job.id, userId: job.userId },
          {
            // Deterministic id: a late duplicate add is a no-op in BullMQ.
            jobId: `user-data-export-${job.id}`,
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        ),
        timeoutMs,
      );
    } catch (error) {
      this.metrics.recordRequest('enqueue_failed');
      this.logger.error(
        `Failed to enqueue export job ${job.id}: ${errorMessage(error)}`,
      );
      await this.jobs.delete({ id: job.id }).catch((cleanupError: unknown) =>
        this.logger.error(
          `Failed to roll back export job ${job.id}: ${errorMessage(cleanupError)}`,
        ),
      );
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
  }

  /** Map non-HTTP failures (DB/Redis outages) to 503 instead of a raw 500. */
  private async failClosed<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Data export dependency failure: ${errorMessage(error)}`);
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
  }

  private audit(
    action: AuditAction,
    userId: number,
    jobId: number,
    context: DataExportRequestContext,
  ): void {
    this.auditTrail
      .log(action, {
        userId,
        performedBy: userId,
        changes: { jobId },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })
      .catch((error: unknown) =>
        this.logger.error(
          `Failed to audit ${action} for job ${jobId}: ${errorMessage(error)}`,
        ),
      );
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; driverError?: { code?: string }; message?: string };
  return (
    e?.code === '23505' ||
    e?.driverError?.code === '23505' ||
    /UNIQUE constraint failed/i.test(e?.message ?? '')
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
