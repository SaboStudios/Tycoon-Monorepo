import { ExecutionContext, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';

// ── helpers ──────────────────────────────────────────────────────────────────

const makeCtx = (method: string, headers: Record<string, string> = {}) => {
  const res = { setHeader: jest.fn() };
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, headers }),
      getResponse: () => res,
    }),
    res,
  } as unknown as ExecutionContext & { res: typeof res };
};

const makeHandler = (value: unknown = { id: 1 }) => ({
  handle: () => of(value),
});

// ── suite ─────────────────────────────────────────────────────────────────────

describe('IdempotencyInterceptor (redis module)', () => {
  let interceptor: IdempotencyInterceptor;
  let idempotency: jest.Mocked<IdempotencyService>;

  beforeEach(() => {
    idempotency = {
      get: jest.fn(),
      markProcessing: jest.fn().mockResolvedValue(undefined),
      markComplete: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IdempotencyService>;
    interceptor = new IdempotencyInterceptor(idempotency);
  });

  // ── non-mutating methods ──────────────────────────────────────────────────

  describe('non-mutating methods', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'])('%s passes through without idempotency check', async (method) => {
      const ctx = makeCtx(method);
      const obs = await interceptor.intercept(ctx, makeHandler());
      expect(await lastValueFrom(obs)).toEqual({ id: 1 });
      expect(idempotency.get).not.toHaveBeenCalled();
    });
  });

  // ── no header ─────────────────────────────────────────────────────────────

  describe('mutating methods without idempotency-key header', () => {
    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
      '%s passes through when no header is present',
      async (method) => {
        const ctx = makeCtx(method);
        const obs = await interceptor.intercept(ctx, makeHandler());
        expect(await lastValueFrom(obs)).toEqual({ id: 1 });
        expect(idempotency.get).not.toHaveBeenCalled();
      },
    );
  });

  // ── first request ─────────────────────────────────────────────────────────

  describe('first request (no existing record)', () => {
    it('marks processing, executes handler, marks complete', async () => {
      idempotency.get.mockResolvedValue(undefined);
      const ctx = makeCtx('POST', { 'idempotency-key': 'key-abc' });
      const obs = await interceptor.intercept(ctx, makeHandler({ created: true }));
      const result = await lastValueFrom(obs);

      expect(result).toEqual({ created: true });
      expect(idempotency.markProcessing).toHaveBeenCalledWith('key-abc');
      expect(idempotency.markComplete).toHaveBeenCalledWith('key-abc', { created: true });
    });

    it('does not set the replay header on a fresh request', async () => {
      idempotency.get.mockResolvedValue(undefined);
      const ctx = makeCtx('POST', { 'idempotency-key': 'fresh' });
      await interceptor.intercept(ctx, makeHandler());
      expect(ctx.res.setHeader).not.toHaveBeenCalled();
    });
  });

  // ── replay — complete record ──────────────────────────────────────────────

  describe('replay — complete record exists', () => {
    it('returns cached response and sets x-idempotency-replayed header', async () => {
      idempotency.get.mockResolvedValue({
        status: 'complete',
        response: { id: 99 },
        createdAt: Date.now(),
      });
      const ctx = makeCtx('POST', { 'idempotency-key': 'key-abc' });
      const obs = await interceptor.intercept(ctx, makeHandler());
      const result = await lastValueFrom(obs);

      expect(result).toEqual({ id: 99 });
      expect(ctx.res.setHeader).toHaveBeenCalledWith('x-idempotency-replayed', 'true');
      expect(idempotency.markProcessing).not.toHaveBeenCalled();
    });

    it('does not call the handler on replay', async () => {
      idempotency.get.mockResolvedValue({
        status: 'complete',
        response: { replayed: true },
        createdAt: Date.now(),
      });
      const handler = { handle: jest.fn().mockReturnValue(of({})) };
      const ctx = makeCtx('PUT', { 'idempotency-key': 'key-xyz' });
      await interceptor.intercept(ctx, handler);
      expect(handler.handle).not.toHaveBeenCalled();
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s replays correctly', async (method) => {
      idempotency.get.mockResolvedValue({
        status: 'complete',
        response: { method },
        createdAt: Date.now(),
      });
      const ctx = makeCtx(method, { 'idempotency-key': 'k' });
      const obs = await interceptor.intercept(ctx, makeHandler());
      expect(await lastValueFrom(obs)).toEqual({ method });
    });

    it('replays a null response correctly', async () => {
      idempotency.get.mockResolvedValue({
        status: 'complete',
        response: null,
        createdAt: Date.now(),
      });
      const ctx = makeCtx('DELETE', { 'idempotency-key': 'del-key' });
      const obs = await interceptor.intercept(ctx, makeHandler({ should: 'not appear' }));
      expect(await lastValueFrom(obs)).toBeNull();
    });

    it('replays an array response correctly', async () => {
      idempotency.get.mockResolvedValue({
        status: 'complete',
        response: [1, 2, 3],
        createdAt: Date.now(),
      });
      const ctx = makeCtx('POST', { 'idempotency-key': 'arr-key' });
      const obs = await interceptor.intercept(ctx, makeHandler());
      expect(await lastValueFrom(obs)).toEqual([1, 2, 3]);
    });

    it('does not call markComplete on replay', async () => {
      idempotency.get.mockResolvedValue({
        status: 'complete',
        response: {},
        createdAt: Date.now(),
      });
      const ctx = makeCtx('POST', { 'idempotency-key': 'replay-key' });
      await interceptor.intercept(ctx, makeHandler());
      expect(idempotency.markComplete).not.toHaveBeenCalled();
    });
  });

  // ── in-flight ─────────────────────────────────────────────────────────────

  describe('in-flight — processing record exists', () => {
    it('throws ConflictException', async () => {
      idempotency.get.mockResolvedValue({ status: 'processing', createdAt: Date.now() });
      const ctx = makeCtx('POST', { 'idempotency-key': 'key-abc' });
      await expect(interceptor.intercept(ctx, makeHandler())).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not call markProcessing when already processing', async () => {
      idempotency.get.mockResolvedValue({ status: 'processing', createdAt: Date.now() });
      const ctx = makeCtx('POST', { 'idempotency-key': 'key-abc' });
      try {
        await interceptor.intercept(ctx, makeHandler());
      } catch {
        // expected
      }
      expect(idempotency.markProcessing).not.toHaveBeenCalled();
    });
  });

  // ── error path ────────────────────────────────────────────────────────────

  describe('error path', () => {
    it('deletes the key when the handler throws', async () => {
      idempotency.get.mockResolvedValue(undefined);
      const ctx = makeCtx('POST', { 'idempotency-key': 'key-err' });
      const handler = { handle: () => throwError(() => new Error('boom')) };

      try {
        const obs = await interceptor.intercept(ctx, handler as any);
        await lastValueFrom(obs);
      } catch {
        // expected
      }

      expect(idempotency.delete).toHaveBeenCalledWith('key-err');
    });

    it('does not call markComplete when the handler throws', async () => {
      idempotency.get.mockResolvedValue(undefined);
      const ctx = makeCtx('POST', { 'idempotency-key': 'key-err' });
      const handler = { handle: () => throwError(() => new Error('fail')) };

      try {
        const obs = await interceptor.intercept(ctx, handler as any);
        await lastValueFrom(obs);
      } catch {
        // expected
      }

      expect(idempotency.markComplete).not.toHaveBeenCalled();
    });

    it('re-throws HttpException as-is', async () => {
      idempotency.get.mockResolvedValue(undefined);
      const ctx = makeCtx('POST', { 'idempotency-key': 'key-http' });
      const httpErr = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      const handler = { handle: () => throwError(() => httpErr) };

      try {
        const obs = await interceptor.intercept(ctx, handler as any);
        await lastValueFrom(obs);
      } catch (err) {
        expect(err).toBe(httpErr);
      }
    });
  });
});
