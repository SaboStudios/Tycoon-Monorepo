import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Tracks idempotency keys to prevent duplicate and concurrent processing.
 *
 * Lifecycle:
 *   PROCESSING → COMPLETED | FAILED
 *
 * A row is inserted with status=PROCESSING before any work begins.
 * On success the cached response is stored and status set to COMPLETED.
 * On failure status is set to FAILED so the caller may retry.
 */
export enum IdempotencyStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('idempotency_records')
export class IdempotencyRecord {
  /** The client-supplied idempotency key (UUID recommended). */
  @PrimaryColumn({ length: 255 })
  idempotencyKey: string;

  /** Namespaces the key to a specific operation (e.g. "purchases"). */
  @Column({ length: 64 })
  @Index()
  operation: string;

  @Column({ type: 'varchar', default: IdempotencyStatus.PROCESSING })
  status: IdempotencyStatus;

  /**
   * JSON-serialised response body cached on first successful completion.
   * Replayed verbatim for subsequent requests with the same key.
   */
  @Column({ type: 'text', nullable: true })
  responseBody: string | null;

  /** HTTP status code of the cached response. */
  @Column({ nullable: true })
  responseStatus: number | null;

  @CreateDateColumn()
  createdAt: Date;

  /** When the record was last updated (used for TTL-based cleanup). */
  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
