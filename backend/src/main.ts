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
import { buildHelmetOptions } from './config/helmet.config';
import { GamesIoAdapter } from './modules/games/realtime/games-io.adapter';
import { GamesWsMetrics } from './modules/games/realtime/games-ws-metrics.service';

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

  // /games WebSocket transport (ADR-002): Redis adapter for cross-instance
  // fan-out when Redis is configured; degrades to per-instance delivery.
  app.useWebSocketAdapter(
    new GamesIoAdapter(app, configService.get('redis'), () => {
      app.get(GamesWsMetrics, { strict: false }).adapterPublishFailure();
    }),
  );

  // Security headers — see config/helmet.config.ts for the tuned options.
  const isProduction =
    configService.get<string>('app.nodeEnv') === 'production';

  app.use(helmet(buildHelmetOptions(isProduction)));

  // Trust proxy
  if (configService.get<boolean>('app.trustProxy')) {
    const adapter = app.getHttpAdapter();
    const instance = adapter.getInstance();
    if (typeof instance.set === 'function') {
      instance.set('trust proxy', 1);
    }
  }

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
  const corsAllowedOrigins =
    configService.get<string[]>('app.corsAllowedOrigins') || [];
  const corsCredentials =
    configService.get<boolean>('app.corsCredentials') ?? true;
  const corsMaxAge = configService.get<number>('app.corsMaxAge') || 86400;
  const corsDevWildcard =
    configService.get<boolean>('app.corsDevWildcard') ?? true;
  const nodeEnv = configService.get<string>('app.nodeEnv') || 'development';
  const isDevelopment = nodeEnv === 'development';

  // Log CORS configuration at startup
  loggerService.log(
    `CORS: ${corsAllowedOrigins.length} allowed origin(s) configured`,
    'Bootstrap',
  );

  if (isDevelopment && corsDevWildcard) {
    loggerService.log(
      'CORS: Development wildcard rules enabled (localhost, 127.0.0.1, *.local)',
      'Bootstrap',
    );
  } else if (!isDevelopment && corsDevWildcard) {
    loggerService.warn(
      'CORS: Development wildcard rules enabled in non-development environment',
      'Bootstrap',
    );
  }

  /**
   * Dynamic CORS origin validation function
   * Checks against allowlist and applies wildcard rules in development
   */
  const corsOriginValidator = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    // Allow requests with no origin (e.g., mobile apps, Postman, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // Check against explicit allowlist
    if (corsAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Apply development wildcard rules
    if (isDevelopment && corsDevWildcard) {
      try {
        const url = new URL(origin);
        const hostname = url.hostname;

        // Allow localhost (any port)
        if (hostname === 'localhost') {
          return callback(null, true);
        }

        // Allow 127.0.0.1 (any port)
        if (hostname === '127.0.0.1') {
          return callback(null, true);
        }

        // Allow *.local pattern
        if (hostname.endsWith('.local')) {
          return callback(null, true);
        }
      } catch (err) {
        // Invalid URL, will be rejected below
      }
    }

    // Reject origin and log at WARN level
    const adapter = app.getHttpAdapter();
    const request = adapter.getRequestMethod ? undefined : origin; // Get request if available
    loggerService.warn(`CORS: Rejected origin: ${origin}`, 'CORS');

    // Return false to reject (no CORS headers will be sent)
    return callback(null, false);
  };

  app.enableCors({
    origin: corsOriginValidator,
    credentials: corsCredentials,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    maxAge: corsMaxAge,
  });

  // API versioning + compatibility
  const { apiPrefix } = configureApiVersioning(app, {
    apiPrefix: configService.get<string>('app.apiPrefix') || 'api',
    defaultVe

/* … truncated 1593 chars — edit only what you need near the top … */
