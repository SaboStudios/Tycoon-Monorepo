import { SetMetadata } from '@nestjs/common';
import { AuditAction } from './entities/audit-trail.entity';
import { AUDIT_ACTION_KEY } from './audit-trail.interceptor';

/**
 * Tags a handler so `AuditTrailInterceptor` records a row in `audit_trails`
 * after the handler succeeds. The controller (or handler) must also be
 * decorated with `@UseInterceptors(AuditTrailInterceptor)` and its module must
 * import `AuditTrailModule`.
 */
export const AuditLog = (action: AuditAction) =>
  SetMetadata(AUDIT_ACTION_KEY, action);
