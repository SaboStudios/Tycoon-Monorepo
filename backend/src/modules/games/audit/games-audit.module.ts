import { Module } from '@nestjs/common';
import { AuditTrailModule } from '../../audit-trail/audit-trail.module';
import { GamesAuditService } from './games-audit.service';
import { GamesAuditInterceptor } from './games-audit.interceptor';
import { SensitiveDataRedactor } from './sensitive-data-redactor.service';
import { GamesObservabilityService } from '../games-observability.service';

/**
 * Module for Games & Matchmaking audit trail functionality.
 * 
 * Provides:
 * - GamesAuditService: Central service for audit logging
 * - GamesAuditInterceptor: HTTP-level audit capture
 * - SensitiveDataRedactor: Privacy protection for audit logs
 * 
 * Integrates with:
 * - AuditTrailModule: Persistent database audit records
 * - GamesObservabilityService: Real-time metrics and structured logging
 * 
 * Usage:
 * ```typescript
 * @Module({
 *   imports: [GamesAuditModule],
 *   // ...
 * })
 * export class GamesModule {}
 * ```
 */
@Module({
  imports: [AuditTrailModule],
  providers: [
    GamesAuditService,
    GamesAuditInterceptor,
    SensitiveDataRedactor,
    GamesObservabilityService,
  ],
  exports: [GamesAuditService, GamesAuditInterceptor],
})
export class GamesAuditModule {}
