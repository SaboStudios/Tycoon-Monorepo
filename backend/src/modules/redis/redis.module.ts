import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import { RedisService } from './redis.service';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { ValidatedCacheService } from './validated-cache.service';
import { CacheExceptionFilter } from './cache-exception.filter';
import { LoggerModule } from '../../common/logger/logger.module';

@Global()
@Module({
  imports: [
    LoggerModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisConfig = configService.get<{
          host: string;
          port: number;
          password?: string;
          db: number;
          ttl: number;
        }>('redis');
        if (!redisConfig) {
          throw new Error('Redis configuration not found');
        }
        return {
          store: redisStore,
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          db: redisConfig.db,
          ttl: redisConfig.ttl,
        };
      },
    }),
    AuditTrailModule,
  ],
  providers: [RedisService, IdempotencyService, IdempotencyInterceptor, ValidatedCacheService, CacheExceptionFilter],
  exports: [CacheModule, RedisService, IdempotencyService, IdempotencyInterceptor, ValidatedCacheService, CacheExceptionFilter],
})
export class RedisModule {}
