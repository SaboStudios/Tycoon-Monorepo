import { GamesWsMetrics } from './games-ws-metrics.service';

describe('GamesWsMetrics', () => {
  let metrics: GamesWsMetrics;

  beforeEach(() => {
    metrics = new GamesWsMetrics();
  });

  it('records adapter publish failures', () => {
    const spy = jest.spyOn(metrics, 'adapterPublishFailure');

    metrics.adapterPublishFailure();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('increments the adapter publish failure counter once per failure', () => {
    const before = metrics.getAdapterPublishFailures();

    metrics.adapterPublishFailure();
    metrics.adapterPublishFailure();

    expect(metrics.getAdapterPublishFailures()).toBe(before + 2);
  });
});
