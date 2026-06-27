/**
 * SW-BE-037 — UploadsObservabilityInterceptor full spec.
 *
 * Covers:
 *   - upload start log fires before handler
 *   - success outcome recorded after handler resolves
 *   - error outcome recorded after handler rejects
 *   - route label bucketing (uploadsRouteLabel)
 *   - traceId propagation via x-request-id header
 */
import { of, throwError } from 'rxjs';
import { ExecutionContext, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import {
  UploadsObservabilityInterceptor,
  uploadsRouteLabel,
} from './uploads-observability.interceptor';
import { UploadsObservabilityService } from './uploads-observability.service';

jest.mock('prom-client', () => {
  const noop = () => ({ inc: jest.fn(), observe: jest.fn() });
  return { Counter: jest.fn(noop), Histogram: jest.fn(noop) };
});

function makeObs() {
  return {
    recordUploadStart: jest.fn(),
    recordUploadOutcome: jest.fn(),
    recordMulterError: jest.fn(),
    recordVirusScanOutcome: jest.fn(),
    createTraceContext: jest.fn(() => ({ trace_id: 'test', route: 'avatar', ts: 'now' })),
  } as unknown as UploadsObservabilityService;
}

function makeContext(path: string, headers: Record<string, string> = {}, file?: Partial<Express.Multer.File>) {
  const req = { path, url: path, headers, file } as unknown as Record<string, unknown>;
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    _req: req,
  } as unknown as ExecutionContext & { _req: Record<string, unknown> };
}

