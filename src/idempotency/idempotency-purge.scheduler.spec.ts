import { IdempotencyPurgeScheduler } from "./idempotency-purge.scheduler";
import { IdempotencyService } from "./idempotency.service";

describe("IdempotencyPurgeScheduler", () => {
  it("calls IdempotencyService.purgeExpired on the scheduled tick", async () => {
    const idempotencyService = {
      purgeExpired: jest.fn().mockResolvedValue(undefined),
    } as unknown as IdempotencyService;
    const scheduler = new IdempotencyPurgeScheduler(idempotencyService);

    await scheduler.handleCron();

    expect(idempotencyService.purgeExpired).toHaveBeenCalledTimes(1);
  });
});
