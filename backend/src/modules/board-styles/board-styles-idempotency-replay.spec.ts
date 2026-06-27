import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ExecutionContext,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import request from 'supertest';
import { BoardStylesController } from './board-styles.controller';
import { BoardStylesService } from './board-styles.service';
import { BoardStyle } from './entities/board-style.entity';
import { PaginationService } from '../../common';
import { RedisService } from '../redis/redis.service';
import { IdempotencyInterceptor } from '../redis/idempotency.interceptor';
import { IdempotencyService } from '../redis/idempotency.service';

describe('BoardStyles idempotency and replay (#878)', () => {
  let app: INestApplication;
  let idempotencyStore: Map<
    string,
    { status: 'processing' | 'complete'; response?: unknown; createdAt: number }
  >;
  let saveCallCount: number;
  let savedStyles: BoardStyle[];

  const makeStyle = (overrides: Partial<BoardStyle> = {}): BoardStyle =>
    ({
      id: 1,
      name: 'Cyberpunk Theme',
      description: null,
      is_premium: false,
      price: 0,
      preview_image: null,
      config: null,
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    }) as BoardStyle;

  const mockIdempotencyService = {
    get: jest.fn(async (key: string) => idempotencyStore.get(key)),
    markProcessing: jest.fn(async (key: string) => {
      idempotencyStore.set(key, {
        status: 'processing',
        createdAt: Date.now(),
      });
    }),
    markComplete: jest.fn(async (key: string, response: unknown) => {
      idempotencyStore.set(key, {
        status: 'complete',
        response,
        createdAt: Date.now(),
      });
    }),
    delete: jest.fn(async (key: string) => {
      idempotencyStore.delete(key);
    }),
  };

  const mockBoardStyleRepository = {
    create: jest.fn((dto: Partial<BoardStyle>) => ({
      id: savedStyles.length + 1,
      ...dto,
    })),
    save: jest.fn(async (style: BoardStyle) => {
      saveCallCount += 1;
      const saved = { ...style, id: saveCallCount };
      savedStyles.push(saved);
      return saved;
    }),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    idempotencyStore = new Map();
    saveCallCount = 0;
    savedStyles = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoardStylesController],
      providers: [
        BoardStylesService,
        IdempotencyInterceptor,
        { provide: IdempotencyService, useValue: mockIdempotencyService },
        {
          provide: getRepositoryToken(BoardStyle),
          useValue: mockBoardStyleRepository,
        },
        {
          provide: PaginationService,
          useValue: { paginate: jest.fn() },
        },
        {
          provide: RedisService,
          useValue: { delByPattern: jest.fn() },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const validPayload = { name: 'Cyberpunk Theme' };

  it('returns identical responses for duplicate POSTs with the same X-Idempotency-Key and creates one record', async () => {
    const first = await request(app.getHttpServer())
      .post('/board-styles')
      .set('X-Idempotency-Key', 'board-style-key-1')
      .send(validPayload)
      .expect(HttpStatus.CREATED);

    const second = await request(app.getHttpServer())
      .post('/board-styles')
      .set('X-Idempotency-Key', 'board-style-key-1')
      .send(validPayload)
      .expect(HttpStatus.CREATED);

    expect(second.body).toEqual(first.body);
    expect(saveCallCount).toBe(1);
    expect(savedStyles).toHaveLength(1);
  });

  it('test_post_without_idempotency_key_creates_duplicate', async () => {
    await request(app.getHttpServer())
      .post('/board-styles')
      .send(validPayload)
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .post('/board-styles')
      .send(validPayload)
      .expect(HttpStatus.CREATED);

    expect(saveCallCount).toBe(2);
    expect(savedStyles).toHaveLength(2);
  });

  it('processes the same key again after the idempotency window expires', async () => {
    const interceptor = app.get(IdempotencyInterceptor);
    const idempotency = app.get(
      IdempotencyService,
    ) as jest.Mocked<IdempotencyService>;

    idempotency.get.mockImplementation(async (key: string) => {
      const record = idempotencyStore.get(key);
      if (!record) {
        return undefined;
      }
      if (Date.now() - record.createdAt > 50) {
        return undefined;
      }
      return record;
    });

    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          headers: { 'x-idempotency-key': 'stale-key' },
        }),
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
    } as unknown as ExecutionContext;

    const handler = {
      handle: () => of(makeStyle({ id: 1, name: 'First' })),
    };

    await lastValueFrom(await interceptor.intercept(ctx, handler));
    await new Promise((r) => setTimeout(r, 60));
    await lastValueFrom(await interceptor.intercept(ctx, handler));

    expect(idempotency.markProcessing).toHaveBeenCalledTimes(2);
    expect(idempotency.markComplete).toHaveBeenCalledTimes(2);
  });
});
