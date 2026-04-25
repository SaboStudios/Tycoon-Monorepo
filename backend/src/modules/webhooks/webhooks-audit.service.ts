import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookAuditLog } from './entities/webhook-audit-log.entity';
import { LoggerService } from '../../common/logger/logger.service';

export enum WebhookAuditAction {
  RECEIVED = 'webhook.received',
  SIGNATURE_VERIFIED = 'webhook.signature.verified',
  SIGNATURE_FAILED = 'webhook.signature.failed',
  IDEMPOTENCY_CHECK = 'webhook.idempotency.check',
  IDEMPOTENCY_HIT = 'webhook.idempotency.hit',
  PROCESSING_STARTED = 'webhook.processing.started',
  PROCESSING_COMPLETED = 'webhook.processing.completed',
  PROCESSING_FAILED = 'webhook.processing.failed',
  PERSISTED = 'webhook.persisted',
}

export interface WebhookAuditContext {
  webhookId?: string;
  eventType?: string;
  source?: string;
  action: WebhookAuditAction;
  success: boolean;
  metadata?: Record<string, any>;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
}

/**
 * Audit trail service for webhooks & signatures
 * Provides comprehensive audit logging for compliance and security
 * 
 * Security: No secrets (signatures, webhook secrets) are stored in audit logs
 * Compliance: Immutable audit trail with retention policies
 */
