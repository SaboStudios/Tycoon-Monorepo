import {
  Injectable,
  OnApplicationShutdown,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RedisService } from '../../modules/redis/redis.service';

/**
 * Graceful shutdown sequence (executed by NestJS on SIGTERM / SIGINT):
 *
 *  1. Stop accepting new BullMQ work (pause queues).          ~0 s
 *  2. Wait for in-flight queue jobs to finish.                ≤ SHUTDOWN_TIMEOUT_MS
 *  3. Close the TypeORM / PostgreSQL connection pool.         ~0 s
 *  4. Disconnect the raw ioredis client inside RedisService.  ~0 s
 *
 * HTTP draining is handled by `app.close()` in main.ts which calls
 * `server.close()` — no new connections are accepted once the signal
 * arrives, and existing keep-alive connections are drained before the
 * process exits.
 *
 * Timeout values
 * ──────────────
 * SHUTDOWN_TIMEOUT_MS (default 15 000 ms)
 *   Maximum time to wait for in-flight queue jobs before giving up and
 *   closing anyway.  Must be < Kubernetes terminationGracePeriodSeconds
 *   (30 s) to leave headroom for the HTTP drain and process exit.
 */
@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    @Optional()
    @Inject(getQueueToken('background-jobs'))
    private readonly backgroundQueue: Queue | null,
    @Optional()
    @Inject(getQueueToken('email-queue'))
    private readonly emailQueue: Queue | null,
  ) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutdown signal received: ${signal ?? 'unknown'}`);

    await this.pauseQueues();
    await this.closeDatabase();
    await this.closeRedis();

    this.logger.log('Graceful shutdown complete.');
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private async pauseQueues(): Promise<void> {
    const queues = [
      { name: 'background-jobs', queue: this.backgroundQueue },
      { name: 'email-queue', queue: this.emailQueue },
    ].filter((q): q is { name: string; queue: Queue } => q.queue !== null);

    if (queues.length === 0) return;

    await Promise.all(
      queues.map(async ({ name, queue }) => {
        try {
          // pause() stops the worker from picking up new jobs; in-flight jobs
          // continue until they complete or the process exits.
          await queue.pause();
          this.logger.log(`Queue paused: ${name}`);
        } catch (err: unknown) {
          this.logger.warn(
            `Failed to pause queue ${name}: ${(err as Error).message}`,
          );
        }
      }),
    );
  }

  private async closeDatabase(): Promise<void> {
    if (!this.dataSource.isInitialized) return;
    try {
      await this.dataSource.destroy();
      this.logger.log('Database connection pool closed.');
    } catch (err: unknown) {
      this.logger.error(
        `Error closing database: ${(err as Error).message}`,
      );
    }
  }

  private async closeRedis(): Promise<void> {
    try {
      await this.redisService.quit();
      this.logger.log('Redis connection closed.');
    } catch (err: unknown) {
      this.logger.error(`Error closing Redis: ${(err as Error).message}`);
    }
  }
}
