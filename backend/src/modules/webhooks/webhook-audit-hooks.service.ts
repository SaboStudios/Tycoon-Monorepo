import { Injectable, Logger } from '@nestjs/common';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';

/**
 * WebhookAuditHooksService
 *
 * Bridges webhook lifecycle events into the central AuditTrailService
 * so they appear in the unified audit_trails table alongside user/game/shop actions.
 *
 * Design notes:
 * - All calls are fire-and-forget (never throws) to avoid blocking webhook processing.
 * - No secrets (signatures, webhook secrets) are passed through.
 * - Idempotency hits are mapped to WEBHOOK_DUPLICATE.
 * - Signature failures produce WEBHOOK_SIGNATURE_FAILED with the failure reason in `reason`.
 */
@Injectable()
export class WebhookAuditHooksService {
  private readonly logger = new Logger(WebhookAuditHooksService.name);

  constructor(private readonly auditTrailService: AuditTrailService) {}

  /** Record an incoming webhook in the central audit trail. */
  onReceived(opts: {
    webhookId?: string;
    eventType?: string;
    source: string;
    ipAddress?: string;
    userAgent?: string;
  }): void {
    this.log(AuditAction.WEBHOOK_RECEIVED, {
      changes: {
        webhookId: opts.webhookId,
        eventType: opts.eventType,
        source: opts.source,
      },
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    });
  }

  /** Record a successful signature verification. */
  onSignatureVerified(opts: {
    source: string;
    ipAddress?: string;
    durationMs?: number;
  }): void {
    this.log(AuditAction.WEBHOOK_SIGNATURE_VERIFIED, {
      changes: { source: opts.source, durationMs: opts.durationMs },
      ipAddress: opts.ipAddress,
    });
  }

  /** Record a failed signature verification. */
  onSignatureFailed(opts: {
    source: string;
    reason?: string;
    ipAddress?: string;
    durationMs?: number;
  }): void {
    this.log(AuditAction.WEBHOOK_SIGNATURE_FAILED, {
      changes: { source: opts.source, durationMs: opts.durationMs },
      reason: opts.reason,
      ipAddress: opts.ipAddress,
    });
  }

  /** Record an idempotency hit (duplicate webhook). */
  onDuplicate(opts: {
    webhookId?: string;
    eventType?: string;
    source: string;
  }): void {
    this.log(AuditAction.WEBHOOK_DUPLICATE, {
      changes: {
        webhookId: opts.webhookId,
        eventType: opts.eventType,
        source: opts.source,
      },
    });
  }

  /** Record successful webhook processing. */
  onProcessed(opts: {
    webhookId?: string;
    eventType?: string;
    source: string;
    durationMs?: number;
  }): void {
    this.log(AuditAction.WEBHOOK_PROCESSED, {
      changes: {
        webhookId: opts.webhookId,
        eventType: opts.eventType,
        source: opts.source,
        durationMs: opts.durationMs,
      },
    });
  }

  /** Record a webhook processing failure. */
  onFailed(opts: {
    webhookId?: string;
    eventType?: string;
    source: string;
    errorName?: string;
    errorMessage?: string;
    durationMs?: number;
  }): void {
    this.log(AuditAction.WEBHOOK_FAILED, {
      changes: {
        webhookId: opts.webhookId,
        eventType: opts.eventType,
        source: opts.source,
        durationMs: opts.durationMs,
        errorName: opts.errorName,
      },
      reason: opts.errorMessage,
    });
  }

  // ── internals ────────────────────────────────────────────────────────────

  private log(
    action: AuditAction,
    opts: Parameters<AuditTrailService['log']>[1],
  ): void {
    this.auditTrailService.log(action, opts).catch((err: unknown) => {
      this.logger.error(
        `Failed to write central audit log for ${action}: ${(err as Error).message}`,
      );
    });
  }
}
