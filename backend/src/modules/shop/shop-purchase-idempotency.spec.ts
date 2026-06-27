/**
 * SW-BE-033: Shop purchase idempotency — replay and concurrent-key tests.
 *
 * Uses an in-memory idempotency store (no real Redis) via a mocked
 * IdempotencyService, following the board-styles-idempotency-replay.spec.ts
 * pattern already established in the codebase.
 */
import {
  ConflictException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import request from 'supertest';

import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { PurchaseService } from './purchase.service';
import { InventoryService } from './inventory.service';
import { ShopItem } from './entities/shop-item.entity';
import { Purchase } from './entities/purchase.entity';
import { UserInventory } from './entities/user-inventory.entity';
import { IdempotencyInterceptor } from '../redis/idempotency.interceptor';
import { IdempotencyService, IdempotencyRecord } from '../redis/idempotency.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditTrailInterceptor } from '../audit-trail/audit-trail.interceptor';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { RedisService } from '../redis/redis.service';

// ── helpers ──────────────────────────────────────────────────────────────────

const makePurchase = (overrides: Partial<Purchase> = {}): Purchase =>
  ({
    id: 1,
    idempotency_key: null,
    user_id: 42,
    shop_item_id: 7,
    quantity: 1,
    unit_price: '9.99',
    total_price: '9.99',
    original_price: '9.99',
    discount_amount: '0.00',
    final_price: '9.99',
    coupon_id: null,
    coupon_code: null,
    currency: 'USD',
    payment_method: 'balance',
    transaction_id: null,
    status: 'completed',
    is_gift: false,
    gift_id: null,
    metadata: {},
    created_at: new Date('2024-01-01'),
    ...overrides,
  }) as Purchase;

/** Build a minimal ExecutionContext pointing at POST /shop/purchase */
const makePurchaseCtx = (headers: Record<string, string> = {}) => {
  const res = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', headers }),
      getResponse: () => res,
    }),
    res,
  } as unknown as ExecutionContext & { res: { setHeader: jest.Mock } };
};

// ── suite ─────────────────────────────────────────────────────────────────────

