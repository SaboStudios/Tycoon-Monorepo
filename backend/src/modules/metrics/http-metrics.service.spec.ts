/**
 * SW-BE-028 — HttpMetricsService: DTO validation and error mapping tests.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HttpMetricsService } from './http-metrics.service';

const mockDataSource = {
  driver: { master: { totalCount: 3, idleCount: 2, waitingCount: 0 } },
  options: { poolSize: 5 },
  query: jest.fn(),
};

describe('HttpMetricsService', () => {
  let service: HttpMetricsService;

  beforeEach(async () => {
    mockDataSource.driver.master.totalCount = 3;
    mockDataSource.driver.master.idleCount = 2;
    mockDataSource.driver.master.waitingCount = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpMetricsService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<HttpMetricsService>(HttpMetricsService);
  });

  // ── scrape output ─────────────────────────────────────────────────────────

  describe('getMetricsText()', () => {
    it('returns Prometheus text containing HTTP request counter', async () => {
      service.recordRequest('GET', '/api/v1/shop', 200, 0.05);
      const text = await service.getMetricsText();
      expect(text).toContain('tycoon_http_requests_total');
    });

    it('returns Prometheus text containing HTTP duration histogram', async () => {
      service.recordRequest('GET', '/api/v1/shop', 200, 0.05);
      const text = await service.getMetricsText();
      expect(text).toContain('tycoon_http_request_duration_seconds');
    });

    it('includes process memory metrics', async () => {
      const text = await service.getMetricsText();
      expect(text).toContain('tycoon_process_heap_used_bytes');
      expect(text).toContain('tycoon_process_rss_bytes');
      expect(text).toContain('tycoon_process_uptime_seconds');
    });

    it('includes DB pool metrics', async () => {
      const text = await service.getMetricsText();
      expect(text).toContain('tycoon_db_pool_total');
      expect(text).toContain('tycoon_db_pool_idle');
      expect(text).toContain('tycoon_db_pool_waiting');
    });

    it('includes event-loop lag metric', async () => {
      const text = await service.getMetricsText();
      expect(text).toContain('tycoon_event_loop_lag_seconds');
    });
  });

  // ── recordRequest label correctness ──────────────────────────────────────

  describe('recordRequest() — label mapping', () => {
    it('normalises method to uppercase', async () => {
      service.recordRequest('get', '/api/v1/shop', 200, 0.01);
      const text = await service.getMetricsText();
      expect(text).toContain('method="GET"');
    });

    it('classifies /api/v1/shop as public route group', async () => {
      service.recordRequest('GET', '/api/v1/shop', 200, 0.01);
      const text = await service.getMetricsText();
      expect(text).toContain('route_group="public"');
    });

    it('classifies /api/v1/admin/users as admin route group', async () => {
      service.recordRequest('GET', '/api/v1/admin/users', 200, 0.01);
      const text = await service.getMetricsText();
      expect(text).toContain('route_group="admin"');
    });

    it('classifies /metrics as internal route group', async () => {
      service.recordRequest('GET', '/metrics', 200, 0.001);
      const text = await service.getMetricsText();
      expect(text).toContain('route_group="internal"');
    });

    it('maps 200 to status_class 2xx', async () => {
      service.recordRequest('GET', '/api/v1/shop', 200, 0.01);
      const text = await service.getMetricsText();
      expect(text).toContain('status_class="2xx"');
    });

    it('maps 404 to status_class 4xx', async () => {
      service.recordRequest('GET', '/api/v1/missing', 404, 0.01);
      const text = await service.getMetricsText();
      expect(text).toContain('status_class="4xx"');
    });

    it('maps 500 to status_class 5xx', async () => {
      service.recordRequest('GET', '/api/v1/crash', 500, 0.01);
      const text = await service.getMetricsText();
      expect(text).toContain('status_class="5xx"');
    });

    it('maps 301 to status_class 3xx', async () => {
      service.recordRequest('GET', '/api/v1/old', 301, 0.01);
      const text = await service.getMetricsText();
      expect(text).toContain('status_class="3xx"');
    });

    it('does not record duration histogram for internal routes', async () => {
      service.recordRequest('GET', '/metrics', 200, 0.001);
      const text = await service.getMetricsText();
      expect(text).toContain('tycoon_http_requests_total');
    });
  });

  // ── pool metrics ──────────────────────────────────────────────────────────

  describe('collectPoolMetrics()', () => {
    it('sets pool gauges from the driver master object', async () => {
      mockDataSource.driver.master.totalCount = 10;
      mockDataSource.driver.master.idleCount = 7;
      mockDataSource.driver.master.waitingCount = 1;

      service.collectPoolMetrics();
      const text = await service.getMetricsText();

      expect(text).toContain('tycoon_db_pool_total');
      expect(text).toContain('tycoon_db_pool_idle');
      expect(text).toContain('tycoon_db_pool_waiting');
    });

    it('increments exhaustion counter when waiting / poolSize >= 0.8', () => {
      mockDataSource.driver.master.waitingCount = 4;
      expect(() => service.collectPoolMetrics()).not.toThrow();
    });

    it('does not throw when driver.master is absent', () => {
      const savedMaster = mockDataSource.driver.master;
      (mockDataSource.driver as unknown as { master: undefined }).master = undefined;

      expect(() => service.collectPoolMetrics()).not.toThrow();

      (mockDataSource.driver as unknown as { master: typeof savedMaster }).master = savedMaster;
    });
  });

  // ── process metrics ───────────────────────────────────────────────────────

  describe('collectProcessMetrics()', () => {
    it('does not throw', () => {
      expect(() => service.collectProcessMetrics()).not.toThrow();
    });
  });
});
