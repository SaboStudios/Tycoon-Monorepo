import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';
import {
  IdempotencyRecord,
  IdempotencyStatus,
} from './entities/idempotency-record.entity';
import { TestDbModule } from '../test/test-db.module';

describe('IdempotencyCleanupService', () => {
  let module: TestingModule;
  let service: IdempotencyCleanupService;
  let repo: Repository<IdempotencyRecord>;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [TestDbModule, TypeOrmModule.forFeature([IdempotencyRecord])],
      providers: [IdempotencyCleanupService],
    }).compile();

    service = module.get(IdempotencyCleanupService);
    repo = module.get(getRepositoryToken(IdempotencyRecord));
  });

  afterEach(async () => {
    await repo.clear();
    await module.close();
    process.env = { ...originalEnv };
  });

  const daysAgo = (days: number): Date =>
    new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  async function insert(
    key: string,
    status: IdempotencyStatus,
    createdAt: Date,
  ) {
    const record = repo.create({
      idempotencyKey: key,
      operation: 'purchases',
      status,
      responseBody: null,
      responseStatus: null,
      completedAt: null,
    });
    await repo.insert(record);
    // createdAt has a DB default; overwrite it directly for deterministic tests.
    await repo.update({ idempotencyKey: key }, { createdAt });
  }

  it('purges COMPLETED rows older than the configured TTL', async () => {
    process.env.IDEMPOTENCY_TTL_DAYS = '7';
    await insert('old-completed', IdempotencyStatus.COMPLETED, daysAgo(10));
    await insert('recent-completed', IdempotencyStatus.COMPLETED, daysAgo(1));

    const purged = await service.purgeExpired();

    expect(purged).toBe(1);
    expect(await repo.findOneBy({ idempotencyKey: 'old-completed' })).toBeNull();
    expect(
      await repo.findOneBy({ idempotencyKey: 'recent-completed' }),
    ).not.toBeNull();
  });

  it('never purges PROCESSING rows regardless of age', async () => {
    process.env.IDEMPOTENCY_TTL_DAYS = '1';
    await insert('old-processing', IdempotencyStatus.PROCESSING, daysAgo(365));

    const purged = await service.purgeExpired();

    expect(purged).toBe(0);
    expect(
      await repo.findOneBy({ idempotencyKey: 'old-processing' }),
    ).not.toBeNull();
  });

  it('keeps FAILED rows longer than the COMPLETED TTL by default', async () => {
    process.env.IDEMPOTENCY_TTL_DAYS = '7';
    delete process.env.IDEMPOTENCY_FAILED_TTL_DAYS;
    await insert('failed-recent', IdempotencyStatus.FAILED, daysAgo(10));
    await insert('failed-old', IdempotencyStatus.FAILED, daysAgo(31));

    const purged = await service.purgeExpired();

    expect(purged).toBe(1);
    expect(await repo.findOneBy({ idempotencyKey: 'failed-recent' })).not.toBeNull();
    expect(await repo.findOneBy({ idempotencyKey: 'failed-old' })).toBeNull();
  });

  it('respects a configurable TTL via IDEMPOTENCY_TTL_DAYS', async () => {
    process.env.IDEMPOTENCY_TTL_DAYS = '1';
    await insert('two-days-old', IdempotencyStatus.COMPLETED, daysAgo(2));

    const purged = await service.purgeExpired();

    expect(purged).toBe(1);
  });

  it('accumulates purge_count across runs', async () => {
    process.env.IDEMPOTENCY_TTL_DAYS = '7';
    await insert('a', IdempotencyStatus.COMPLETED, daysAgo(10));
    await insert('b', IdempotencyStatus.COMPLETED, daysAgo(10));

    await service.purgeExpired();
    expect(service.purgeCount).toBe(2);
  });
});
