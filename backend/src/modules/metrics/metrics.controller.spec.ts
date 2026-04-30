/**
 * SW-BE-028 — MetricsController: DTO validation and error mapping tests.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { HttpMetricsService } from './http-metrics.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';

const PROMETHEUS_SAMPLE = `# HELP tycoon_http_requests_total Total HTTP requests
# TYPE tycoon_http_requests_total counter
tycoon_http_requests_total{method="GET",route_group="public",status_class="2xx"} 5
`;

const mockHttpMetricsService = {
  getMetricsText: jest.fn(),
};

describe('MetricsController', () => {
  let controller: MetricsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        { provide: HttpMetricsService, useValue: mockHttpMetricsService },
        { provide: AuditTrailService, useValue: { log: jest.fn() } },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    jest.clearAllMocks();
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  describe('scrape()', () => {
    it('delegates to HttpMetricsService.getMetricsText()', async () => {
      mockHttpMetricsService.getMetricsText.mockResolvedValue(PROMETHEUS_SAMPLE);
      await controller.scrape();
      expect(mockHttpMetricsService.getMetricsText).toHaveBeenCalledTimes(1);
    });

    it('returns the Prometheus text payload from the service', async () => {
      mockHttpMetricsService.getMetricsText.mockResolvedValue(PROMETHEUS_SAMPLE);
      const result = await controller.scrape();
      expect(result).toBe(PROMETHEUS_SAMPLE);
    });

    it('returns an empty string when the registry is empty', async () => {
      mockHttpMetricsService.getMetricsText.mockResolvedValue('');
      const result = await controller.scrape();
      expect(result).toBe('');
    });

    it('propagates errors thrown by the service', async () => {
      mockHttpMetricsService.getMetricsText.mockRejectedValue(
        new Error('registry unavailable'),
      );
      await expect(controller.scrape()).rejects.toThrow('registry unavailable');
    });
  });
});
