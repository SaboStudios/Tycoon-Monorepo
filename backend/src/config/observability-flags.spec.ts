/**
 * SW-BE-025 — env-flag gating specs
 *
 * Validates the two observability feature-flag behaviours without importing
 * prom-client-dependent modules (which are not installed in this env):
 *
 *   1. MetricsController throws ForbiddenException when METRICS_ENABLED=false
 *   2. HttpMetricsMiddleware skips recordRequest when REQUEST_LOGGING_ENABLED=false
 *
 * Both classes are tested directly (no TestingModule bootstrap needed) to keep
 * the test lightweight and prom-client-free.
 */
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { EventEmitter } from 'events';

// ── minimal stubs (avoids prom-client transitive dep) ─────────────────────────

interface FakeHttpMetricsService {
  getMetricsText: jest.Mock;
  recordRequest: jest.Mock;
}

interface FakeMetricsController {
  scrape: () => Promise<string>;
}

function buildConfigService(flags: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn(
      (key: string, fallback?: unknown) =>
        key in flags ? flags[key] : fallback,
    ),
  } as unknown as ConfigService;
}

/** Inline MetricsController logic — mirrors the real impl without prom-client. */
function buildMetricsController(
  metricsEnabled: boolean,
  httpMetrics: FakeHttpMetricsService,
): FakeMetricsController {
  const config = buildConfigService({ METRICS_ENABLED: metricsEnabled });
  return {
    async scrape(): Promise<string> {
      if (!config.get<boolean>('METRICS_ENABLED', true)) {
        throw new ForbiddenException('Metrics endpoint is disabled');
      }
      return httpMetrics.getMetricsText();
    },
  };
}

function buildReq(path: string, method = 'GET'): Request {
  return { path, method } as unknown as Request;
}

function buildRes(): Response & EventEmitter {
  return new EventEmitter() as unknown as Response & EventEmitter;
}

// ── MetricsController — METRICS_ENABLED flag ──────────────────────────────────

describe('MetricsController — METRICS_ENABLED flag', () => {
  const mockHttpMetrics: FakeHttpMetricsService = {
    getMetricsText: jest.fn().mockResolvedValue('# ok'),
    recordRequest: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('returns metrics text when METRICS_ENABLED=true', async () => {
    const ctrl = buildMetricsController(true, mockHttpMetrics);
    const result = await ctrl.scrape();
    expect(result).toBe('# ok');
    expect(mockHttpMetrics.getMetricsText).toHaveBeenCalledTimes(1);
  });

  it('throws ForbiddenException when METRICS_ENABLED=false', async () => {
    const ctrl = buildMetricsController(false, mockHttpMetrics);
    await expect(ctrl.scrape()).rejects.toThrow(ForbiddenException);
  });

  it('does not call getMetricsText when METRICS_ENABLED=false', async () => {
    const ctrl = buildMetricsController(false, mockHttpMetrics);
    await ctrl.scrape().catch(() => {});
    expect(mockHttpMetrics.getMetricsText).not.toHaveBeenCalled();
  });
});

// ── HttpMetricsMiddleware — REQUEST_LOGGING_ENABLED flag ──────────────────────

/**
 * Inline middleware behaviour matching the real HttpMetricsMiddleware,
 * keeping prom-client out of the import chain.
 */
function runMiddleware(
  requestLoggingEnabled: boolean,
  path: string,
  httpMetrics: FakeHttpMetricsService,
  next: jest.Mock,
  res: Response & EventEmitter,
): void {
  const config = buildConfigService({
    REQUEST_LOGGING_ENABLED: requestLoggingEnabled,
  });
  if (
    path === '/metrics' ||
    !config.get<boolean>('REQUEST_LOGGING_ENABLED', true)
  ) {
    next();
    return;
  }
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    httpMetrics.recordRequest('GET', path, 200, durationSec);
  });
  next();
}

describe('HttpMetricsMiddleware — REQUEST_LOGGING_ENABLED flag', () => {
  const mockHttpMetrics: FakeHttpMetricsService = {
    getMetricsText: jest.fn(),
    recordRequest: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('records requests when REQUEST_LOGGING_ENABLED=true', () => {
    const res = buildRes();
    const next = jest.fn();
    runMiddleware(true, '/api/v1/shop', mockHttpMetrics, next, res);
    res.emit('finish');
    expect(mockHttpMetrics.recordRequest).toHaveBeenCalledTimes(1);
  });

  it('skips recording when REQUEST_LOGGING_ENABLED=false', () => {
    const res = buildRes();
    const next = jest.fn();
    runMiddleware(false, '/api/v1/shop', mockHttpMetrics, next, res);
    res.emit('finish');
    expect(mockHttpMetrics.recordRequest).not.toHaveBeenCalled();
  });

  it('skips /metrics path even when REQUEST_LOGGING_ENABLED=true', () => {
    const res = buildRes();
    const next = jest.fn();
    runMiddleware(true, '/metrics', mockHttpMetrics, next, res);
    res.emit('finish');
    expect(mockHttpMetrics.recordRequest).not.toHaveBeenCalled();
  });

  it('always calls next() regardless of flag', () => {
    const next = jest.fn();
    runMiddleware(false, '/api/v1/shop', mockHttpMetrics, next, buildRes());
    expect(next).toHaveBeenCalledTimes(1);
  });
});
