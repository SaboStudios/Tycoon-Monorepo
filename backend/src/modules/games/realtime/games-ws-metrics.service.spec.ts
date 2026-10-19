import { Test, TestingModule } from '@nestjs/testing';
import { GamesWsMetrics } from './games-ws-metrics.service';

describe('GamesWsMetrics', () => {
  let service: GamesWsMetrics;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GamesWsMetrics],
    }).compile();

    service = module.get<GamesWsMetrics>(GamesWsMetrics);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('adapterPublishFailure', () => {
    it('increments the counter by exactly 1 per call across at least three calls', async () => {
      const metric = await service.adapterPublishFailure();
      const metricName = metric.name;

      const readValue = async (): Promise<number> => {
        const snapshot = await service.registry.getMetricsAsJSON();
        const entry = snapshot.find((m) => m.name === metricName);
        expect(entry).toBeDefined();
        const values = (entry as { values: Array<{ value: number }> }).values;
        return values.reduce((sum, v) => sum + v.value, 0);
      };

      const before = await readValue();

      await service.adapterPublishFailure();
      expect(await readValue()).toBe(before + 1);

      await service.adapterPublishFailure();
      expect(await readValue()).toBe(before + 2);

      await service.adapterPublishFailure();
      expect(await readValue()).toBe(before + 3);
    });

    it('accumulates rather than resets on repeated failures', async () => {
      const metric = await service.adapterPublishFailure();
      const metricName = metric.name;

      const readValue = async (): Promise<number> => {
        const snapshot = await service.registry.getMetricsAsJSON();
        const entry = snapshot.find((m) => m.name === metricName);
        expect(entry).toBeDefined();
        const values = (entry as { values: Array<{ value: number }> }).values;
        return values.reduce((sum, v) => sum + v.value, 0);
      };

      const before = await readValue();

      await service.adapterPublishFailure();
      await service.adapterPublishFailure();
      const afterTwo = await readValue();

      await service.adapterPublishFailure();
      const afterThree = await readValue();

      expect(afterTwo).toBe(before + 2);
      expect(afterThree).toBe(afterTwo + 1);
      expect(afterThree).toBeGreaterThan(afterTwo);
    });

    it('exposes the counter through the service metrics registry', async () => {
      const metric = await service.adapterPublishFailure();

      const snapshot = await service.registry.getMetricsAsJSON();
      const entry = snapshot.find((m) => m.name === metric.name);

      expect(entry).toBeDefined();
      expect(entry?.type).toBe('counter');
    });
  });
});
