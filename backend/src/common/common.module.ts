import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PaginationService } from './services/pagination.service';
import { SoftDeleteService } from './services/soft-delete.service';
import { LoggerModule } from './logger/logger.module';
import { HttpLoggerMiddleware } from './middleware/http-logger.middleware';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [PaginationService, SoftDeleteService],
  exports: [PaginationService, SoftDeleteService, LoggerModule],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
