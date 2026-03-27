import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { HttpMetricsMiddleware } from './http-metrics.middleware';
import { HttpMetricsService } from './http-metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  controllers: [MetricsController],
  providers: [HttpMetricsService, HttpMetricsMiddleware],
  exports: [HttpMetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpMetricsMiddleware).forRoutes('*');
  }
}
