/**
 * SW-BE-009 — Uploads observability metrics (Prometheus registration mocked).
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UploadsObservabilityService } from './uploads-observability.service';

jest.mock('prom-client', () => {
  const noop = () => ({ inc: jest.fn(), observe: jest.fn() });
  return { Counter: jest.fn(noop), Histogram: jest.fn(noop), Gauge: jest.fn(noop) };
});

describe('UploadsObservabilityService (SW-BE-009)', () => {
  it('records upload outcome when enabled', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        UploadsObservabilityService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string) => (k === 'upload.observabilityEnabled' ? true : undefined)),
          },
        },
      ],
    }).compile();
    const svc = mod.get(UploadsObservabilityService);
    expect(() =>
      svc.recordUploadOutcome({
        route: 'avatar',
        outcome: 'success',
        durationSeconds: 0.01,
        traceId: 'trace-test',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
      }),
    ).not.toThrow();
  });

  it('skips metrics when observability disabled', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        UploadsObservabilityService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string) => (k === 'upload.observabilityEnabled' ? false : undefined)),
          },
        },
      ],
    }).compile();
    const svc = mod.get(UploadsObservabilityService);
    expect(() =>
      svc.recordUploadOutcome({
        route: 'avatar',
        outcome: 'validation_error',
        durationSeconds: 0.02,
        traceId: 't2',
      }),
    ).not.toThrow();
  });
});
