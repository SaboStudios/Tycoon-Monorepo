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
