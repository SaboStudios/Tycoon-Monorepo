import { ExecutionContext, ConflictException } from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';

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

describe('IdempotencyInterceptor', () => {
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

  describe('non-mutating methods', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'])('%s passes through without idempotency check', async (method) => {
      const ctx = makeCtx(method);
      const handler = makeHandler();
      const obs = await interceptor.intercept(ctx, handler);
      const result = await lastValueFrom(obs);
      expect(result).toEqual({ id: 1 });
      expect(idempotency.get).not.toHaveBeenCalled();
    });
  });

  describe('mutating methods without idempotency-key header', () => {
    it('passes through when no header is present', async () => {
      const ctx = makeCtx('POST');
      const obs = await interceptor.intercept(ctx, makeHandler());
      expect(await lastValueFrom(obs)).toEqual({ id: 1 });
      expect(idempotency.get).not.toHaveBeenCalled();
    });
  });

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
  });

  describe('replay — complete record exists', () => {
    it('returns cached response and sets replay header', async () => {
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
  });

  describe('in-flight — processing record exists', () => {
    it('throws ConflictException', async () => {
      idempotency.get.mockResolvedValue({ status: 'processing', createdAt: Date.now() });
      const ctx = makeCtx('POST', { 'idempotency-key': 'key-abc' });
      await expect(interceptor.intercept(ctx, makeHandler())).rejects.toBeInstanceOf(ConflictException);
    });
  });

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
  });
});
