import {
  Injectable,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import {
  IdempotencyRecord,
  IdempotencyStatus,
} from './entities/idempotency-record.entity';

export interface CachedResponse {
  status: number;
  body: unknown;
}

export interface IdempotencyResult {
  /** True when this is a replayed response from a prior completed request. */
  isReplay: boolean;
  record: IdempotencyRecord;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyRecord)
    private readonly repo: Repository<IdempotencyRecord>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Attempts to claim an idempotency key for the given operation.
   *
   * - If the key is new: inserts a PROCESSING record and returns it.
   * - If the key is COMPLETED: returns the cached response (isReplay=true).
   * - If the key is PROCESSING: throws 409 Conflict (concurrent request).
   * - If the key is FAILED: deletes the old record and allows a fresh attempt.
   *
   * The unique primary key constraint on (idempotencyKey) provides the
   * database-level lock that prevents concurrent duplicate inserts.
   */
  async claimKey(
    idempotencyKey: string,
    operation: string,
  ): Promise<IdempotencyResult> {
    // Attempt optimistic insert first (fast path for new keys).
    try {
      const record = this.repo.create({
        idempotencyKey,
        operation,
        status: IdempotencyStatus.PROCESSING,
        responseBody: null,
        responseStatus: null,
        completedAt: null,
      });
      await this.repo.insert(record);
      return { isReplay: false, record };
    } catch (err) {
      // Unique constraint violation → key already exists.
      if (!this.isUniqueViolation(err)) throw err;
    }

    // Key exists — fetch and inspect.
    const existing = await this.repo.findOneByOrFail({ idempotencyKey });

    if (existing.status === IdempotencyStatus.COMPLETED) {
      this.logger.log(`Replaying idempotent response [key=${this.mask(idempotencyKey)}]`);
      return { isReplay: true, record: existing };
    }

    if (existing.status === IdempotencyStatus.PROCESSING) {
      // Another request is actively processing this key right now.
      throw new ConflictException(
        'A request with this idempotency key is already being processed. ' +
          'Please wait and retry.',
      );
    }

    // FAILED → allow retry by removing the stale record.
    this.logger.log(
      `Retrying after previous failure [key=${this.mask(idempotencyKey)}]`,
    );
    await this.repo.delete({ idempotencyKey });

    const retryRecord = this.repo.create({
      idempotencyKey,
      operation,
      status: IdempotencyStatus.PROCESSING,
      responseBody: null,
      responseStatus: null,
      completedAt: null,
    });
    await this.repo.insert(retryRecord);
    return { isReplay: false, record: retryRecord };
  }

  /**
   * Marks the key as COMPLETED and caches the response for future replays.
   * Runs inside the caller's transaction when a QueryRunner is provided.
   */
  async markCompleted(
    idempotencyKey: string,
    response: CachedResponse,
  ): Promise<void> {
    await this.repo.update(
      { idempotencyKey },
      {
        status: IdempotencyStatus.COMPLETED,
        responseBody: JSON.stringify(response.body),
        responseStatus: response.status,
        completedAt: new Date(),
      },
    );
  }

  /**
   * Marks the key as FAILED so the client may retry with the same key.
   */
  async markFailed(idempotencyKey: string): Promise<void> {
    await this.repo.update(
      { idempotencyKey },
      { status: IdempotencyStatus.FAILED },
    );
  }

  /** Deserialises the cached response stored on a COMPLETED record. */
  getCachedResponse(record: IdempotencyRecord): CachedResponse {
    return {
      status: record.responseStatus ?? 200,
      body: JSON.parse(record.responseBody ?? 'null'),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private isUniqueViolation(err: unknown): boolean {
    if (err instanceof QueryFailedError) {
      const code = (err as QueryFailedError & { code?: string; errno?: number })
        .code;
      // PostgreSQL: 23505, SQLite: SQLITE_CONSTRAINT
      return (
        code === '23505' ||
        (err.message?.includes('UNIQUE constraint failed') ?? false)
      );
    }
    return false;
  }

  /** Masks all but the last 4 chars of a key to keep logs clean. */
  private mask(key: string): string {
    if (key.length <= 4) return '****';
    return `${'*'.repeat(key.length - 4)}${key.slice(-4)}`;
  }
}
