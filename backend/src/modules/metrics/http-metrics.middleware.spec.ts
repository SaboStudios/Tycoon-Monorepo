/**
 * SW-BE-028 — HttpMetricsMiddleware: DTO validation and error mapping tests.
 */
import { HttpMetricsMiddleware } from './http-metrics.middleware';
import { HttpMetricsService } from './http-metrics.service';
import { Request, Response } from 'express';
import { EventEmitter } from 'events';

const mockHttpMetricsService = {
  recordRequest: jest.fn(),
};

function buildReq(path: string, method = 'GET'): Request {
  return { path, method } as unknown as Request;
}

function buildRes(): Response & EventEmitter {
  const emitter = new EventEmitter();
  return emitter as unknown as Response & EventEmitter;
}

describe('HttpMetricsMiddleware', () => {
  let middleware: HttpMetricsMiddleware;

  beforeEach(() => {
    middleware = new HttpMetricsMiddleware(
      mockHttpMetricsService as unknown as HttpMetricsService,
    );
    jest.clearAllMocks();
  });

  it('is defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('skip logic', () => {
    it('skips /metrics path and calls next immediately', () => {
      const req = buildReq('/metrics');
      const res = buildRes();
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(mockHttpMetricsService.recordRequest).not.toHaveBeenCalled();
    });

    it('does not skip /api/v1/shop (non-metrics path)', () => {
      const req = buildReq('/api/v1/shop');
      const res = buildRes();
      const next = jest.fn();

      middleware.use(req, res, next);
      res.emit('finish');

      expect(mockHttpMetricsService.recordRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('request recording', () => {
    it('calls recordRequest on response finish with correct method and path', () => {
      const req = buildReq('/api/v1/users', 'POST');
      const res = buildRes();
      Object.defineProperty(res, 'statusCode', { value: 201, writable: true });
      const next = jest.fn();

      middleware.use(req, res, next);
      res.emit('finish');

      expect(mockHttpMetricsService.recordRequest).toHaveBeenCalledWith(
        'POST',
        '/api/v1/users',
        201,
        expect.any(Number),
      );
    });

    it('passes a non-negative duration to recordRequest', () => {
      const req = buildReq('/api/v1/games');
      const res = buildRes();
      Object.defineProperty(res, 'statusCode', { value: 200, writable: true });
      const next = jest.fn();

      middleware.use(req, res, next);
      res.emit('finish');

      const duration = (mockHttpMetricsService.recordRequest.mock.calls[0] as unknown[])[3] as number;
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('records 4xx status codes correctly', () => {
      const req = buildReq('/api/v1/missing');
      const res = buildRes();
      Object.defineProperty(res, 'statusCode', { value: 404, writable: true });
      const next = jest.fn();

      middleware.use(req, res, next);
      res.emit('finish');

      expect(mockHttpMetricsService.recordRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/missing',
        404,
        expect.any(Number),
      );
    });

    it('records 5xx status codes correctly', () => {
      const req = buildReq('/api/v1/crash');
      const res = buildRes();
      Object.defineProperty(res, 'statusCode', { value: 500, writable: true });
      const next = jest.fn();

      middleware.use(req, res, next);
      res.emit('finish');

      expect(mockHttpMetricsService.recordRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/crash',
        500,
        expect.any(Number),
      );
    });

    it('always calls next()', () => {
      const req = buildReq('/api/v1/shop');
      const res = buildRes();
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('does not record until finish event fires', () => {
      const req = buildReq('/api/v1/shop');
      const res = buildRes();
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(mockHttpMetricsService.recordRequest).not.toHaveBeenCalled();

      res.emit('finish');
      expect(mockHttpMetricsService.recordRequest).toHaveBeenCalledTimes(1);
    });
  });
});
