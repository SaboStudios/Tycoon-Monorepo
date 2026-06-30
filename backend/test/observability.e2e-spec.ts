import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Logger as NestLogger,
} from '@nestjs/common';
import request from 'supertest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObservabilityModule } from '../src/observability/observability.module';
import { MetricsModule } from '../src/modules/metrics/metrics.module';
import { HealthController } from '../src/health/health.controller';
import { getDataSourceToken } from '@nestjs/typeorm';
import { RedisService } from '../src/modules/redis/redis.service';
import { AuditTrailService } from '../src/modules/audit-trail/audit-trail.service';
import { Reflector } from '@nestjs/core';
import { AuditTrail } from '../src/modules/audit-trail/entities/audit-trail.entity';

async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            app: {
              nodeEnv: 'test',
              port: 3000,
              apiPrefix: 'api',
              trustProxy: false,
            },
            database: {
              type: 'sqlite',
              database: ':memory:',
              entities: [AuditTrail],
              synchronize: true,
            },
          }),
        ],
      }),
      WinstonModule.forRoot({
        transports: [new winston.transports.Console({ silent: true })],
      }),
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const dbConfig = configService.get('database') as Record<string, unknown>;
          return dbConfig;
        },
      }),
      TypeOrmModule.forFeature([AuditTrail]),
      MetricsModule,
      ObservabilityModule,
    ],
    controllers: [HealthController],
    providers: [
      {
        provide: RedisService,
        useValue: {
          set: jest.fn().mockResolvedValue(undefined),
          get: jest.fn().mockResolvedValue('ok'),
        },
      },
      {
        provide: AuditTrailService,
        useValue: { log: jest.fn() },
      },
      {
        provide: Reflector,
        useValue: { get: jest.fn() },
      },
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

describe('Observability Endpoints (SW-BE-025)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('/health (aggregate health)', () => {
    it('returns 200 with healthy status', () => {
      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('healthy');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('uptime');
          expect(res.body).toHaveProperty('redis');
          expect(res.body).toHaveProperty('database');
          expect(res.body).toHaveProperty('memory');
        });
    });
  });

  describe('/health/live (liveness)', () => {
    it('returns 200 with healthy status for liveness probe', () => {
      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .get('/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('healthy');
          expect(res.body).toHaveProperty('uptime');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('/health/ready (readiness)', () => {
    it('returns 200 with healthy status for readiness probe', () => {
      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .get('/health/ready')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('healthy');
          expect(res.body).toHaveProperty('redis');
          expect(res.body).toHaveProperty('database');
        });
    });
  });

  describe('/health/redis (redis health)', () => {
    it('returns 200 with redis connection status', () => {
      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .get('/health/redis')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('healthy');
          expect(res.body).toHaveProperty('redis');
          expect(res.body.redis).toBe('connected');
        });
    });
  });

  describe('/metrics endpoint', () => {
    it('returns Prometheus metrics text', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/metrics')
        .expect(200);

      expect(response.header['content-type']).toContain('text/plain');
      expect(response.text).toContain('tycoon_http_requests_total');
    });

    it('includes process metrics in scrape output', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('tycoon_process_heap_used_bytes');
      expect(response.text).toContain('tycoon_process_uptime_seconds');
    });

    it('includes database pool metrics when available', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('tycoon_db_pool_total');
    });
  });

  describe('Correlation ID header (SW-BE-025)', () => {
    it('returns x-request-id header on responses', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/health/live');

      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('reuses incoming x-request-id header', async () => {
      const clientTraceId = 'test-trace-id-123';
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/health/ready')
        .set('x-request-id', clientTraceId);

      expect(response.headers['x-request-id']).toBe(clientTraceId);
    });
  });
});