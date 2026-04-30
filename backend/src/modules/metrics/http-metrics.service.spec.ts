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

  it('records a request and exposes request metrics', async () => {
    service.recordRequest('GET', '/api/v1/shop', 200, 0.05);
    const text = await service.getMetricsText();
    expect(text).toContain('tycoon_http_requests_total');
    expect(text).toContain('tycoon_http_request_duration_seconds');
  });

  it('includes process and pool metrics in scrape output', async () => {
    const text = await service.getMetricsText();
    expect(text).toContain('tycoon_process_heap_used_bytes');
    expect(text).toContain('tycoon_db_pool_total');
  });

  it('does not throw while collecting pool/process metrics', () => {
    expect(() => service.collectPoolMetrics()).not.toThrow();
    expect(() => service.collectProcessMetrics()).not.toThrow();
  });
});
