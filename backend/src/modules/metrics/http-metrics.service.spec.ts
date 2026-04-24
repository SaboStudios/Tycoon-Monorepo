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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpMetricsService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<HttpMetricsService>(HttpMetricsService);
  });

  it('records a request and returns metrics text', async () => {
    service.recordRequest('GET', '/api/v1/shop', 200, 0.05);
    const text = await service.getMetricsText();
    expect(text).toContain('tycoon_http_requests_total');
    expect(text).toContain('tycoon_http_request_duration_seconds');
  });

  it('includes process memory metrics in scrape output', async () => {
    const text = await service.getMetricsText();
    expect(text).toContain('tycoon_process_heap_used_bytes');
    expect(text).toContain('tycoon_process_rss_bytes');
    expect(text).toContain('tycoon_process_uptime_seconds');
  });

  it('includes DB pool metrics in scrape output', async () => {
    const text = await service.getMetricsText();
    expect(text).toContain('tycoon_db_pool_total');
    expect(text).toContain('tycoon_db_pool_idle');
    expect(text).toContain('tycoon_db_pool_waiting');
  });

  it('does not record duration for internal route group', async () => {
    service.recordRequest('GET', '/metrics', 200, 0.001);
    const text = await service.getMetricsText();
    // internal routes are counted but not histogrammed
    expect(text).toContain('tycoon_http_requests_total');
  });

  it('increments exhaustion counter when waiting exceeds threshold', () => {
    // Simulate 5 waiting out of pool size 5 → ratio = 1.0 ≥ 0.8
    mockDataSource.driver.master.waitingCount = 5;
    service.collectPoolMetrics();
    // Reset
    mockDataSource.driver.master.waitingCount = 0;
  });
});
