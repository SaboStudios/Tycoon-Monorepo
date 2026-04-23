import { SetMetadata } from '@nestjs/common';
import { AuditAction } from './entities/audit-trail.entity';
import { AUDIT_ACTION_KEY } from './audit-trail.interceptor';

export const AuditLog = (action: AuditAction) => SetMetadata(AUDIT_ACTION_KEY, action);
