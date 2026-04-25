import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * Webhook signature verification latency buckets (seconds)
 * Tuned for cryptographic operations (typically <10ms)
 */
const SIGNATURE_VERIFICATION_BUCKETS = [
  0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5,
];

/**
 * Webhook processing latency buckets (seconds)
 * Tuned for full webhook processing including DB writes
 */
const WEBHOOK_PROCESSING_BUCKETS = [
  0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

export enum WebhookEventType {
  RECEIVED = 'received',
  SIGNATURE_VERIFIED = 'signature_verified',
  SIGNATURE_FAILED = 'signature_failed',
  IDEMPOTENCY_HIT = 'idempotency_hit',
  PROCESSED = 'processed',
  PROCESSING_FAILED = 'processing_failed',
}

export interface WebhookLogContext {
  webhookId?: string;
  eventType?: string;
  source?: string;
  statusCode?: number;
  error?: string;
  timestamp?: string;
  signatureValid?: boolean;
  idempotent?: boolean;
  processingTimeMs?: number;
}

/**
 * Observability service for webhooks & signatures
 * Provides structured logging, metrics, and traces for webhook operations
 * 
 * Security: No secrets (signatures, webhook secrets) are logged
 * Compliance: Aligns with existing Nest modules and env validation
 */
@Injectable()
export class WebhooksObservabilityService {
  readonly registry = new Registry();

  private readonly webhookEventsTotal: Counter;
  private readonly signatureVerificationDuration: Histogram;
  private readonly signatureVerificationTotal: Counter;
  private readonly webhookProcessingDuration: Histogram;
  private readonly idempotencyHitsTotal: Counter;

  constructor(private readonly logger: LoggerService) {
    // Total webhook events by source and event type
    this.webhookEventsTotal = new Counter({
      name: 'tycoon_webhook_events_total',
      help: 'Total webhook events received by source and event type',
      labelNames: ['source', 'event_type', 'status'],
      registers: [this.registry],
    });

    // Signature verification duration
    this.signatureVerificationDuration = new Histogram({
      name: 'tycoon_webhook_signature_verification_duration_seconds',
      help: 'Time spent verifying webhook signatures',
      labelNames: ['source', 'result'],
      buckets: SIGNATURE_VERIFICATION_BUCKETS,
      registers: [this.registry],
    });

    // Signature verification results
    this.signatureVerificationTotal = new Counter({
      name: 'tycoon_webhook_signature_verification_total',
      help: 'Total signature verification attempts by result',
      labelNames: ['source', 'result', 'failure_reason'],
      registers: [this.registry],
    });

    // Webhook processing duration
    this.webhookProcessingDuration = new Histogram({
      name: 'tycoon_webhook_processing_duration_seconds',
      help: 'Time spent processing webhooks end-to-end',
      labelNames: ['source', 'event_type'],
      buckets: WEBHOOK_PROCESSING_BUCKETS,
      registers: [this.registry],
    });

    // Idempotency hits (duplicate webhook detection)
    this.idempotencyHitsTotal = new Counter({
      name: 'tycoon_webhook_idempotency_hits_total',
      help: 'Number of duplicate webhooks detected via idempotency',
      labelNames: ['source', 'event_type'],
      registers: [this.registry],
    });
  }

  /**
   * Log webhook received event
   * @param context - Webhook context (no secrets)
   */
  logWebhookReceived(context: WebhookLogContext): void {
    const sanitizedContext = this.sanitizeContext(context);
    
    this.logger.log(
      `Webhook received: ${context.source || 'unknown'} - ${context.eventType || 'unknown'}`,
      'WebhooksObservability',
    );
    
    this.logger.logWithMeta('info', 'Webhook received', {
      ...sanitizedContext,
      event: WebhookEventType.RECEIVED,
    });

    this.webhookEventsTotal.inc({
      source: context.source || 'unknown',
      event_type: context.eventType || 'unknown',
      status: 'received',
    });
  }

  /**
   * Log and record signature verification
   * @param source - Webhook source (e.g., 'stripe')
   * @param success - Whether verification succeeded
   * @param durationMs - Verification duration in milliseconds
   * @param failureReason - Reason for failure (if applicable)
   */
  logSignatureVerification(
    source: string,
    success: boolean,
    durationMs: number,
    failureReason?: string,
  ): void {
    const result = success ? 'valid' : 'invalid';
    const durationSeconds = durationMs / 1000;

    // Log with appropriate level
    if (success) {
      this.logger.debug(
        `Signature verified for ${source} in ${durationMs}ms`,
        'WebhooksObservability',
      );
    } else {
      this.logger.warn(
        `Signature verification failed for ${source}: ${failureReason || 'unknown reason'}`,
        'WebhooksObservability',
      );
    }

    // Record metrics
    this.signatureVerificationDuration.observe(
      { source, result },
      durationSeconds,
    );

    this.signatureVerificationTotal.inc({
      source,
      result,
      failure_reason: failureReason || 'none',
    });

    // Log structured event
    this.logger.logWithMeta(success ? 'debug' : 'warn', 'Signature verification', {
      event: success ? WebhookEventType.SIGNATURE_VERIFIED : WebhookEventType.SIGNATURE_FAILED,
      source,
      result,
      durationMs,
      failureReason: failureReason || undefined,
    });
  }

  /**
   * Log idempotency hit (duplicate webhook detected)
   * @param context - Webhook context
   */
  logIdempotencyHit(context: WebhookLogContext): void {
    const sanitizedContext = this.sanitizeContext(context);
    
    this.logger.log(
      `Duplicate webhook detected: ${context.webhookId} (${context.source})`,
      'WebhooksObservability',
    );

    this.logger.logWithMeta('info', 'Idempotency hit', {
      ...sanitizedContext,
      event: WebhookEventType.IDEMPOTENCY_HIT,
    });

    this.idempotencyHitsTotal.inc({
      source: context.source || 'unknown',
      event_type: context.eventType || 'unknown',
    });

    this.webhookEventsTotal.inc({
      source: context.source || 'unknown',
      event_type: context.eventType || 'unknown',
      status: 'idempotent',
    });
  }

  /**
   * Log successful webhook processing
   * @param context - Webhook context
   * @param durationMs - Processing duration in milliseconds
   */
  logWebhookProcessed(context: WebhookLogContext, durationMs: number): void {
    const sanitizedContext = this.sanitizeContext(context);
    
    this.logger.log(
      `Webhook processed: ${context.webhookId} (${context.source}) in ${durationMs}ms`,
      'WebhooksObservability',
    );

    this.logger.logWithMeta('info', 'Webhook processed', {
      ...sanitizedContext,
      event: WebhookEventType.PROCESSED,
      processingTimeMs: durationMs,
    });

    this.webhookProcessingDuration.observe(
      {
        source: context.source || 'unknown',
        event_type: context.eventType || 'unknown',
      },
      durationMs / 1000,
    );

    this.webhookEventsTotal.inc({
      source: context.source || 'unknown',
      event_type: context.eventType || 'unknown',
      status: 'processed',
    });
  }

  /**
   * Log webhook processing failure
   * @param context - Webhook context
   * @param error - Error that occurred
   * @param durationMs - Processing duration in milliseconds
   */
  logWebhookProcessingFailed(
    context: WebhookLogContext,
    error: Error,
    durationMs: number,
  ): void {
    const sanitizedContext = this.sanitizeContext(context);
    
    this.logger.error(
      `Webhook processing failed: ${context.webhookId} (${context.source}) - ${error.message}`,
      error.stack,
      'WebhooksObservability',
    );

    this.logger.logWithMeta('error', 'Webhook processing failed', {
      ...sanitizedContext,
      event: WebhookEventType.PROCESSING_FAILED,
      error: error.message,
      errorStack: error.stack,
      processingTimeMs: durationMs,
    });

    this.webhookEventsTotal.inc({
      source: context.source || 'unknown',
      event_type: context.eventType || 'unknown',
      status: 'failed',
    });
  }

  /**
   * Get Prometheus metrics text
   */
  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Sanitize context to remove any potential secrets
   * @param context - Raw context
   * @returns Sanitized context safe for logging
   */
  private sanitizeContext(context: WebhookLogContext): WebhookLogContext {
    // Create a shallow copy and remove any fields that might contain secrets
    const sanitized = { ...context };
    
    // Remove any fields that might contain sensitive data
    // (signatures, tokens, etc. should never be in context, but defensive)
    delete (sanitized as any).signature;
    delete (sanitized as any).secret;
    delete (sanitized as any).token;
    delete (sanitized as any).authorization;
    
    return sanitized;
  }
}
