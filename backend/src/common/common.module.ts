import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PaginationService } from './services/pagination.service';
import { LoggerModule } from './logger/logger.module';
import { HttpLoggerMiddleware } from './middleware/http-logger.middleware';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [PaginationService],
  exports: [PaginationService, LoggerModule],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
