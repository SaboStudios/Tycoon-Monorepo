import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { RequestLoggerInterceptor } from './request-logger.interceptor';
import { StructuredLoggerService } from '../logger/structured-logger.service';

describe('RequestLoggerInterceptor', () => {
  let logger: StructuredLoggerService;
  let interceptor: RequestLoggerInterceptor;

  const createContext = (method: string, path: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method, originalUrl: path, url: path }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext);

  beforeEach(() => {
    logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as unknown as StructuredLoggerService;
    interceptor = new RequestLoggerInterceptor(logger);
  });

  it('logs method, path and response status for a successful handler', (done) => {
    const context = createContext('GET', '/products');
    const next: CallHandler = { handle: () => of({ ok: true }) };

    interceptor.intercept(context, next).subscribe({
      complete: () => {
        expect(logger.log).toHaveBeenCalled();
        const [message, meta] = (logger.log as jest.Mock).mock.calls[0];
        expect(message).toEqual(expect.any(String));
        expect(meta).toEqual(
          expect.objectContaining({
            method: 'GET',
            path: '/products',
            statusCode: 200,
          }),
        );
        done();
      },
    });
  });

  it('propagates errors thrown by the handler', (done) => {
    const context = createContext('POST', '/orders');
    const error = new Error('boom');
    const next: CallHandler = { handle: () => throwError(() => error) };

    interceptor.intercept(context, next).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        done();
      },
    });
  });
});
