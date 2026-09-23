import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { GamesController } from '../src/modules/games/games.controller';
import { GamesService } from '../src/modules/games/games.service';
import { GamePlayersService } from '../src/modules/games/game-players.service';
import { IdempotencyInterceptor } from '../src/common/interceptors/idempotency.interceptor';
import { RedisService } from '../src/modules/redis/redis.service';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { AdminGuard } from '../src/modules/auth/guards/admin.guard';
import { AuditTrailService } from '../src/modules/audit/audit-trail.service';

describe('Games Idempotency (e2e)', () => {
  let app: INestApplication;
  let gamesService: GamesService;
  let redisService: RedisService;

  const mockGame = { id: 1, code: 'TEST12' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [
        {
          provide: GamesService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockGame),
          },
        },
        {
          provide: GamePlayersService,
          useValue: {},
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            incrementRateLimit: jest.fn().mockResolvedValue(1),
            del: jest.fn(),
          },
        },
        {
          provide: AuditTrailService,
          useValue: {
            record: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    gamesService = moduleFixture.get<GamesService>(GamesService);
    redisService = moduleFixture.get<RedisService>(RedisService);
    await app.init();
  });

  it('should create a game and cache the response', async () => {
    const idempotencyKey = 'unique-key-1';

    // First request
    const res1 = await request(app.getHttpServer())
      .post('/games')
      .set('x-idempotency-key', idempotencyKey)
      .send({ mode: 'PUBLIC', numberOfPlayers: 4 });

    expect(res1.status).toBe(HttpStatus.CREATED);
    expect(res1.body).toEqual(mockGame);
    expect(gamesService.create).toHaveBeenCalledTimes(1);
    expect(redisService.set).toHaveBeenCalled();

    // Second request with same key
    (redisService.get as jest.Mock).mockResolvedValue({
      statusCode: HttpStatus.CREATED,
      body: mockGame,
    });

    const res2 = await request(app.getHttpServer())
      .post('/games')
      .set('x-idempotency-key', idempotencyKey)
      .send({ mode: 'PUBLIC', numberOfPlayers: 4 });

    expect(res2.status).toBe(HttpStatus.CREATED);
    expect(res2.body).toEqual(mockGame);
    // Service should NOT be called again
    expect(gamesService.create).toHaveBeenCalledTimes(1);
  });

  it('should return 400 if x-idempotency-key is missing on idempotent route', async () => {
    const res = await request(app.getHttpServer())
      .post('/games')
      .send({ mode: 'PUBLIC', numberOfPlayers: 4 });

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.message).toBe('X-Idempotency-Key header is required');
  });

  afterAll(async () => {
    await app.close();
  });
});

describe('Games Replay Admin Guards (e2e)', () => {
  let app: INestApplication;
  let auditTrailService: AuditTrailService;

  const mockReplay = {
    id: 'replay-1',
    gameId: 1,
    events: [{ type: 'ROLL', payload: { dice: [1, 2] } }],
  };

  const buildApp = async (adminAllowed: boolean) => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GamesController],
      providers: [
        {
          provide: GamesService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockReplay),
            getReplayAuditLog: jest.fn().mockResolvedValue([mockReplay]),
            exportReplayAuditLog: jest.fn().mockResolvedValue([mockReplay]),
          },
        },
        { provide: GamePlayersService, useValue: {} },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            incrementRateLimit: jest.fn().mockResolvedValue(1),
            del: jest.fn(),
          },
        },
        {
          provide: AuditTrailService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => adminAllowed })
      .compile();

    const nestApp = moduleFixture.createNestApplication();
    auditTrailService = moduleFixture.get<AuditTrailService>(AuditTrailService);
    await nestApp.init();
    return nestApp;
  };

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns 403 for non-admin tokens on replay audit log routes', async () => {
    app = await buildApp(false);

    const res = await request(app.getHttpServer()).get('/games/1/replay/audit-log');

    expect(res.status).toBe(HttpStatus.FORBIDDEN);
  });

  it('returns 403 for non-admin tokens on replay audit log export', async () => {
    app = await buildApp(false);

    const res = await request(app.getHttpServer()).get('/games/1/replay/audit-log/export');

    expect(res.status).toBe(HttpStatus.FORBIDDEN);
  });

  it('allows admin tokens and records an audit trail entry for the export', async () => {
    app = await buildApp(true);

    const res = await request(app.getHttpServer()).get('/games/1/replay/audit-log/export');

    expect(res.status).toBe(HttpStatus.OK);
    expect(auditTrailService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GAMES_REPLAY_AUDIT_EXPORT' }),
    );
  });
});
