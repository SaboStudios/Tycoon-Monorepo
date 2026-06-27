import { HttpLoggerMiddleware } from './http-logger.middleware';
import { LoggerService } from '../logger/logger.service';
import { Request, Response } from 'express';
import { EventEmitter } from 'events';

const mockLogger = {
  http: jest.fn(),
  logWithMeta: jest.fn(),
};

describe('HttpLoggerMiddleware', () => {
  let middleware: HttpLoggerMiddleware;

  beforeEach(() => {
    middleware = new HttpLoggerMiddleware(
      mockLogger as unknown as LoggerService,
    );
    jest.clearAllMocks();
  });

  it('skips excluded health paths', () => {
    const req = {
      path: '/health/live',
      method: 'GET',
      originalUrl: '/health/live',
      ip: '127.0.0.1',
      headers: {},
    } as Request;
    const res = new EventEmitter() as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockLogger.http).not.toHaveBeenCalled();
  });

  it('logs non-excluded API paths', () => {
    const req = {
      path: '/api/notifications',
      method: 'GET',
      originalUrl: '/api/notifications',
      ip: '127.0.0.1',
      headers: {},
    } as Request;
    const res = new EventEmitter() as Response;
    const next = jest.fn();

    middleware.use(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockLogger.http).toHaveBeenCalled();
  });
});
