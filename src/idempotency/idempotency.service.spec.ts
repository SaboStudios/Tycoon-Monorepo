import { IdempotencyService } from "./idempotency.service";

describe("IdempotencyService", () => {
  const makeRepo = () => ({
    findOne: jest.fn(),
    delete: jest.fn(),
    create: jest.fn((v: unknown) => v),
    save: jest.fn(),
  });

  describe("find", () => {
    it("returns null when no record exists", async () => {
      const repo = makeRepo();
      repo.findOne.mockResolvedValue(null);
      const service = new IdempotencyService(repo as any);

      const result = await service.find("missing-id");

      expect(result).toBeNull();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it("returns the record when it has not expired", async () => {
      const repo = makeRepo();
      const record = {
        id: "fresh-id",
        expiresAt: new Date(Date.now() + 60_000),
      };
      repo.findOne.mockResolvedValue(record);
      const service = new IdempotencyService(repo as any);

      const result = await service.find("fresh-id");

      expect(result).toBe(record);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it("deletes and returns null when the record has expired", async () => {
      const repo = makeRepo();
      const record = {
        id: "expired-id",
        expiresAt: new Date(Date.now() - 60_000),
      };
      repo.findOne.mockResolvedValue(record);
      repo.delete.mockResolvedValue({ affected: 1 });
      const service = new IdempotencyService(repo as any);

      const result = await service.find("expired-id");

      expect(result).toBeNull();
      expect(repo.delete).toHaveBeenCalledWith("expired-id");
    });
  });

  describe("purgeExpired", () => {
    it("deletes all records whose expiresAt is in the past", async () => {
      const repo = makeRepo();
      repo.delete.mockResolvedValue({ affected: 3 });
      const service = new IdempotencyService(repo as any);

      await service.purgeExpired();

      expect(repo.delete).toHaveBeenCalledTimes(1);
      const [criteria] = repo.delete.mock.calls[0];
      expect(criteria).toHaveProperty("expiresAt");
    });
  });
});
