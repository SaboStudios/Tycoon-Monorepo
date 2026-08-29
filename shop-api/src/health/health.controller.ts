import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Health endpoints for k8s/compose probes.
 *
 *  GET /health  — liveness: 200 while the process is up (no dependencies).
 *  GET /ready   — readiness: 200 when Postgres responds, 503 when it does not.
 *
 * Responses intentionally contain no connection strings, credentials, or PII.
 */
@Controller()
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Liveness — the process is up and the event loop is responsive. */
  @Get('health')
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /** Readiness — the database is reachable. */
  @Get('ready')
  async readiness(@Res() res: Response) {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
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
