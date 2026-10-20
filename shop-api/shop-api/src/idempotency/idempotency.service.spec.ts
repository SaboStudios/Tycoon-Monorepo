import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyService } from './idempotency.service';
import {
  IdempotencyRecord,
  IdempotencyStatus,
} from './entities/idempotency-record.entity';
import { TestDbModule } from '../test/test-db.module';

const KEY = 'test-key-001';
const OP = 'purchases';

describe('IdempotencyService', () => {
  let module: TestingModule;
  let service: IdempotencyService;
  let repo: Repository<IdempotencyRecord>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TestDbModule,
        TypeOrmModule.forFeature([IdempotencyRecord]),
      ],
      providers: [IdempotencyService],
    }).compile();

    service = module.get(IdempotencyService);
    repo = module.get(getRepositoryToken(IdempotencyRecord));
  });

  afterEach(async () => {
    await repo.clear();
    await module.close();
  });

  // ── New key ────────────────────────────────────────────────────────────────

  it('claims a new key and returns isReplay=false', async () => {
    const result = await service.claimKey(KEY, OP);

    expect(result.isReplay).toBe(false);
    expect(result.record.idempotencyKey).toBe(KEY);
    expect(result.record.status).toBe(IdempotencyStatus.PROCESSING);
  });

  // ── Completed key (replay) ─────────────────────────────────────────────────

  it('returns isReplay=true for a COMPLETED key', async () => {
    await service.claimKey(KEY, OP);
    await service.markCompleted(KEY, { status: 201, body: { id: 'abc' } });

    const result = await service.claimKey(KEY, OP);

    expect(result.isReplay).toBe(true);
    expect(result.record.status).toBe(IdempotencyStatus.COMPLETED);
  });

  it('getCachedResponse deserialises the stored body', async () => {
    const body = { id: 'abc', amount: 9.99 };
    await service.claimKey(KEY, OP);
    await service.markCompleted(KEY, { status: 201, body });

    const { record } = await service.claimKey(KEY, OP);
    const cached = service.getCachedResponse(record);

    expect(cached.status).toBe(201);
    expect(cached.body).toEqual(body);
  });

  // ── Concurrent / PROCESSING key ───────────────────────────────────────────

  it('throws ConflictException when key is still PROCESSING', async () => {
    await service.claimKey(KEY, OP); // leaves status=PROCESSING

    await expect(service.claimKey(KEY, OP)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  // ── Retry after failure ───────────────────────────────────────────────────

  it('allows retry after a FAILED key by resetting to PROCESSING', async () => {
    await service.claimKey(KEY, OP);
    await service.markFailed(KEY);

    const result = await service.claimKey(KEY, OP);

    expect(result.isReplay).toBe(false);
    expect(result.record.status).toBe(IdempotencyStatus.PROCESSING);
  });

  // ── markFailed ────────────────────────────────────────────────────────────

  it('markFailed sets status to FAILED', async () => {
    await service.claimKey(KEY, OP);
    await service.markFailed(KEY);

    const record = await repo.findOneByOrFail({ idempotencyKey: KEY });
    expect(record.status).toBe(IdempotencyStatus.FAILED);
  });
});