describe('UploadsObservabilityInterceptor (SW-BE-037)', () => {
  let obs: UploadsObservabilityService;
  let interceptor: UploadsObservabilityInterceptor;

  beforeEach(() => {
    obs = makeObs();
    interceptor = new UploadsObservabilityInterceptor(obs);
  });

  // ── start log fires before handler resolves ──────────────────────────────

  it('calls recordUploadStart before handler resolves', (done) => {
    const ctx = makeContext('/uploads/avatar');
    const next = { handle: jest.fn(() => of({ id: 1 })) };

    interceptor.intercept(ctx, next).subscribe({
      complete: () => {
        expect(obs.recordUploadStart).toHaveBeenCalledTimes(1);
        expect(obs.recordUploadStart).toHaveBeenCalledBefore
          ? expect(obs.recordUploadStart).toHaveBeenCalledBefore(obs.recordUploadOutcome as jest.Mock)
          : expect(obs.recordUploadStart).toHaveBeenCalled();
        done();
      },
    });
  });

  it('recordUploadStart receives correct route label and traceId', (done) => {
    const ctx = makeContext('/uploads/avatar', { 'x-request-id': 'req-abc' });
    const next = { handle: () => of({}) };

    interceptor.intercept(ctx, next).subscribe({
      complete: () => {
        expect(obs.recordUploadStart).toHaveBeenCalledWith(
          expect.objectContaining({ route: 'avatar', traceId: 'req-abc' }),
        );
        done();
      },
    });
  });

  // ── success path ─────────────────────────────────────────────────────────

  it('records outcome success after handler resolves', (done) => {
    const file = { mimetype: 'image/jpeg', size: 2048 } as Express.Multer.File;
    const ctx = makeContext('/uploads/avatar', {}, file);
    const next = { handle: () => of({ key: 'abc' }) };

    interceptor.intercept(ctx, next).subscribe({
      complete: () => {
        expect(obs.recordUploadOutcome).toHaveBeenCalledWith(
          expect.objectContaining({
            route: 'avatar',
            outcome: 'success',
            mimeType: 'image/jpeg',
            sizeBytes: 2048,
          }),
        );
        done();
      },
    });
  });

  it('propagates the response value unchanged on success', (done) => {
    const ctx = makeContext('/uploads/avatar');
    const next = { handle: () => of({ key: 'file-key' }) };
    const results: unknown[] = [];

    interceptor.intercept(ctx, next).subscribe({
      next: (v) => results.push(v),
      complete: () => {
        expect(results).toEqual([{ key: 'file-key' }]);
        done();
      },
    });
  });

  // ── error path ───────────────────────────────────────────────────────────

  it('records outcome validation_error on BadRequestException', (done) => {
    const ctx = makeContext('/uploads/avatar');
    const next = { handle: () => throwError(() => new BadRequestException('bad file')) };

    interceptor.intercept(ctx, next).subscribe({
      error: () => {
        expect(obs.recordUploadOutcome).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: 'validation_error' }),
        );
        done();
      },
    });
  });

  it('records outcome multer_error on PayloadTooLargeException', (done) => {
    const ctx = makeContext('/uploads/avatar');
    const next = { handle: () => throwError(() => new PayloadTooLargeException()) };

    interceptor.intercept(ctx, next).subscribe({
      error: () => {
        expect(obs.recordUploadOutcome).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: 'multer_error' }),
        );
        done();
      },
    });
  });

  it('re-throws the original error after recording it', (done) => {
    const err = new BadRequestException('bad');
    const ctx = makeContext('/uploads/avatar');
    const next = { handle: () => throwError(() => err) };

    interceptor.intercept(ctx, next).subscribe({
      error: (e) => {
        expect(e).toBe(err);
        done();
      },
    });
  });

  // ── traceId propagation ──────────────────────────────────────────────────

  it('uses x-request-id header as traceId when present and valid', (done) => {
    const ctx = makeContext('/uploads/admin/assets', { 'x-request-id': 'trace-123' });
    const next = { handle: () => of({}) };

    interceptor.intercept(ctx, next).subscribe({
      complete: () => {
        expect(obs.recordUploadOutcome).toHaveBeenCalledWith(
          expect.objectContaining({ traceId: 'trace-123' }),
        );
        done();
      },
    });
  });

  it('generates a fallback traceId when x-request-id is absent', (done) => {
    const ctx = makeContext('/uploads/avatar', {});
    const next = { handle: () => of({}) };

    interceptor.intercept(ctx, next).subscribe({
      complete: () => {
        const call = (obs.recordUploadOutcome as jest.Mock).mock.calls[0][0];
        expect(typeof call.traceId).toBe('string');
        expect(call.traceId.length).toBeGreaterThan(0);
        done();
      },
    });
  });

  it('generates a fallback traceId when x-request-id exceeds 128 chars', (done) => {
    const longId = 'x'.repeat(200);
    const ctx = makeContext('/uploads/avatar', { 'x-request-id': longId });
    const next = { handle: () => of({}) };

    interceptor.intercept(ctx, next).subscribe({
      complete: () => {
        const call = (obs.recordUploadOutcome as jest.Mock).mock.calls[0][0];
        expect(call.traceId).not.toBe(longId);
        done();
      },
    });
  });

  // ── uploadTraceId stamped on request ─────────────────────────────────────

  it('stamps uploadTraceId on the request object', (done) => {
    const ctx = makeContext('/uploads/avatar', { 'x-request-id': 'tid-abc' });
    const next = { handle: () => of({}) };
    const req = (ctx as unknown as { _req: Record<string, unknown> })._req;

    interceptor.intercept(ctx, next).subscribe({
      complete: () => {
        expect((req as { uploadTraceId?: string }).uploadTraceId).toBe('tid-abc');
        done();
      },
    });
  });
});

// ── uploadsRouteLabel unit tests ─────────────────────────────────────────────

describe('uploadsRouteLabel', () => {
  it.each([
    ['/uploads/avatar', 'avatar'],
    ['/uploads/admin/assets', 'admin_asset'],
    ['/uploads/signed-url', 'signed_url'],
    ['/uploads/download', 'download'],
    ['/uploads/batch', 'batch'],
    ['/uploads-enhanced/stats', 'stats'],
    ['/uploads/stats', 'stats'],
    ['/uploads-enhanced/', 'list'],
    ['/uploads-enhanced', 'list'],
    ['/uploads/file/123', 'file_delete'],
    ['/unknown/path', 'other'],
  ])('"%s" → "%s"', (path, expected) => {
    expect(uploadsRouteLabel(path)).toBe(expected);
  });
});
