import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, defer, from } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditTrailService } from './audit-trail.service';
import { AuditAction } from './entities/audit-trail.entity';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

export const AUDIT_ACTION_KEY = 'audit_action';

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
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

    const numericTargetIds = Object.fromEntries(
      Object.entries(request.params ?? {}).filter(
        ([key, value]) =>
          ['id', 'userId', 'itemId', 'perkId', 'boostId'].includes(key) &&
          /^\d{1,20}$/.test(value),
      ),
    );
    const bodyFields = Object.keys(request.body ?? {})
      .slice(0, 32)
      .sort();

    return defer(() =>
      from(
        this.auditTrailService.log(action, {
          userId: user?.id,
          performedBy: user?.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          changes: {
            phase: 'attempted',
            method: request.method,
            targetIds: numericTargetIds,
            fields: bodyFields,
          },
        }),
      ).pipe(concatMap(() => next.handle())),
    );
  }
}
