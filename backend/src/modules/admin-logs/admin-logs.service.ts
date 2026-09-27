import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as express from 'express';
import * as fastcsv from 'fast-csv';
import { AdminLog } from './entities/admin-log.entity';
import { AdminLogQueryDto } from './dto/admin-log-query.dto';
import { AdminLogExportDto } from './dto/admin-log-export.dto';
import {
  PaginationService,
  PaginatedResponse,
} from '../../common';

const ADMIN_LOG_EXPORT_LIMIT = 10_000;
const SENSITIVE_DETAIL_KEY =
  /(password|secret|token|authorization|cookie|api.?key|private.?key|email|phone|address|wallet)/i;

export function redactAuditDetails(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactAuditDetails);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        SENSITIVE_DETAIL_KEY.test(key)
          ? '[REDACTED]'
          : redactAuditDetails(nestedValue),
      ]),
    );
  }

  return value;
}

@Injectable()
export class AdminLogsService {
  constructor(
    @InjectRepository(AdminLog)
    private readonly adminLogRepository: Repository<AdminLog>,
    private readonly paginationService: PaginationService,
  ) {}

  /**
   * Create a new admin log entry
   */
  async createLog(
    adminId: number | undefined,
    action: string,
    targetId?: number,
    details?: any,
    req?: express.Request,
  ): Promise<AdminLog> {
    const logData: Partial<AdminLog> = {
      adminId,
      action,
      targetId,
      details: details as Record<string, any>,
      ipAddress: req?.ip || req?.headers['x-forwarded-for']?.toString(),
      userAgent: req?.headers['user-agent'],
    };
    const log = this.adminLogRepository.create(logData);

    return await this.adminLogRepository.save(log);
  }

  /**
   * Get all admin logs with pagination and filtering
   */
  async findAll(
    queryDto: AdminLogQueryDto,
  ): Promise<PaginatedResponse<AdminLog>> {
    const { adminId, action, startDate, endDate, cursor } = queryDto;
    const queryBuilder = this.adminLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.admin', 'admin')
      .select([
        'log.id',
        'log.adminId',
        'log.action',
        'log.targetId',
        'log.details',
        'log.createdAt',
        'admin.id',
      ]);

    // Apply filters
    if (adminId) {
      queryBuilder.andWhere('log.adminId = :adminId', { adminId });
    }

    if (action) {
      queryBuilder.andWhere('log.action = :action', { action });
    }

    if (startDate) {
      queryBuilder.andWhere('log.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('log.createdAt <= :endDate', { endDate });
    }

    // Cursor-based pagination (simple implementation by ID)
    if (cursor) {
      queryBuilder.andWhere('log.id < :cursor', { cursor });
    }

    const searchableFields = ['action', 'ipAddress'];

    const result = await this.paginationService.paginate(
      queryBuilder,
      queryDto,
      searchableFields,
    );
    return {
      ...result,
      data: result.data.map((log) => ({
        ...log,
        details: redactAuditDetails(log.details) as Record<string, any>,
      })),
    };
  }

  /**
   * Export admin logs as CSV with streaming support
   */
  async exportLogs(
    queryDto: AdminLogExportDto,
    res: express.Response,
  ): Promise<void> {
    const { adminId, action, startDate, endDate } = queryDto;
    const queryBuilder = this.adminLogRepository
      .createQueryBuilder('log')
      .select([
        'log.id',
        'log.adminId',
        'log.action',
        'log.targetId',
        'log.createdAt',
      ])
      .orderBy('log.createdAt', 'DESC')
      .limit(ADMIN_LOG_EXPORT_LIMIT);

    // Apply filters
    if (adminId) {
      queryBuilder.andWhere('log.adminId = :adminId', { adminId });
    }

    if (action) {
      queryBuilder.andWhere('log.action = :action', { action });
    }

    if (startDate) {
      queryBuilder.andWhere('log.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('log.createdAt <= :endDate', { endDate });
    }

    const filename = `admin_logs_export_${new Date().getTime()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    const csvStream = fastcsv.format({ headers: true });
    csvStream.pipe(res);

    const stream = await queryBuilder.stream();
    for await (const row of stream) {
      // TypeORM stream returns raw data with aliases
      csvStream.write({
        ID: row.log_id,
        AdminID: row.log_adminId,
        Action: row.log_action,
        TargetID: row.log_targetId,
        CreatedAt: row.log_createdAt,
      });
    }

    csvStream.end();
  }
}
