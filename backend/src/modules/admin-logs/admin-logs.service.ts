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
        'log.ipAddress',
        'log.userAgent',
        'log.createdAt',
        'admin.id',
        'admin.email',
        'admin.username',
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

    return await this.paginationService.paginate(
      queryBuilder,
      queryDto,
      searchableFields,
    );
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
      .leftJoinAndSelect('log.admin', 'admin')
      .select([
        'log.id',
        'log.adminId',
        'log.action',
        'log.targetId',
        'log.details',
        'log.ipAddress',
        'log.userAgent',
        'log.createdAt',
        'admin.id',
        'admin.email',
        'admin.username',
      ])
      .orderBy('log.createdAt', 'DESC');

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
        Admin: row.admin_email || row.log_adminId,
        Action: row.log_action,
        TargetID: row.log_targetId,
        IPAddress: row.log_ipAddress,
        UserAgent: row.log_userAgent,
        CreatedAt: row.log_createdAt,
        Details: JSON.stringify(row.log_details),
      });
    }

    csvStream.end();
  }
}
