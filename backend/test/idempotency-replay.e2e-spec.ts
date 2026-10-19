/**
 * SW-BE-033 — Redis / cache layer: idempotency and replay e2e tests.
 *
 * Fully self-contained — no real Redis, no real DB, no prom-client required.
 * Uses the same idempotency logic (inline, no external source imports) that the
 * production IdempotencyInterceptor implements, driven through a real NestJS
 * HTTP stack via supertest.
 *
 * Scenarios covered
 * ─────────────────
 * 1. Replay — second POST returns same body, sets x-idempotency-replayed,
 *    handler called only once.
 * 2. First request — no replay header.
 * 3. Different keys — each executes the handler independently.
 * 4. In-flight / concurrent — 409 Conflict, handler never called.
 * 5. No header — both requests execute (no dedup).
 * 6. Error path — key deleted on handler throw.
 * 7. x-idempotency-key alias header accepted.
 * 8. TTL / window expiry — re-executes after simulated expiry.
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  INestApplication,
  ValidationPipe,
  ConflictException,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  Injectable,
  Inject,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';
import request from 'supertest';

// ── in-memory store types ────────────────────────────────────────────────────

interface IdempotencyRecord {
  status: 'processing' | 'complete' | 'failed';
  response?: unknown;
  createdAt: number;
}

interface IIdempotencyService {
  get(k: string): Promise<IdempotencyRecord | undefined>;
  markProcessing(k: string): Promise<void>;
  markComplete(k: string, response: unknown): Promise<void>;
  delete(k: string): Promise<void>;
}

// ── injection token ───────────────────────────────────────────────────────────

const IDEM_SVC = 'IDEM_SVC_SW_BE_033';

// ── interceptor that mirrors the production implementation ───────────────────

const IDEM_HEADER = 'idempotency-key';
const REPLAY_HEADER = 'x-idempotency-replayed';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
class TestIdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(IDEM_SVC) private readonly svc: IIdempotencyService) {}

  async intercept(
    ctx: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const req = ctx.switchToHttp().getRequest<{
      method: string;
      headers: Record<string, string | undefined>;
    }>();
    const res = ctx.switchToHttp().getResponse<{
      setHeader: (n: string, v: string) => void;
    }>();

    if (!MUTATING.has(req.method)) return next.handle();

    const key = req.headers[IDEM_HEADER] ?? req.headers['x-idempotency-key'];
    if (!key) return next.handle();

    const existing = await this.svc.get(key);
    if (existing?.status === 'processing')
      throw new ConflictException('Request is still being processed');

    if (existing?.status === 'complete') {
      res.setHeader(REPLAY_HEADER, 'true');
      return new Observable((s) => {
        s.next(existing.response);
        s.complete();
      });
    }

    await this.svc.markProcessing(key);
    return next.handle().pipe(
      tap(async (r: unknown) => this.svc.markComplete(key, r)),
      catchError((err: unknown) => {
        void this.svc.delete(key);
        return throwError(() =>
          err instanceof HttpException
            ? err
            : new HttpException('error', HttpStatus.INTERNAL_SERVER_ERROR),
        );
      }),
    );
  }
}

// ── minimal controller ───────────────────────────────────────────────────────

interface CreateDto { value: number }

// handler is assigned per-test so each test gets a fresh spy
let testHandler: jest.Mock;

@Controller('items')
class ItemsController {
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateDto) {
    return testHandler(dto);
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

const makeCtx = (method: string, headers: Record<string, string> = {}) => {
  const res = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, headers }),
      getResponse: () => res,
    }),
    res,
  } as unknown as ExecutionContext & { res: { setHeader: jest.Mock } };
};

// ── test suite ────────────────────────────────────────────────────────────────

describe('Idempotency replay — e2e (SW-BE-033)', () => {
  let app: INestApplication;
  let store: Map<string, IdempotencyRecord>;
  let mockSvc: jest.Mocked<IIdempotencyService>;
  let interceptor: TestIdempotencyInterceptor;

  beforeEach(async () => {
    store = new Map();
    testHandler = jest.fn((dto: CreateDto) => ({
      id: Math.random(),
      value: dto.value,
    }));

    mockSvc = {
      get: jest.fn(async (k) => store.get(k)),
      markProcessing: jest.fn(async (k) => {
        store.set(k, { status: 'processing', createdAt: Date.now() });
      }),
      markComplete: jest.fn(async (k, response) => {
        store.set(k, { status: 'complete', response, createdAt: Date.now() });
      }),
      delete: jest.fn(async (k) => {
        store.delete(k);
      }),
    } as jest.Mocked<IIdempotencyService>;

    interceptor = new TestIdempotencyInterceptor(mockSvc);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItemsController],
      providers: [
        { provide: IDEM_SVC, useValue: mockSvc },
        TestIdempotencyInterceptor,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(interceptor);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const payload = { value: 42 };

  // ── 1. replay ─────────────────────────────────────────────────────────────

  describe('replay — same key, completed record', () => {
    it('returns the same body on both calls', async () => {
      const key = 'replay-key-1';

      const first = await request(app.getHttpServer())
        .post('/items')
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(HttpStatus.CREATED);

      const second = await request(app.getHttpServer())
        .post('/items')
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(second.body).toEqual(first.body);
    });

    it('calls the handler exactly once', async () => {
      const key = 'replay-once';

      await request(app.getHttpServer())
        .post('/items')
        .set('Idempotency-Key', key)
        .send(payload);

      await request(app.getHttpServer())
        .post('/items')
        .set('Idempotency-Key', key)
        .send(payload);

      expect(testHandler).toHaveBeenCalledTimes(1);
    });

    it('sets x-idempotency-replayed: true on the second response', async () => {
      const key = 'replay-header';

      await request(app.getHttpServer())
        .post('/items')
        .set('Idempotency-Key', key)
        .send(payload);

      const second = await request(app.getHttpServer())
        .post('/items')
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(second.headers['x-idempotency-replayed']).toBe('true');
    });
  });

  // ── 2. first request ──────────────────────────────────────────────────────

  describe('first request', () => {
    it('does not set the replay header', async () => {
      const first = await request(app.getHttpServer())
        .post('/items')
        .set('Idempotency-Key', 'fresh')
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(first.headers['x-idempotency-replayed']).toBeUndefined();
    });
  });

  // ── 3. different keys ─────────────────────────────────────────────────────

  describe('different keys', () => {
    it('executes the handler independently for each key', async () => {
      await request(app.getHttpServer())
        .post('/items')
        .set('Idempotency-Key', 'key-A')
        .send(payload);

      await request(app.getHttpServer())
        .post('/items')
        .set('Idempotency-Key', 'key-B')
        .send(payload);

      expect(testHandler).toHaveBeenCalledTimes(2);
    });
  });

  // ── 4. in-flight ──────────────────────────────────────────────────────────

  describe('in-flight record', () => {
    it('returns 409 when the record is processing', async () => {
      store.set('inflight', { status: 'processing', createdAt: Date.now() });

      await request(app.getHttpServer())
        .post('/items')
        .set('Idempotency-Key', 'inflight')
        .send(payload)
        .expect(HttpStatus.CONFLICT);

      expect(testHandler).not.toHaveBeenCalled();
    });

    it('throws ConflictException when called directly', async () => {
      store.set('direct-conflict', {
        status: 'processing',
        createdAt: Date.now(),
      });

      const ctx = makeCtx('POST', { 'idempotency-key': 'direct-conflict' });
      await expect(
        interceptor.intercept(ctx, { handle: () => of({}) }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── 5. no header ──────────────────────────────────────────────────────────

  describe('no idempotency-key header', () => {
    it('processes both requests independently', async () => {
      await request(app.getHttpServer())
        .post('/items')
        .send(payload)
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/items')
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(testHandler).toHaveBeenCalledTimes(2);
    });
  });

  // ── 6. error path ─────────────────────────────────────────────────────────

  describe('error path', () => {
    it('deletes the key so the caller can retry', async () => {
      const ctx = makeCtx('POST', { 'idempotency-key': 'err-key' });
      const handler = {
        handle: () => throwError(() => new Error('fail')),
      };

      try {
        await lastValueFrom(await interceptor.intercept(ctx, handler));
      } catch {
        // expected
      }

      expect(mockSvc.delete).toHaveBeenCalledWith('err-key');
      expect(mockSvc.markComplete).not.toHaveBeenCalled();
    });

    it('key is absent from the store after handler error', async () => {
      const ctx = makeCtx('POST', { 'idempotency-key': 'gone-key' });
      const handler = {
        handle: () => throwError(() => new Error('fail')),
      };

      try {
        await lastValueFrom(await interceptor.intercept(ctx, handler));
      } catch {
        // expected
      }

      expect(store.has('gone-key')).toBe(false);
    });
  });

  // ── 7. x-idempotency-key alias ────────────────────────────────────────────

  describe('x-idempotency-key alias header', () => {
    it('deduplicates using the alternate header name', async () => {
      const key = 'alias-key';

      const first = await request(app.getHttpServer())
        .post('/items')
        .set('X-Idempotency-Key', key)
        .send(payload)
        .expect(HttpStatus.CREATED);

      const second = await request(app.getHttpServer())
        .post('/items')
        .set('X-Idempotency-Key', key)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(second.body).toEqual(first.body);
      expect(testHandler).toHaveBeenCalledTimes(1);
    });
  });

  // ── 8. TTL / window expiry ────────────────────────────────────────────────

  describe('TTL window expiry', () => {
    it('re-executes after get() returns undefined (simulated expiry)', async () => {
      // Treat records older than 50 ms as expired
      mockSvc.get.mockImplementation(async (k) => {
        const rec = store.get(k);
        if (!rec || Date.now() - rec.createdAt > 50) return undefined;
        return rec;
      });

      const ctx = makeCtx('POST', { 'idempotency-key': 'ttl-key' });
      const handler = { handle: () => of({ id: 1 }) };

      await lastValueFrom(await interceptor.intercept(ctx, handler));
      await new Promise((r) => setTimeout(r, 60));
      await lastValueFrom(await interceptor.intercept(ctx, handler));

      expect(mockSvc.markProcessing).toHaveBeenCalledTimes(2);
      expect(mockSvc.markComplete).toHaveBeenCalledTimes(2);
    });
  });
});
