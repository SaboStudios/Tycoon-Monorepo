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

    return next.handle().pipe(
      tap(() => {
        this.auditTrailService
          .log(action, {
            userId: user?.id,
            userEmail: user?.email,
            performedBy: user?.id,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          })
          .catch((error) => {
            this.logger.error(
              `Failed to log audit trail for ${action}:`,
              error,
            );
          });
      }),
    );
  }
}
