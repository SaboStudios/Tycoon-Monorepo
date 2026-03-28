import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // Enable NestJS lifecycle shutdown hooks (SIGTERM / SIGINT).
  // This triggers OnApplicationShutdown hooks, including GracefulShutdownService.
  app.enableShutdownHooks();

  // Use Winston logger
  const winstonLogger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(winstonLogger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;

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
  const { apiPrefix } = configureApiVersioning(app, {
    apiPrefix: configService.get<string>('app.apiPrefix') || 'api',
    defaultVersion: configService.get<string>('app.defaultApiVersion') || '1',
    enableLegacyUnversionedRoutes:
      configService.get<boolean>('app.enableLegacyUnversionedRoutes') ?? true,
    legacyUnversionedSunset:
      configService.get<string>('app.legacyUnversionedSunset') || undefined,
  });

  // Set HTTP keep-alive timeout so the server stops accepting new connections
  // promptly on shutdown.  Must be < SHUTDOWN_TIMEOUT_MS (15 s) so the HTTP
  // layer drains before the DB/Redis pools are closed.
  const shutdownTimeoutMs =
    configService.get<number>('app.shutdownTimeoutMs') ?? 15000;
  const httpServer = app.getHttpServer();
  httpServer.keepAliveTimeout = shutdownTimeoutMs;
  httpServer.headersTimeout = shutdownTimeoutMs + 1000;

  // Swagger/OpenAPI setup (dev/staging only)
  const swaggerEnabled =
    configService.get<string>('app.nodeEnv') !== 'production' ||
    process.env.ENABLE_SWAGGER === 'true';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Tycoon API')
      .setDescription('Tycoon Monorepo Backend API - OpenAPI 3.0')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT-auth',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    const tempLogger = app.get(LoggerService);
    tempLogger.log(
      `📚 Swagger UI: http://localhost:${port}/${apiPrefix}/docs`,
      'Bootstrap',
    );
  }

  const logger = app.get(LoggerService);

  await app.listen(port);
  logger.log(
    `🚀 Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
  // API Documentation log moved to Swagger setup
  logger.log(
    `Environment: ${configService.get<string>('app.environment') || 'development'}`,
    'Bootstrap',
  );
  logger.log(`Log Level: ${process.env.LOG_LEVEL || 'default'}`, 'Bootstrap');
}
void bootstrap();