@Injectable()
export class WebhooksAuditService {
  constructor(
    @InjectRepository(WebhookAuditLog)
    private readonly auditLogRepo: Repository<WebhookAuditLog>,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Create an audit log entry for a webhook operation
   * @param context - Audit context (no secrets)
   */
  async createAuditLog(context: WebhookAuditContext): Promise<WebhookAuditLog> {
    try {
      // Sanitize metadata to ensure no secrets
      const sanitizedMetadata = this.sanitizeMetadata(context.metadata);

      const auditLog = this.auditLogRepo.create({
        webhookId: context.webhookId,
        eventType: context.eventType,
        source: context.source || 'unknown',
        action: context.action,
        success: context.success,
        metadata: sanitizedMetadata,
        errorMessage: context.errorMessage,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        durationMs: context.durationMs,
      });

      const saved = await this.auditLogRepo.save(auditLog);

      this.logger.debug(
        `Audit log created: ${context.action} for webhook ${context.webhookId}`,
        'WebhooksAudit',
      );

      return saved;
    } catch (error) {
      // Log error but don't throw - audit failures shouldn't break webhook processing
      this.logger.error(
        `Failed to create audit log for ${context.action}: ${error.message}`,
        error.stack,
        'WebhooksAudit',
      );
      throw error;
    }
  }

  /**
   * Audit webhook received event
   */
  async auditWebhookReceived(
    webhookId: string,
    eventType: string,
    source: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createAuditLog({
      webhookId,
      eventType,
      source,
      action: WebhookAuditAction.RECEIVED,
      success: true,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Audit signature verification attempt
   */
  async auditSignatureVerification(
    webhookId: string | undefined,
    source: string,
    success: boolean,
    durationMs: number,
    failureReason?: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.createAuditLog({
      webhookId,
      source,
      action: success
        ? WebhookAuditAction.SIGNATURE_VERIFIED
        : WebhookAuditAction.SIGNATURE_FAILED,
      success,
      durationMs,
      errorMessage: failureReason,
      ipAddress,
      metadata: failureReason ? { failureReason } : undefined,
    });
  }

  /**
   * Audit idempotency check
   */
  async auditIdempotencyCheck(
    webhookId: string,
    eventType: string,
    source: string,
    isDuplicate: boolean,
  ): Promise<void> {
    await this.createAuditLog({
      webhookId,
      eventType,
      source,
      action: isDuplicate
        ? WebhookAuditAction.IDEMPOTENCY_HIT
        : WebhookAuditAction.IDEMPOTENCY_CHECK,
      success: true,
      metadata: { isDuplicate },
    });
  }

  /**
   * Audit webhook processing completion
   */
  async auditProcessingCompleted(
    webhookId: string,
    eventType: string,
    source: string,
    durationMs: number,
  ): Promise<void> {
    await this.createAuditLog({
      webhookId,
      eventType,
      source,
      action: WebhookAuditAction.PROCESSING_COMPLETED,
      success: true,
      durationMs,
    });
  }

  /**
   * Audit webhook processing failure
   */
  async auditProcessingFailed(
    webhookId: string | undefined,
    eventType: string | undefined,
    source: string,
    error: Error,
    durationMs: number,
  ): Promise<void> {
    await this.createAuditLog({
      webhookId,
      eventType,
      source,
      action: WebhookAuditAction.PROCESSING_FAILED,
      success: false,
      errorMessage: error.message,
      durationMs,
      metadata: {
        errorName: error.name,
        // Don't include full stack trace in metadata for size reasons
      },
    });
  }

  /**
   * Audit webhook persistence to database
   */
  async auditWebhookPersisted(
    webhookId: string,
    eventType: string,
    source: string,
  ): Promise<void> {
    await this.createAuditLog({
      webhookId,
      eventType,
      source,
      action: WebhookAuditAction.PERSISTED,
      success: true,
    });
  }

  /**
   * Query audit logs for a specific webhook
   */
  async getAuditLogsForWebhook(webhookId: string): Promise<WebhookAuditLog[]> {
    return this.auditLogRepo.find({
      where: { webhookId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Query audit logs by action type
   */
  async getAuditLogsByAction(
    action: WebhookAuditAction,
    limit = 100,
  ): Promise<WebhookAuditLog[]> {
    return this.auditLogRepo.find({
      where: { action },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Query failed operations for investigation
   */
  async getFailedOperations(
    source?: string,
    limit = 100,
  ): Promise<WebhookAuditLog[]> {
    const query = this.auditLogRepo
      .createQueryBuilder('audit')
      .where('audit.success = :success', { success: false })
      .orderBy('audit.createdAt', 'DESC')
      .take(limit);

    if (source) {
      query.andWhere('audit.source = :source', { source });
    }

    return query.getMany();
  }

  /**
   * Get audit statistics for a time period
   */
  async getAuditStatistics(
    startDate: Date,
    endDate: Date,
    source?: string,
  ): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    signatureFailures: number;
    idempotencyHits: number;
    averageDurationMs: number;
  }> {
    const query = this.auditLogRepo
      .createQueryBuilder('audit')
      .where('audit.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });

    if (source) {
      query.andWhere('audit.source = :source', { source });
    }

    const logs = await query.getMany();

    const totalEvents = logs.length;
    const successfulEvents = logs.filter((log) => log.success).length;
    const failedEvents = logs.filter((log) => !log.success).length;
    const signatureFailures = logs.filter(
      (log) => log.action === WebhookAuditAction.SIGNATURE_FAILED,
    ).length;
    const idempotencyHits = logs.filter(
      (log) => log.action === WebhookAuditAction.IDEMPOTENCY_HIT,
    ).length;

    const logsWithDuration = logs.filter((log) => log.durationMs !== null);
    const averageDurationMs =
      logsWithDuration.length > 0
        ? logsWithDuration.reduce((sum, log) => sum + (log.durationMs || 0), 0) /
          logsWithDuration.length
        : 0;

    return {
      totalEvents,
      successfulEvents,
      failedEvents,
      signatureFailures,
      idempotencyHits,
      averageDurationMs,
    };
  }

  /**
   * Sanitize metadata to remove any potential secrets
   * @param metadata - Raw metadata
   * @returns Sanitized metadata safe for audit storage
   */
  private sanitizeMetadata(
    metadata?: Record<string, any>,
  ): Record<string, any> | undefined {
    if (!metadata) {
      return undefined;
    }

    const sanitized = { ...metadata };

    // Remove sensitive fields
    const sensitiveFields = [
      'signature',
      'secret',
      'token',
      'authorization',
      'apiKey',
      'api_key',
      'password',
      'webhookSecret',
      'webhook_secret',
    ];

    sensitiveFields.forEach((field) => {
      delete sanitized[field];
    });

    // Recursively sanitize nested objects
    Object.keys(sanitized).forEach((key) => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeMetadata(sanitized[key]);
      }
    });

    return sanitized;
  }
}
