import {
  CorrelationIdMiddleware,
  CORRELATION_ID_HEADER,
} from './correlation-id.middleware';
import { LoggerService } from '../logger/logger.service';
import { Request, Response } from 'express';
import { EventEmitter } from 'events';

const mockLogger = { http: jest.fn() };

function buildReq(headers: Record<string, string> = {}): Request {
  return {
    headers,
    method: 'GET',
    path: '/api/v1/test',
  } as unknown as Request;
}

function buildRes(): Response {
  const em = new EventEmitter();
  const headers: Record<string, string> = {};
  (em as unknown as { setHeader: (k: string, v: string) => void }).setHeader = (
    k,
    v,
  ) => {
    headers[k.toLowerCase()] = v;
  };
  (
    em as unknown as { _headers: Record<string, string> }
  )._headers = headers;
  return em as unknown as Response;
}

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware(
      mockLogger as unknown as LoggerService,
    );
    jest.clearAllMocks();
  });

  it('generates a UUID correlation id when header is absent', () => {
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    const id = (req as Request & { correlationId: string }).correlationId;
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses x-request-id from the incoming request', () => {
    const existingId = 'abc-123-def';
    const req = buildReq({ [CORRELATION_ID_HEADER]: existingId });
    const res = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(
      (req as Request & { correlationId: string }).correlationId,
    ).toBe(existingId);
  });

  it('echoes correlation id in response header', () => {
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    const id = (req as Request & { correlationId: string }).correlationId;
    expect(
      (res as unknown as { _headers: Record<string, string> })._headers[
        CORRELATION_ID_HEADER
      ],
    ).toBe(id);
  });

  it('logs the correlation id at http level', () => {
    const req = buildReq();
    const res = buildRes();

    middleware.use(req, res, jest.fn());

    expect(mockLogger.http).toHaveBeenCalledTimes(1);
    const [, meta] = mockLogger.http.mock.calls[0] as [
      string,
      { correlationId: string },
    ];
    expect(meta.correlationId).toBeDefined();
  });

  it('generates distinct ids for different requests', () => {
    const req1 = buildReq();
    const req2 = buildReq();

    middleware.use(req1, buildRes(), jest.fn());
    middleware.use(req2, buildRes(), jest.fn());

    const id1 = (req1 as Request & { correlationId: string }).correlationId;
    const id2 = (req2 as Request & { correlationId: string }).correlationId;
    expect(id1).not.toBe(id2);
  });

  it('always calls next()', () => {
    const next = jest.fn();
    middleware.use(buildReq(), buildRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
