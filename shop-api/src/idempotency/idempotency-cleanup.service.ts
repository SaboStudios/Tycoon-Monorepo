import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  IdempotencyRecord,
  IdempotencyStatus,
} from './entities/idempotency-record.entity';

/**
 * IdempotencyCleanupService
 *
 * Periodically purges `idempotency_records` rows so the table does not grow
 * without bound (SW-1493).
 *
 * Rules:
 *  - Only `COMPLETED` rows older than `IDEMPOTENCY_TTL_DAYS` (default 7) are
 *    deleted — these are safe to drop because their cached response is no
 *    longer needed for replay once clients have stopped retrying.
 *  - `PROCESSING` rows are NEVER purged by this job regardless of age — an
 *    in-flight request must never lose its claim record.
 *  - `FAILED` rows are kept longer for audit purposes: `IDEMPOTENCY_FAILED_TTL_DAYS`
 *    (default 30, always >= the COMPLETED TTL) before they too are purged.
 *  - Deletion is scoped by `createdAt` (not `completedAt`) so this also
 *    reliably ages out very old rows even if `completedAt` was never set.
 */
@Injectable()
export class IdempotencyCleanupService implements OnModuleInit {
  private readonly logger = new Logger(IdempotencyCleanupService.name);

  /** Exposed for tests and for a future /metrics scrape endpoint. */
  purgeCount = 0;

  constructor(
    @InjectRepository(IdempotencyRecord)
    private readonly repo: Repository<IdempotencyRecord>,
  ) {}

  onModuleInit(): void {
    this.logger.log(
      `Idempotency purge job scheduled [completedTtlDays=${this.completedTtlDays}, failedTtlDays=${this.failedTtlDays}]`,
    );
  }

  private get completedTtlDays(): number {
    const raw = process.env.IDEMPOTENCY_TTL_DAYS;
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
  }

  private get failedTtlDays(): number {
    const raw = process.env.IDEMPOTENCY_FAILED_TTL_DAYS;
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(parsed, this.completedTtlDays);
    }
    return Math.max(30, this.completedTtlDays);
  }

  /** Runs once a day. Safe to call manually (e.g. from a test) via `purgeExpired()`. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron(): Promise<void> {
    await this.purgeExpired();
  }

  /**
   * Deletes expired COMPLETED and FAILED idempotency records.
   * Returns the number of rows removed. Never touches PROCESSING rows.
   */
  async purgeExpired(): Promise<number> {
    const completedCutoff = this.daysAgo(this.completedTtlDays);
    const failedCutoff = this.daysAgo(this.failedTtlDays);

    const completedResult = await this.repo.delete({
      status: IdempotencyStatus.COMPLETED,
      createdAt: LessThan(completedCutoff),
    });

    const failedResult = await this.repo.delete({
      status: IdempotencyStatus.FAILED,
      createdAt: LessThan(failedCutoff),
    });

    const purged =
      (completedResult.affected ?? 0) + (failedResult.affected ?? 0);
    this.purgeCount += purged;

    if (purged > 0) {
      this.logger.log(
        'Purged expired idempotency records',
        JSON.stringify({
          purge_count: purged,
          completedPurged: completedResult.affected ?? 0,
          failedPurged: failedResult.affected ?? 0,
          totalPurgeCount: this.purgeCount,
        }),
      );
    }

    return purged;
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
}
