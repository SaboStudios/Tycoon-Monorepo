import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsModule } from '../modules/metrics/metrics.module';
import { HealthController } from '../health/health.controller';
import { CorrelationIdMiddleware } from '../common/middleware/correlation-id.middleware';
import { RedisModule } from '../modules/redis/redis.module';
import { AuditTrailModule } from '../modules/audit-trail/audit-trail.module';

/**
 * ObservabilityModule — SW-BE-025
 *
 * Groups all observability concerns:
 *   - MetricsModule   (Prometheus /metrics, HttpMetricsMiddleware)
 *   - HealthController (/health, /health/live, /health/ready, /health/redis)
 *   - CorrelationIdMiddleware (X-Request-Id propagation)
 *
 * Import this in AppModule instead of importing MetricsModule + HealthController
 * individually.
 */
@Module({
  imports: [
    MetricsModule,
    RedisModule,
    AuditTrailModule,
    TypeOrmModule.forFeature([]),
  ],
  controllers: [HealthController],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
