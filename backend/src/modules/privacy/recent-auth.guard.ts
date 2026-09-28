import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DataExportMetrics } from './data-export.metrics';

/** Stable machine-readable reason, surfaced in the 401 body as `error`. */
export const STEP_UP_REQUIRED = 'STEP_UP_REQUIRED';

/** Tolerate small clock drift between API replicas when checking `auth_time`. */
const FUTURE_AUTH_TIME_SKEW_SECONDS = 60;

export type StepUpFailureReason =
  | 'missing_auth_time'
  | 'stale'
  | 'future_auth_time'
  | 'method_not_allowed';

/**
 * Step-up ("recent authentication") guard for sensitive self-service actions
 * such as user data export (#1766).
 *
 * Must run after JwtAuthGuard. Requires the access token to have been minted
 * by a primary login (password or wallet) within
 * `DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS`. Tokens minted by /auth/refresh carry
 * no `auth_time` and are always rejected, so a stolen refresh token alone can
 * never trigger an export.
 *
 * On failure: 401 with `error: "STEP_UP_REQUIRED"` and an RFC 9470
 * `WWW-Authenticate` challenge telling the client to re-authenticate.
 */
@Injectable()
export class RecentAuthGuard implements CanActivate {
  private readonly logger = new Logger(RecentAuthGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly auditTrail: AuditTrailService,
    private readonly metrics: DataExportMetrics,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: JwtPayload }>();
    const user = request.user;

    // Deny by default: without an authenticated principal there is nothing to
    // step up from. JwtAuthGuard normally rejects first.
    if (!user) {
      throw new UnauthorizedException();
    }

    const maxAge =
      this.config.get<number>('app.dataExportStepUpMaxAgeSeconds') ?? 300;
    const allowedMethods = this.config.get<string[]>(
      'app.dataExportStepUpMethods',
    ) ?? ['pwd', 'wallet'];

    const reason = this.evaluate(user, maxAge, allowedMethods);
    if (!reason) {
      return true;
    }

    this.metrics.recordRequest('step_up_required');
    // Opaque numeric id and coarse reason only — no email, wallet or token.
    this.logger.warn(`Step-up rejected for user ${user.id}: ${reason}`);
    this.auditTrail
      .log(AuditAction.DATA_EXPORT_STEP_UP_FAILED, {
        userId: user.id,
        performedBy: user.id,
        changes: { reason },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      })
      .catch((error: unknown) =>
        this.logger.error(
          `Failed to audit step-up failure: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );

    http
      .getResponse<Response>()
      .setHeader(
        'WWW-Authenticate',
        `Bearer error="insufficient_user_authentication", ` +
          `error_description="A recent login is required", max_age=${maxAge}`,
      );
    throw new UnauthorizedException({
      statusCode: 401,
      message: `Please sign in again to continue (login must be under ${maxAge}s old).`,
      error: STEP_UP_REQUIRED,
    });
  }

  private evaluate(
    user: JwtPayload,
    maxAge: number,
    allowedMethods: string[],
  ): StepUpFailureReason | null {
    if (typeof user.auth_time !== 'number') {
      return 'missing_auth_time';
    }
    const now = Math.floor(Date.now() / 1000);
    if (user.auth_time > now + FUTURE_AUTH_TIME_SKEW_SECONDS) {
      return 'future_auth_time';
    }
    if (now - user.auth_time > maxAge) {
      return 'stale';
    }
    const methods = user.amr ?? [];
    if (!methods.some((m) => allowedMethods.includes(m))) {
      return 'method_not_allowed';
    }
    return null;
  }
}
