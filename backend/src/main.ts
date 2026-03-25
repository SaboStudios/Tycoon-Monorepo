import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerService } from './common/logger/logger.service';
import { configureApiVersioning } from './common/versioning/api-versioning';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Use Winston logger
  const winstonLogger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(winstonLogger);

  const configService = app.get(ConfigService);

  // Enable Helmet
  app.use(helmet());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global Exception Filter
  const httpAdapterHost = app.get(HttpAdapterHost);
  const loggerService = app.get(LoggerService);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost, loggerService));

  // CORS configuration
  app.enableCors({
    origin: configService.get<string>('app.corsOrigin'),
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // API versioning + compatibility
  const { apiPrefix, defaultVersion } = configureApiVersioning(app, {
    apiPrefix: configService.get<string>('app.apiPrefix') || 'api',
    defaultVersion: configService.get<string>('app.defaultApiVersion') || '1',
    enableLegacyUnversionedRoutes:
      configService.get<boolean>('app.enableLegacyUnversionedRoutes') ?? true,
    legacyUnversionedSunset:
      configService.get<string>('app.legacyUnversionedSunset') || undefined,
  });

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);

  const logger = app.get(LoggerService);
  logger.log(
    `🚀 Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
  logger.log(
    `📚 API Documentation: http://localhost:${port}/${apiPrefix}/v${defaultVersion}`,
    'Bootstrap',
  );
  logger.log(
    `Environment: ${configService.get<string>('app.environment') || 'development'}`,
    'Bootstrap',
  );
  logger.log(`Log Level: ${process.env.LOG_LEVEL || 'default'}`, 'Bootstrap');
}
void bootstrap();
