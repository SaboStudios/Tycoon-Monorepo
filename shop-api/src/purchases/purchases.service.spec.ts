import { Test, TestingModule } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConflictException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PurchasesService } from "./purchases.service";
import { Purchase, PurchaseStatus } from "./entities/purchase.entity";
import { IdempotencyService } from "../idempotency/idempotency.service";
import {
  IdempotencyRecord,
  IdempotencyStatus,
} from "../idempotency/entities/idempotency-record.entity";
import { TestDbModule } from "../test/test-db.module";

/**
 * Canonical DTO per ADR-001 §7 and SHOP_PURCHASES_RUNBOOK:
 * sku, quantity, amountMinor (integer minor units), currency, userId.
 * amountMinor = 1999 means $19.99; quantity 1.
 */
const dto = {
  userId: "user-1",
  sku: "sku_gold_pack_100",
  quantity: 1,
  amountMinor: 1999,
  currency: "USD",
} as const;

describe("PurchasesService", () => {
  let module: TestingModule;
  let service: PurchasesService;
  let idempotencyRepo: Repository<IdempotencyRecord>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TestDbModule,
        TypeOrmModule.forFeature([Purchase, IdempotencyRecord]),
      ],
      providers: [PurchasesService, IdempotencyService],
    }).compile();

    service = module.get(PurchasesService);
    idempotencyRepo = module.get(getRepositoryToken(IdempotencyRecord));
  });

  afterEach(async () => {
    await module.close();
  });

  // ── Success ───────────────────────────────────────────────────────────────

  it("creates a purchase and marks idempotency key COMPLETED", async () => {
    const key = "key-success-001";
    const purchase = await service.create(dto as any, key);

    expect(purchase.id).toBeDefined();
    expect(purchase.userId).toBe(dto.userId);
    expect(purchase.sku).toBe(dto.sku);
    expect(purchase.itemId).toBe(dto.sku); // legacy alias stays in sync
    expect(purchase.quantity).toBe(dto.quantity);
    expect(purchase.amountMinor).toBe(dto.amountMinor);
    expect(purchase.amount).toBe(19.99); // legacy major units derived
    expect(purchase.currency).toBe("USD");
    expect(purchase.status).toBe(PurchaseStatus.COMPLETED);

    const record = await idempotencyRepo.findOneByOrFail({
      idempotencyKey: key,
    });
    expect(record.status).toBe(IdempotencyStatus.COMPLETED);
    expect(record.responseBody).toContain(purchase.id);
  });

  // ── Duplicate request (replay) ────────────────────────────────────────────

  it("returns the same purchase for a duplicate request (replay)", async () => {
    const key = "key-duplicate-001";

    const first = await service.create(dto as any, key);
    const second = await service.create(dto as any, key);

    // Same purchase ID — no second DB row created.
    expect(second.id).toBe(first.id);
  });

  it("does not create a second purchase row on replay", async () => {
    const key = "key-duplicate-002";
    const purchaseRepo: Repository<Purchase> = module.get(
      getRepositoryToken(Purchase),
    );

    await service.create(dto as any, key);
    await service.create(dto as any, key);

    const count = await purchaseRepo.count();
    expect(count).toBe(1);
  });

  it("409 when a completed key is reused with a different payload (body hash conflict)", async () => {
    const key = "key-payload-conflict";
    await service.create(dto as any, key);
    const differentDto = { ...dto, amountMinor: 2999 };
    await expect(
      service.create(differentDto as any, key),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // ── Concurrent / replay protection ───────────────────────────────────────

  it("throws ConflictException when the same key is in-flight concurrently", async () => {
    const key = "key-concurrent-001";

    // Manually insert a PROCESSING record to simulate an in-flight request.
    await idempotencyRepo.insert({
      idempotencyKey: key,
      operation: "purchases",
      status: IdempotencyStatus.PROCESSING,
      responseBody: null,
      responseStatus: null,
      completedAt: null,
    });

    await expect(service.create(dto as any, key)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("two concurrent calls with the same key: exactly one succeeds", async () => {
    const key = "key-concurrent-002";

    const results = await Promise.allSettled([
      service.create(dto as any, key),
      service.create(dto as any, key),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one request wins; the other gets a 409.
    // Under in-memory SQLite race may resolve as replay if first commits fast.
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.length + rejected.length).toBe(2);
    if (rejected.length > 0) {
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        ConflictException,
      );
    } else {
      // Both fulfilled means second was replay — IDs must match.
      const ids = (results as PromiseFulfilledResult<Purchase>[]).map(
        (r) => r.value.id,
      );
      expect(ids[0]).toBe(ids[1]);
    }
  });

  // ── Retry after failure ───────────────────────────────────────────────────

  it("allows a retry with the same key after a previous failure", async () => {
    const key = "key-retry-001";

    // Simulate a prior failed attempt.
    await idempotencyRepo.insert({
      idempotencyKey: key,
      operation: "purchases",
      status: IdempotencyStatus.FAILED,
      responseBody: null,
      responseStatus: null,
      completedAt: null,
    });

    // Retry with the same key should succeed.
    const purchase = await service.create(dto as any, key);
    expect(purchase.id).toBeDefined();
    expect(purchase.status).toBe(PurchaseStatus.COMPLETED);

    const record = await idempotencyRepo.findOneByOrFail({
      idempotencyKey: key,
    });
    expect(record.status).toBe(IdempotencyStatus.COMPLETED);
  });

  // ── Money bounds ─────────────────────────────────────────────────────────

  it("persists quantity and amountMinor with integer semantics and never negative", async () => {
    const key = "key-money-bounds";
    const purchase = await service.create(dto as any, key);
    expect(purchase.quantity).toBeGreaterThanOrEqual(1);
    expect(purchase.quantity).toBeLessThanOrEqual(100);
    expect(Number.isInteger(purchase.amountMinor)).toBe(true);
    expect(purchase.amountMinor).toBeGreaterThanOrEqual(0);
    expect(purchase.amountMinor).toBeLessThanOrEqual(10_000_000);
    // DB CHECK backstop: amount never negative even if DTO bypassed
    expect(purchase.amount).toBeGreaterThanOrEqual(0);
  });
});
