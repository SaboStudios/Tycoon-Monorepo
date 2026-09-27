import { Injectable, Logger } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HealthIndicatorResult, HealthIndicator } from '@nestjs/terminus';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface ProbeConfig {
  livenessPath: string;
  readinessPath: string;
  startupPath: string;
  timeoutMs: number;
  startupGracePeriodMs: number;
}

const DEFAULT_PROBE_CONFIG: ProbeConfig = {
  livenessPath: '/health/live',
  readinessPath: '/health/ready',
  startupPath: '/health/startup',
  timeoutMs: 5000,
  startupGracePeriodMs: 30000,
};

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(
    @InjectRepository('default')
    private readonly db: Repository<any>,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.db.query('SELECT 1');
      return this.getStatus(key, true);
    } catch (error) {
      this.logger.error('Database health check failed', { error: error.message });
      return this.getStatus(key, false, { message: error.message });
    }
  }
}

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(private readonly redisClient: any) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redisClient.ping();
      return this.getStatus(key, true);
    } catch (error) {
      this.logger.error('Redis health check failed', { error: error.message });
      return this.getStatus(key, false, { message: error.message });
    }
  }
}

@Injectable()
export class ShopApiHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(ShopApiHealthIndicator.name);

  constructor(private readonly httpClient: any) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const response = await this.httpClient.get('/health/live', { timeout: 5000 });
      if (response.status === 200) {
        return this.getStatus(key, true);
      }
      return this.getStatus(key, false, { message: `Status: ${response.status}` });
    } catch (error) {
      this.logger.error('Shop API health check failed', { error: error.message });
      return this.getStatus(key, false, { message: error.message });
    }
  }
}

@Injectable()
export class HealthProbesService {
  private readonly logger = new Logger(HealthProbesService.name);
  private readonly config: ProbeConfig;
  private startupTime: number;
  private isReady = false;

  constructor(
    private readonly health: HealthCheckService,
    private readonly dbIndicator: DatabaseHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly shopApiIndicator: ShopApiHealthIndicator,
  ) {
    this.config = DEFAULT_PROBE_CONFIG;
    this.startupTime = Date.now();
  }

  @HealthCheck()
  async liveness(): Promise<any> {
    return this.health.check([]);
  }

  @HealthCheck()
  async readiness(): Promise<any> {
    if (!this.isReady) {
      throw new Error('Service not ready');
    }

    return this.health.check([
      () => this.dbIndicator.isHealthy('database'),
      () => this.redisIndicator.isHealthy('redis'),
      () => this.shopApiIndicator.isHealthy('shop-api'),
    ]);
  }

  @HealthCheck()
  async startup(): Promise<any> {
    const elapsed = Date.now() - this.startupTime;
    if (elapsed < this.config.startupGracePeriodMs) {
      throw new Error('Startup in progress');
    }

    return this.health.check([
      () => this.dbIndicator.isHealthy('database'),
    ]);
  }

  markReady(): void {
    this.isReady = true;
    this.logger.log('Service marked as ready');
  }

  getProbeConfig(): ProbeConfig {
    return this.config;
  }
}
