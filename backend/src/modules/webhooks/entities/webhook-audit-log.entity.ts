import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Webhook Audit Log Entity
 * Immutable audit trail for webhook operations
 * 
 * Security: No secrets stored, only operation metadata
 * Compliance: Indexed for efficient querying and reporting
 */
@Entity('webhook_audit_logs')
@Index(['webhookId', 'createdAt'])
@Index(['source', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['success', 'createdAt'])
export class WebhookAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Webhook event ID (from webhook payload)
   * Nullable for operations that occur before ID extraction
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  webhookId: string | null;

  /**
   * Webhook event type (e.g., 'payment.succeeded')
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  eventType: string | null;

  /**
   * Webhook source (e.g., 'stripe', 'paypal')
   */
  @Column({ type: 'varchar', length: 100 })
  @Index()
  source: string;

  /**
   * Audit action type (e.g., 'webhook.received', 'webhook.signature.verified')
   */
  @Column({ type: 'varchar', length: 100 })
  @Index()
  action: string;

  /**
   * Whether the operation was successful
   */
  @Column({ type: 'boolean' })
  @Index()
  success: boolean;

  /**
   * Additional metadata (sanitized, no secrets)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  /**
   * Error message if operation failed
   */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  /**
   * IP address of the webhook sender
   */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /**
   * User agent of the webhook sender
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  /**
   * Operation duration in milliseconds
   */
  @Column({ type: 'integer', nullable: true })
  durationMs: number | null;

  /**
   * Timestamp when the audit log was created (immutable)
   */
  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
