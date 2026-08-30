import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestLoggerInterceptor } from './common/interceptors/request-logger.interceptor';
import { StructuredLoggerService } from './common/logger/structured-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLoggerService(),
  });

  // Validate and strip unknown fields on all incoming DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Consistent error shape; no internal details or secrets in responses.
  app.useGlobalFilters(new HttpExceptionFilter());

  // Structured request/response logging with request ID correlation.
  app.useGlobalInterceptors(new RequestLoggerInterceptor());

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
