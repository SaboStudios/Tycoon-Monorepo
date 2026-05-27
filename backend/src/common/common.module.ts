import {
  Module,
  Global,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { PaginationService } from './services/pagination.service';
import { SoftDeleteService } from './services/soft-delete.service';
import { LoggerModule } from './logger/logger.module';
import { HttpLoggerMiddleware } from './middleware/http-logger.middleware';
import { HealthCheckMiddleware } from './middleware/health-check.middleware';
import { JwtVerificationMiddleware } from './middleware/jwt-verification.middleware';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [
    PaginationService,
    SoftDeleteService,
    HealthCheckMiddleware,
    JwtVerificationMiddleware,
  ],
  exports: [
    PaginationService,
    SoftDeleteService,
    LoggerModule,
    JwtVerificationMiddleware,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
    consumer
      .apply(HealthCheckMiddleware)
      .forRoutes({ path: 'health/status', method: RequestMethod.GET });
    consumer
      .apply(JwtVerificationMiddleware)
      .forRoutes({ path: 'auth/logout', method: RequestMethod.POST });
  }
}
