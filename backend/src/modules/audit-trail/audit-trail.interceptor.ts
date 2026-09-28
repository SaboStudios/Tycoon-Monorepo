import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditTrailService } from './audit-trail.service';
import { AuditAction } from './entities/audit-trail.entity';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

export const AUDIT_ACTION_KEY = 'audit_action';

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditTrailInterceptor.name);

  constructor(
    private readonly auditTrailService: AuditTrailService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const action = this.reflector.get<AuditAction>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );

    if (!action) {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const user = request.user;
    const targetId = Number(request.params?.id);

    return next.handle().pipe(
      tap(() => {
        // Record the actor, the route *pattern* and the target id only. Raw
        // URLs, query strings and request bodies may carry PII or secrets.
        this.auditTrailService
          .log(action, {
            userId: Number.isInteger(targetId) ? targetId : undefined,
            performedBy: user?.id ?? user?.sub,
            changes: {
              method: request.method,
              route: (request.route as { path?: string } | undefined)?.path,
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          })
          .catch((error: unknown) => {
            this.logger.error(
              `Failed to log audit trail for ${action}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          });
      }),
    );
  }
}
