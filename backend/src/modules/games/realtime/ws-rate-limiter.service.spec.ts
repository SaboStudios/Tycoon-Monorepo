import { WsRateLimiterService } from './ws-rate-limiter.service';

function redisFake(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    incrementRateLimit: jest.fn().mockResolvedValue(1),
    ...overrides,
  } as never;
}

describe('WsRateLimiterService', () => {
  it('allows intents within the per-socket and per-user budgets', async () => {
    const service = new WsRateLimiterService(redisFake());
    await expect(service.consume('roll', 'sock', 1)).resolves.toBe(true);
  });

  it('rejects when the per-socket join budget is exhausted', async () => {
    let calls = 0;
    const redis = {
      incrementRateLimit: jest
        .fn()
        .mockImplementation((key: string) =>
          key.includes(':socket:') ? ++calls : 1,
        ),
    };
    const service = new WsRateLimiterService(redis as never);

    // joinPerSocket = 10
    for (let i = 0; i < 10; i++) {
      expect(await service.consume('join', 'sock', 1)).toBe(true);
    }
    expect(await service.consume('join', 'sock', 1)).toBe(false);
  });

  it('rejects when the per-user join budget is exhausted', async () => {
    let calls = 0;
    const redis = {
      incrementRateLimit: jest
        .fn()
        .mockImplementation((key: string) =>
          key.includes(':user:') ? ++calls : 1,
        ),
    };
    const service = new WsRateLimiterService(redis as never);

    // joinPerUser = 30
    for (let i = 0; i < 30; i++) {
      expect(await service.consume('join', `sock-${i}`, 7)).toBe(true);
    }
    expect(await service.consume('join', 'sock-new', 7)).toBe(false);
  });

  it('uses the action budget for roll, end-turn and chat', async () => {
    const counts = new Map<string, number>();
    const redis = {
      incrementRateLimit: jest.fn().mockImplementation((key: string) => {
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return next;
      }),
    };
    const service = new WsRateLimiterService(redis as never);

    // rollPerSocket = 30 shared across roll/end-turn/chat for one socket.
    for (let i = 0; i < 30; i++) {
      expect(await service.consume('roll', 'sock', 1)).toBe(true);
    }
    expect(await service.consume('roll', 'sock', 1)).toBe(false);
    expect(await service.consume('end-turn', 'sock', 1)).toBe(false);
    // A fresh socket for another action still has budget.
    expect(await service.consume('end-turn', 'sock-2', 1)).toBe(true);
  });

  it('degrades to a per-instance window when Redis reports 0 (outage)', async () => {
    const redis = { incrementRateLimit: jest.fn().mockResolvedValue(0) };
    const service = new WsRateLimiterService(redis as never);

    // Local fallback still bounds the socket (rollPerSocket = 30).
    let allowed = 0;
    for (let i = 0; i < 40; i++) {
      if (await service.consume('roll', 'sock', 1)) allowed += 1;
    }
    expect(allowed).toBe(30);
    expect(redis.incrementRateLimit).toHaveBeenCalled();
  });
});