describe('Shop purchase — idempotency replay and concurrent-key (SW-BE-033)', () => {
  let app: INestApplication;
  let idempotencyStore: Map<string, IdempotencyRecord>;
  let purchaseCallCount: number;

  const mockIdempotencyService: jest.Mocked<IdempotencyService> = {
    get: jest.fn(async (key) => idempotencyStore.get(key)),
    markProcessing: jest.fn(async (key) => {
      idempotencyStore.set(key, { status: 'processing', createdAt: Date.now() });
    }),
    markComplete: jest.fn(async (key, response) => {
      idempotencyStore.set(key, {
        status: 'complete',
        response,
        createdAt: Date.now(),
      });
    }),
    markFailed: jest.fn(async (key) => {
      idempotencyStore.set(key, { status: 'failed', createdAt: Date.now() });
    }),
    delete: jest.fn(async (key) => {
      idempotencyStore.delete(key);
    }),
  } as unknown as jest.Mocked<IdempotencyService>;

  const mockPurchaseService = {
    createPurchase: jest.fn(async () => {
      purchaseCallCount += 1;
      return makePurchase({ id: purchaseCallCount });
    }),
    getUserPurchases: jest.fn().mockResolvedValue([]),
    getPurchaseById: jest.fn(),
    calculatePurchasePrice: jest.fn(),
    validatePurchaseEligibility: jest.fn(),
  };

  const mockShopService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    purchaseAndGift: jest.fn(),
    getPurchaseHistory: jest.fn(),
  };

  beforeEach(async () => {
    idempotencyStore = new Map();
    purchaseCallCount = 0;
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShopController],
      providers: [
        { provide: ShopService, useValue: mockShopService },
        { provide: PurchaseService, useValue: mockPurchaseService },
        { provide: InventoryService, useValue: {} },
        { provide: IdempotencyService, useValue: mockIdempotencyService },
        IdempotencyInterceptor,
        {
          provide: AuditTrailService,
          useValue: { createLog: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: RedisService, useValue: { delByPattern: jest.fn() } },
        {
          provide: getRepositoryToken(ShopItem),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Purchase),
          useValue: {},
        },
        {
          provide: getRepositoryToken(UserInventory),
          useValue: {},
        },
      ],
    })
      // Skip JWT so tests can hit the endpoint without a real token
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      // Skip audit-trail interceptor side-effects
      .overrideInterceptor(AuditTrailInterceptor)
      .useValue({ intercept: (_: unknown, next: { handle: () => unknown }) => next.handle() })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const validPayload = { shop_item_id: 7, quantity: 1 };

  // ── replay ──────────────────────────────────────────────────────────────────

  describe('replay (same idempotency key, completed request)', () => {
    it('returns identical response on second POST and calls createPurchase only once', async () => {
      const key = 'purchase-key-1';

      const first = await request(app.getHttpServer())
        .post('/shop/purchase')
        .set('Idempotency-Key', key)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      const second = await request(app.getHttpServer())
        .post('/shop/purchase')
        .set('Idempotency-Key', key)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      expect(second.body).toEqual(first.body);
      expect(purchaseCallCount).toBe(1);
    });

    it('sets x-idempotency-replayed header on the second request', async () => {
      const key = 'purchase-key-replay-header';

      await request(app.getHttpServer())
        .post('/shop/purchase')
        .set('Idempotency-Key', key)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      const second = await request(app.getHttpServer())
        .post('/shop/purchase')
        .set('Idempotency-Key', key)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      expect(second.headers['x-idempotency-replayed']).toBe('true');
    });

    it('first request does NOT set the replayed header', async () => {
      const key = 'purchase-key-no-replay';

      const first = await request(app.getHttpServer())
        .post('/shop/purchase')
        .set('Idempotency-Key', key)
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      expect(first.headers['x-idempotency-replayed']).toBeUndefined();
    });

    it('different keys create independent purchases', async () => {
      await request(app.getHttpServer())
        .post('/shop/purchase')
        .set('Idempotency-Key', 'key-A')
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/shop/purchase')
        .set('Idempotency-Key', 'key-B')
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      expect(purchaseCallCount).toBe(2);
    });
  });

  // ── concurrent / in-flight ──────────────────────────────────────────────────

  describe('concurrent key — processing record exists', () => {
    it('returns 409 when the same key is already in-flight', async () => {
      // Seed the store as in-flight before the HTTP request
      idempotencyStore.set('inflight-key', {
        status: 'processing',
        createdAt: Date.now(),
      });

      await request(app.getHttpServer())
        .post('/shop/purchase')
        .set('Idempotency-Key', 'inflight-key')
        .send(validPayload)
        .expect(HttpStatus.CONFLICT);

      // Underlying service was never called
      expect(purchaseCallCount).toBe(0);
    });

    it('interceptor-level concurrent check via ExecutionContext mock', async () => {
      const interceptor = app.get(IdempotencyInterceptor);

      // Pre-seed as processing
      idempotencyStore.set('concurrent-key', {
        status: 'processing',
        createdAt: Date.now(),
      });

      const ctx = makePurchaseCtx({ 'idempotency-key': 'concurrent-key' });
      const handler = { handle: () => of({ id: 1 }) };

      await expect(
        interceptor.intercept(ctx, handler),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── no header ────────────────────────────────────────────────────────────────

  describe('without idempotency-key header', () => {
    it('processes the same payload twice, creating two records', async () => {
      await request(app.getHttpServer())
        .post('/shop/purchase')
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/shop/purchase')
        .send(validPayload)
        .expect(HttpStatus.CREATED);

      expect(purchaseCallCount).toBe(2);
    });
  });

  // ── key expiry / window re-use ────────────────────────────────────────────

  describe('idempotency window expiry', () => {
    it('re-processes a key after the window lapses (TTL simulation via get mock)', async () => {
      const interceptor = app.get(IdempotencyInterceptor);
      const svc = app.get(IdempotencyService) as jest.Mocked<IdempotencyService>;

      // Simulate TTL: return undefined if record is older than 50 ms
      svc.get.mockImplementation(async (key) => {
        const rec = idempotencyStore.get(key);
        if (!rec || Date.now() - rec.createdAt > 50) return undefined;
        return rec;
      });

      const ctx = makePurchaseCtx({ 'idempotency-key': 'stale-key' });
      const handler = { handle: () => of(makePurchase()) };

      await lastValueFrom(await interceptor.intercept(ctx, handler));
      await new Promise((r) => setTimeout(r, 60));
      await lastValueFrom(await interceptor.intercept(ctx, handler));

      expect(svc.markProcessing).toHaveBeenCalledTimes(2);
      expect(svc.markComplete).toHaveBeenCalledTimes(2);
    });
  });

  // ── error path clears key ─────────────────────────────────────────────────

  describe('error path — key is deleted on handler failure', () => {
    it('deletes the key when createPurchase throws, allowing retry', async () => {
      const interceptor = app.get(IdempotencyInterceptor);
      const svc = app.get(IdempotencyService) as jest.Mocked<IdempotencyService>;

      svc.get.mockResolvedValue(undefined);

      const ctx = makePurchaseCtx({ 'idempotency-key': 'err-key' });
      const handler = {
        handle: () => throwError(() => new Error('payment failed')),
      };

      try {
        const obs = await interceptor.intercept(ctx, handler);
        await lastValueFrom(obs);
      } catch {
        // expected
      }

      expect(svc.delete).toHaveBeenCalledWith('err-key');
      expect(svc.markComplete).not.toHaveBeenCalled();
    });
  });
});
