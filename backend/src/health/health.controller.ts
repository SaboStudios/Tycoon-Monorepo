import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../modules/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly redisService: RedisService) {}

  @Get('redis')
  async checkRedis() {
    try {
      await this.redisService.set('health-check', 'ok', 10);
      const result = await this.redisService.get('health-check');
      return {
        status: 'healthy',
        redis: result === 'ok' ? 'connected' : 'error',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        redis: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
