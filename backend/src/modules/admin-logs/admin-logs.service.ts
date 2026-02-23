import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { AdminLog } from './entities/admin-log.entity';
import {
  PaginationService,
  PaginationDto,
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
    req?: Request,
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
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<AdminLog>> {
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

    const searchableFields = ['action', 'ipAddress'];

    return await this.paginationService.paginate(
      queryBuilder,
      paginationDto,
      searchableFields,
    );
  }
}
