import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TracingService } from './tracing.service';

describe('TracingService', () => {
  let service: TracingService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TracingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'app.nodeEnv') return 'development';
              if (key === 'TRACING_ENABLED') return true;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TracingService>(TracingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isEnabled', () => {
    it('returns false when nodeEnv is test', () => {
      const testService = new TracingService({
        get: jest.fn((key: string) => {
          if (key === 'app.nodeEnv') return 'test';
          if (key === 'TRACING_ENABLED') return false;
          return false;
        }),
      } as unknown as ConfigService);
      expect(testService.isEnabled()).toBe(false);
    });

    it('returns true when TRACING_ENABLED is true and not in test', () => {
      const prodService = new TracingService({
        get: jest.fn((key: string) => {
          if (key === 'app.nodeEnv') return 'production';
          if (key === 'TRACING_ENABLED') return true;
          return true;
        }),
      } as unknown as ConfigService);
      expect(prodService.isEnabled()).toBe(true);
    });
  });

  describe('HTTP request spans', () => {
    it('startHttpRequestSpan creates a span when enabled', () => {
      const prodService = new TracingService({
        get: jest.fn((key: string) => {
          if (key === 'app.nodeEnv') return 'production';
          return true;
        }),
      } as unknown as ConfigService);

      const span = prodService.startHttpRequestSpan('GET /api/users', {
        route_group: 'public',
      });
      expect(span).toBeDefined();
      prodService.endSpan(span);
    });

    it('startHttpRequestSpan returns null when disabled', () => {
      const devService = new TracingService({
        get: jest.fn((key: string) => {
          if (key === 'app.nodeEnv') return 'development';
          if (key === 'TRACING_ENABLED') return false;
          return false;
        }),
      } as unknown as ConfigService);

      const span = devService.startHttpRequestSpan('GET /api/users', {});
      expect(span).toBeNull();
    });
  });

  describe('DB spans', () => {
    it('startDbSpan creates a span when enabled', () => {
      const prodService = new TracingService({
        get: jest.fn((key: string) => {
          if (key === 'app.nodeEnv') return 'production';
          return true;
        }),
      } as unknown as ConfigService);

      const span = prodService.startDbSpan('db_query', {
        query_type: 'SELECT',
      });
      expect(span).toBeDefined();
      prodService.endSpan(span);
    });
  });

  describe('cache spans', () => {
    it('startCacheSpan creates a span when enabled', () => {
      const prodService = new TracingService({
        get: jest.fn((key: string) => {
          if (key === 'app.nodeEnv') return 'production';
          return true;
        }),
      } as unknown as ConfigService);

      const span = prodService.startCacheSpan('cache_get', {
        key: 'user:123',
      });
      expect(span).toBeDefined();
      prodService.endSpan(span);
    });
  });

  describe('error handling', () => {
    it('setError and endSpan do not throw on null span', () => {
      expect(() => service.setError(null, new Error('test'))).not.toThrow();
      expect(() => service.endSpan(null)).not.toThrow();
    });

    it('addEvent does not throw on null span', () => {
      expect(() =>
        service.addEvent(null, 'test_event', { data: 'value' }),
      ).not.toThrow();
    });
  });

  describe('trace context extraction', () => {
    it('extractTraceContext returns trace info when active span exists', () => {
      const prodService = new TracingService({
        get: jest.fn((key: string) => {
          if (key === 'app.nodeEnv') return 'production';
          return true;
        }),
      } as unknown as ConfigService);

      const span = prodService.startHttpRequestSpan('test', {});
      prodService.endSpan(span);

      const ctx = prodService.extractTraceContext({});
      expect(ctx).toHaveProperty('traceId');
      expect(ctx).toHaveProperty('spanId');
    });

    it('extractTraceContext returns unknown when no active span', () => {
      const ctx = service.extractTraceContext({});
      expect(ctx.traceId).toBe('unknown');
      expect(ctx.spanId).toBe('unknown');
    });
  });
});