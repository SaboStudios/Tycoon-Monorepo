import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { RedisService } from '../modules/redis/redis.service';
import { AuditTrailInterceptor } from '../modules/audit-trail/audit-trail.interceptor';
import { AuditLog } from '../modules/audit-trail/audit-log.decorator';
import { AuditAction } from '../modules/audit-trail/entities/audit-trail.entity';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Health endpoints — SW-BE-025
 *
 * GET /health/live    — liveness probe (process is up)
 * GET /health/ready   — readiness probe (DB + Redis reachable)
 * GET /health/redis   — Redis-only check (backward-compat)
 * GET /health         — full aggregate check
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly redisService: RedisService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Liveness: the process is alive and the event loop is responsive. */
  @Get('live')
  liveness(): HealthStatus {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /** Readiness: all critical dependencies are reachable. */
  @Get('ready')
  async readiness(): Promise<HealthStatus> {
    const [redisOk, dbOk] = await Promise.all([
      this.checkRedisOk(),
      this.checkDbOk(),
    ]);

    const allOk = redisOk && dbOk;
    return {
      status: allOk ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      redis: redisOk ? 'connected' : 'disconnected',
      database: dbOk ? 'connected' : 'disconnected',
    };
  }

  /** Full aggregate health check (all dependencies). */
  @Get()
  @UseInterceptors(AuditTrailInterceptor)
  @AuditLog(AuditAction.HEALTH_CHECK_ACCESSED)
  async aggregate(): Promise<HealthStatus> {
    const [redisOk, dbOk] = await Promise.all([
      this.checkRedisOk(),
      this.checkDbOk(),
    ]);

    const allOk = redisOk && dbOk;
    const anyOk = redisOk || dbOk;

    return {
      status: allOk ? 'healthy' : anyOk ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      redis: redisOk ? 'connected' : 'disconnected',
      database: dbOk ? 'connected' : 'disconnected',
      memory: {
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    };
  }

  /** Redis-only check — kept for backward compatibility. */
  @Get('redis')
  @UseInterceptors(AuditTrailInterceptor)
  @AuditLog(AuditAction.HEALTH_CHECK_ACCESSED)
  async checkRedis(): Promise<HealthStatus> {
    const ok = await this.checkRedisOk();
    return {
      status: ok ? 'healthy' : 'unhealthy',
      redis: ok ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async checkRedisOk(): Promise<boolean> {
    try {
      await this.redisService.set('health-check', 'ok', 10);
      const result = await this.redisService.get('health-check');
      return result === 'ok';
    } catch {
      return false;
    }
  }

  private async checkDbOk(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
