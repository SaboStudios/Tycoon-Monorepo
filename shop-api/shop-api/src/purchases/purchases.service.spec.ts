import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchasesService } from './purchases.service';
import { Purchase, PurchaseStatus } from './entities/purchase.entity';
import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  IdempotencyRecord,
  IdempotencyStatus,
} from '../idempotency/entities/idempotency-record.entity';
import { TestDbModule } from '../test/test-db.module';

const dto = { userId: 'user-1', itemId: 'item-42', amount: 19.99 };

describe('PurchasesService', () => {
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

  it('creates a purchase and marks idempotency key COMPLETED', async () => {
    const key = 'key-success-001';
    const purchase = await service.create(dto, key);

    expect(purchase.id).toBeDefined();
    expect(purchase.userId).toBe(dto.userId);
    expect(purchase.itemId).toBe(dto.itemId);
    expect(purchase.amount).toBe(dto.amount);
    expect(purchase.status).toBe(PurchaseStatus.COMPLETED);

    const record = await idempotencyRepo.findOneByOrFail({
      idempotencyKey: key,
    });
    expect(record.status).toBe(IdempotencyStatus.COMPLETED);
    expect(record.responseBody).toContain(purchase.id);
  });

  // ── Duplicate request (replay) ────────────────────────────────────────────

  it('returns the same purchase for a duplicate request (replay)', async () => {
    const key = 'key-duplicate-001';

    const first = await service.create(dto, key);
    const second = await service.create(dto, key);

    // Same purchase ID — no second DB row created.
    expect(second.id).toBe(first.id);
  });

  it('does not create a second purchase row on replay', async () => {
    const key = 'key-duplicate-002';
    const purchaseRepo: Repository<Purchase> = module.get(
      getRepositoryToken(Purchase),
    );

    await service.create(dto, key);
    await service.create(dto, key);

    const count = await purchaseRepo.count();
    expect(count).toBe(1);
  });

  // ── Concurrent / replay protection ───────────────────────────────────────

  it('throws ConflictException when the same key is in-flight concurrently', async () => {
    const key = 'key-concurrent-001';

    // Manually insert a PROCESSING record to simulate an in-flight request.
    await idempotencyRepo.insert({
      idempotencyKey: key,
      operation: 'purchases',
      status: IdempotencyStatus.PROCESSING,
      responseBody: null,
      responseStatus: null,
      completedAt: null,
    });

    await expect(service.create(dto, key)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('two concurrent calls with the same key: exactly one succeeds', async () => {
    const key = 'key-concurrent-002';

    const results = await Promise.allSettled([
      service.create(dto, key),
      service.create(dto, key),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one request wins; the other gets a 409.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(
      (rejected[0] as PromiseRejectedResult).reason,
    ).toBeInstanceOf(ConflictException);
  });

  // ── Retry after failure ───────────────────────────────────────────────────

  it('allows a retry with the same key after a previous failure', async () => {
    const key = 'key-retry-001';

    // Simulate a prior failed attempt.
    await idempotencyRepo.insert({
      idempotencyKey: key,
      operation: 'purchases',
      status: IdempotencyStatus.FAILED,
      responseBody: null,
      responseStatus: null,
      completedAt: null,
    });

    // Retry with the same key should succeed.
    const purchase = await service.create(dto, key);
    expect(purchase.id).toBeDefined();
    expect(purchase.status).toBe(PurchaseStatus.COMPLETED);

    const record = await idempotencyRepo.findOneByOrFail({
      idempotencyKey: key,
    });
    expect(record.status).toBe(IdempotencyStatus.COMPLETED);
  });
});
