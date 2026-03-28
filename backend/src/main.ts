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

  // Security headers — tuned for a JSON API with Swagger UI served at /api/docs.
  //
  // Reverse-proxy note: if Nginx/Caddy/ALB already sets HSTS, X-Frame-Options,
  // or X-Content-Type-Options you will see duplicate headers. Either disable
  // those directives in the proxy config or set HELMET_HSTS=false /
  // HELMET_NOSNIFF=false env vars and guard the calls below accordingly.
  // See docs/security/REVERSE_PROXY_HEADERS.md for the recommended split.
  const isProduction =
    configService.get<string>('app.nodeEnv') === 'production';

  app.use(
    helmet({
      // HSTS: 1 year, include subdomains, allow preload list submission.
      // Only meaningful when TLS is terminated at this process or a proxy
      // that forwards the header. Disable at the proxy layer if duplicated.
      hsts: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
      },

      // Prevent MIME-type sniffing — always on.
      noSniff: true,

      // Deny framing entirely (API has no iframe use-case).
      frameguard: { action: 'deny' },

      // Disable the legacy X-XSS-Protection header; modern browsers use CSP.
      xssFilter: false,

      // Hide X-Powered-By.
      hidePoweredBy: true,

      // Referrer policy — safe default for an API.
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

      // Permissions policy — disable all browser features the API never uses.
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },

      // Content-Security-Policy:
      //   • Pure JSON endpoints: restrictive policy blocks any accidental HTML.
      //   • Swagger UI (served at /api/docs): needs inline scripts/styles and
      //     CDN resources. The policy below covers both via a single directive
      //     set that is safe for the Swagger bundle served by @nestjs/swagger.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            // Swagger UI injects inline scripts; unsafe-inline is required.
            // Tighten to a nonce/hash if you serve custom HTML outside Swagger.
            "'unsafe-inline'",
          ],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          // Upgrade insecure requests in production only.
          ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
        },
      },

      // Cross-Origin policies — lock down for a pure API.
      crossOriginEmbedderPolicy: false, // would break Swagger UI CDN assets
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );

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
  const corsAllowedOrigins = configService.get<string[]>('app.corsAllowedOrigins') || [];
  const corsCredentials = configService.get<boolean>('app.corsCredentials') ?? true;
  const corsMaxAge = configService.get<number>('app.corsMaxAge') || 86400;
  const corsDevWildcard = configService.get<boolean>('app.corsDevWildcard') ?? true;
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
  const corsOriginValidator = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
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
    loggerService.warn(
      `CORS: Rejected origin: ${origin}`,
      'CORS',
    );

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
    defaultVersion: configService.get<string>('app.defaultApiVersion') || '1',
    enableLegacyUnversionedRoutes:
      configService.get<boolean>('app.enableLegacyUnversionedRoutes') ?? true,
    legacyUnversionedSunset:
      configService.get<string>('app.legacyUnversionedSunset') || undefined,
  });

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
