import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { GamePlayersService } from '../src/modules/games/game-players.service';
import { UserPreferencesService } from '../src/modules/users/user-preferences.service';
import { LocalAuthGuard } from '../src/modules/auth/guards/local-auth.guard';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { AdminGuard } from '../src/modules/auth/guards/admin.guard';
import { RedisRateLimitGuard } from '../src/common/guards/redis-rate-limit.guard';
import { configureApiVersioning } from '../src/common/versioning/api-versioning';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              jwt: {
                secret: 'test-secret',
                expiresIn: 900,
                refreshExpiresIn: 604800,
              },
              redis: {
                host: 'localhost',
                port: 6379,
              },
            }),
          ],
        }),
      ],
      controllers: [AuthController, UsersController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            refreshTokens: jest.fn().mockResolvedValue({
              accessToken: 'test-access-token',
              refreshToken: 'test-refresh-token',
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({
              data: [],
              meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
            }),
          },
        },
        {
          provide: GamePlayersService,
          useValue: { findGamesByUser: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: UserPreferencesService,
          useValue: {
            getPreferences: jest.fn().mockResolvedValue({}),
            updatePreferences: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    })
      .overrideGuard(LocalAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RedisRateLimitGuard)
      .useValue({ canActivate: () => true });

    const moduleFixture: TestingModule = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    configureApiVersioning(app, {
      apiPrefix: 'api',
      defaultVersion: '1',
      enableLegacyUnversionedRoutes: true,
      legacyUnversionedSunset: '2026-12-31T00:00:00.000Z',
    });
    await app.init();
  });

  it('/auth/refresh (POST) - Refresh endpoint works', () => {
    return request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'valid-refresh-token' })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body).toHaveProperty('refreshToken');
      });
  });

  it('/users (GET) - Returns paginated users list', () => {
    return request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/v1/users')
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          data: unknown[];
          meta: {
            page: number;
            limit: number;
            totalItems: number;
          };
        };
        expect(body).toHaveProperty('data');
        expect(body).toHaveProperty('meta');
        expect(body.meta).toHaveProperty('page');
        expect(body.meta).toHaveProperty('limit');
        expect(body.meta).toHaveProperty('totalItems');
        expect(Array.isArray(body.data)).toBe(true);
      });
  });

  it('/users (GET) - Legacy unversioned route is supported with deprecation headers', () => {
    return request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/users')
      .expect(200)
      .expect((res) => {
        expect(res.headers).toHaveProperty('deprecation', 'true');
        expect(res.headers).toHaveProperty('sunset');
      });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
