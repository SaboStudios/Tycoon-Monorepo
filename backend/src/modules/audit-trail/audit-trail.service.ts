import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditTrail, AuditAction } from './entities/audit-trail.entity';

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

@Injectable()
export class AuditTrailService {
    constructor(
        @InjectRepository(AuditTrail)
        private auditTrailRepository: Repository<AuditTrail>,
    ) { }

    async log(action: AuditAction, options: AuditLogOptions): Promise<AuditTrail> {
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
}
