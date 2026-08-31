import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditTrail, AuditAction } from './entities/audit-trail.entity';
import { QueryAuditTrailDto } from './dto/query-audit-trail.dto';

export interface AuditLogOptions {
  userId?: number;
  userEmail?: string;
  performedBy?: number;
  performedByEmail?: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

/** Default retention window: 90 days */
export const AUDIT_RETENTION_DAYS = 90;

@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);

  constructor(
    @InjectRepository(AuditTrail)
    private auditTrailRepository: Repository<AuditTrail>,
  ) {}

  async log(
    action: AuditAction,
    options: AuditLogOptions,
  ): Promise<AuditTrail> {
    const auditTrail = this.auditTrailRepository.create({
      action,
      userId: options.userId,
      userEmail: options.userEmail,
      performedBy: options.performedBy,
      performedByEmail: options.performedByEmail,
      changes: options.changes,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      reason: options.reason,
    });

    return this.auditTrailRepository.save(auditTrail);
  }

  async getUserAuditTrail(userId: number, limit = 50, offset = 0) {
    const [data, total] = await this.auditTrailRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  async getAuditTrailByAction(action: AuditAction, limit = 50, offset = 0) {
    const [data, total] = await this.auditTrailRepository.findAndCount({
      where: { action },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  async findAll(queryDto: QueryAuditTrailDto) {
    const { userId, action, limit = 50, offset = 0 } = queryDto;
    const where: FindOptionsWhere<AuditTrail> = {};
    if (userId !== undefined) {
      where.userId = userId;
    }
    if (action !== undefined) {
      where.action = action;
    }
    const [data, total] = await this.auditTrailRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  /**
   * Export all audit logs (optionally filtered) as a JSON array.
   * Admin-only; intended for compliance/data-access requests.
   */
  async exportLogs(queryDto: QueryAuditTrailDto): Promise<AuditTrail[]> {
    const { userId, action } = queryDto;
    const where: FindOptionsWhere<AuditTrail> = {};
    if (userId !== undefined) where.userId = userId;
    if (action !== undefined) where.action = action;

    return this.auditTrailRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Delete audit log entries older than `retentionDays` days.
   * Runs nightly at 02:00 UTC.
   * Retention policy: {@link AUDIT_RETENTION_DAYS} days (default 90).
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeExpiredLogs(retentionDays = AUDIT_RETENTION_DAYS): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.auditTrailRepository.delete({
      createdAt: LessThan(cutoff),
    });

    const deleted = result.affected ?? 0;
    this.logger.log(
      `Audit retention purge: deleted ${deleted} entries older than ${retentionDays} days (cutoff: ${cutoff.toISOString()})`,
    );
    return deleted;
  }
}
