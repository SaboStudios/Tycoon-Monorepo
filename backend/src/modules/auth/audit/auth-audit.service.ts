/**
 * SW-BE-005: Auth & JWT — audit trail hooks
 *
 * AuthAuditService writes structured audit log entries for every significant
 * auth event. It uses NestJS Logger so entries flow through the existing
 * Winston pipeline — no new DB table or migration required.
 *
 * Rules:
 *  - NEVER log raw tokens, passwords, or token hashes.
 *  - Always include userId (when known), event type, IP, and userAgent.
 *  - Security events (reuse, suspended) are logged at WARN level.
 *  - Failures are logged at WARN; successes at LOG (info).
 */
import { Injectable, Logger } from '@nestjs/common';
import { AuthAuditEventType } from './auth-audit.events';

export interface AuthAuditContext {
  /** Authenticated or attempted user id — omit when unknown */
  userId?: number;
  /** Redacted email (first char + domain only, e.g. p***@example.com) */
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  /** Any extra structured metadata — must NOT contain secrets */
  meta?: Record<string, unknown>;
}

const SECURITY_EVENTS = new Set([
  'AUTH_TOKEN_REUSE_DETECTED',
  'AUTH_LOGIN_SUSPENDED',
  'AUTH_LOGIN_FAILED',
  'AUTH_TOKEN_REFRESH_FAILED',
  'AUTH_WALLET_LOGIN_FAILED',
]);

@Injectable()
export class AuthAuditService {
  private readonly logger = new Logger(AuthAuditService.name);

  /**
   * Redact an email address so it is identifiable but not fully exposed in logs.
   * "player@example.com" → "p***@example.com"
   */
  static redactEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.charAt(0)}***@${domain}`;
  }

  record(event: AuthAuditEventType, ctx: AuthAuditContext = {}): void {
    const entry = {
      event,
      userId: ctx.userId ?? null,
      email: ctx.email ?? null,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      ...(ctx.meta ?? {}),
    };

    const message = `[AUDIT] ${event}`;

    if (SECURITY_EVENTS.has(event)) {
      this.logger.warn(message, JSON.stringify(entry));
    } else {
      this.logger.log(message, JSON.stringify(entry));
    }
  }
}
