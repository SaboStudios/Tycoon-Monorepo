import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { RequestLoggerInterceptor, CORRELATION_ID_HEADER } from './request-logger.interceptor';
import { LoggerService } from '../logger/logger.service';

const mockLogger = {
  http: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

function buildContext(path: string, existingCorrelationId?: string): ExecutionContext {
  const req = {
    path,
    method: 'GET',
    headers: existingCorrelationId
      ? { [CORRELATION_ID_HEADER]: existingCorrelationId }
      : {},
  };
  const res = {
    statusCode: 200,
    setHeader: jest.fn(),
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

describe('RequestLoggerInterceptor', () => {
  let interceptor: RequestLoggerInterceptor;

  beforeEach(() => {
    interceptor = new RequestLoggerInterceptor(mockLogger as unknown as LoggerService);
    jest.clearAllMocks();
  });

  it('skips /metrics path without logging', (done) => {
    const ctx = buildContext('/metrics');
    const handler: CallHandler = { handle: () => of(null) };

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(mockLogger.http).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('skips /health paths without logging', (done) => {
    const ctx = buildContext('/health/ready');
    const handler: CallHandler = { handle: () => of(null) };

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(mockLogger.http).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('logs http on successful request', (done) => {
    const ctx = buildContext('/api/v1/shop');
    const handler: CallHandler = { handle: () => of({ data: 'ok' }) };

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(mockLogger.http).toHaveBeenCalledWith(
          'HTTP request completed',
          expect.objectContaining({
            method: 'GET',
            path: '/api/v1/shop',
            statusCode: 200,
          }),
        );
        done();
      },
    });
  });

  it('logs http on errored request', (done) => {
    const ctx = buildContext('/api/v1/shop');
    const handler: CallHandler = { handle: () => throwError(() => new Error('boom')) };

    interceptor.intercept(ctx, handler).subscribe({
      error: () => {
        expect(mockLogger.http).toHaveBeenCalledWith(
          'HTTP request errored',
          expect.objectContaining({ error: 'boom' }),
        );
        done();
      },
    });
  });

  it('reuses an existing correlation ID from the request header', (done) => {
    const existingId = 'test-correlation-id-123';
    const ctx = buildContext('/api/v1/users', existingId);
    const handler: CallHandler = { handle: () => of(null) };

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        expect(mockLogger.http).toHaveBeenCalledWith(
          'HTTP request completed',
          expect.objectContaining({ correlationId: existingId }),
        );
        done();
      },
    });
  });

  it('generates a new correlation ID when none is provided', (done) => {
    const ctx = buildContext('/api/v1/users');
    const handler: CallHandler = { handle: () => of(null) };

    interceptor.intercept(ctx, handler).subscribe({
      complete: () => {
        const call = mockLogger.http.mock.calls[0] as [string, Record<string, unknown>];
        expect(typeof call[1].correlationId).toBe('string');
        expect((call[1].correlationId as string).length).toBeGreaterThan(0);
        done();
      },
    });
  });
});
