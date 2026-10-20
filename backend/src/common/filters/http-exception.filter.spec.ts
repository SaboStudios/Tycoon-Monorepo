import {
  ArgumentsHost,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { LoggerService } from '../logger/logger.service';

describe('HttpExceptionFilter', () => {
  const logger = {
    error: jest.fn(),
    warn: jest.fn(),
    logWithMeta: jest.fn(),
  } as unknown as LoggerService;
  const filter = new HttpExceptionFilter(logger);

  function run(exception: unknown, url = '/x') {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ method: 'GET', url, headers: {} }),
      }),
    } as unknown as ArgumentsHost;
    filter.catch(exception, host);
    return res;
  }

  it('keeps the standard shape without a code when none is thrown', () => {
    const res = run(new NotFoundException('Game not found'));
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Game not found',
      data: null,
      statusCode: 404,
    });
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('passes through a stable code and sets Retry-After', () => {
    const res = run(
      new HttpException(
        { message: 'slow down', code: 'RATE_LIMITED', retryAfterSeconds: 41.2 },
        429,
      ),
    );
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'slow down',
      data: null,
      statusCode: 429,
      code: 'RATE_LIMITED',
    });
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });

  it('redacts secrets from the URL in the 4xx warn log', () => {
    run(
      new NotFoundException('not found'),
      '/auth/callback?token=secret&email=user@example.com',
    );
    const [warnMessage] = logger.warn.mock.calls[logger.warn.mock.calls.length - 1];
    expect(warnMessage).not.toContain('secret');
    expect(warnMessage).not.toContain('user@example.com');

    const [, meta] =
      logger.logWithMeta.mock.calls[logger.logWithMeta.mock.calls.length - 1];
    expect(JSON.stringify(meta)).not.toContain('secret');
    expect(JSON.stringify(meta)).not.toContain('user@example.com');
  });

  it('redacts secrets from the URL in the 5xx error log', () => {
    run(
      new Error('boom'),
      '/internal?token=secret&email=user@example.com',
    );
    const [errorMessage] = logger.error.mock.calls[logger.error.mock.calls.length - 1];
    expect(errorMessage).not.toContain('secret');
    expect(errorMessage).not.toContain('user@example.com');
  });
});
