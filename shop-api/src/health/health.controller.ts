import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Health endpoints for k8s/compose probes.
 *
 *  GET /health/live  — liveness: 200 while the process is up (no dependencies).
 *  GET /health/ready — readiness: 200 when the TypeORM DataSource is initialized,
 *                      503 when it is not.
 *
 * Responses intentionally contain no connection strings, credentials, or PII.
 */
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Liveness — the process is up and the event loop is responsive. */
  @Get('live')
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /** Readiness — the database connection is established. */
  @Get('ready')
  async readiness(@Res() res: Response) {
    if (!this.dataSource.isInitialized) {
      return res.status(503).json({
        status: 'error',
        database: 'down',
        timestamp: new Date().toISOString(),
      });
    }
    return res.status(200).json({
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    });
  }
}
