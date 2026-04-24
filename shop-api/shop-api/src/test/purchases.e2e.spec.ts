/**
 * E2E tests for POST /purchases
 *
 * Uses an in-memory SQLite database — no external services required.
 * Spins up the full NestJS HTTP stack via supertest.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchasesModule } from '../purchases/purchases.module';
import { Purchase } from '../purchases/entities/purchase.entity';
import {
  IdempotencyRecord,
  IdempotencyStatus,
} from '../idempotency/entities/idempotency-record.entity';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { TestDbModule } from './test-db.module';

const validDto = { userId: 'user-e2e', itemId: 'item-99', amount: 49.99 };

describe('POST /purchases (e2e)', () => {
  let app: INestApplication;
  let idempotencyRepo: Repository<IdempotencyRecord>;
  let purchaseRepo: Repository<Purchase>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestDbModule,
        TypeOrmModule.forFeature([Purchase, IdempotencyRecord]),
        PurchasesModule,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    idempotencyRepo = module.get(getRepositoryToken(IdempotencyRecord));
    purchaseRepo = module.get(getRepositoryToken(Purchase));
  });

  afterEach(async () => {
    await app.close();
  });

  // ── 400 – missing / invalid header ───────────────────────────────────────

  it('400 when Idempotency-Key header is absent', async () => {
    const res = await request(app.getHttpServer())
      .post('/purchases')
      .send(validDto);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Idempotency-Key/);
  });

  it('400 when Idempotency-Key header is empty', async () => {
    const res = await request(app.getHttpServer())
      .post('/purchases')
      .set('idempotency-key', '   ')
      .send(validDto);

    expect(res.status).toBe(400);
  });

  it('400 when Idempotency-Key exceeds 255 characters', async () => {
    const res = await request(app.getHttpServer())
      .post('/purchases')
      .set('idempotency-key', 'x'.repeat(256))
      .send(validDto);

    expect(res.status).toBe(400);
  });

  it('400 when request body is invalid', async () => {
    const res = await request(app.getHttpServer())
      .post('/purchases')
      .set('idempotency-key', 'key-bad-body')
      .send({ userId: 'u1' }); // missing itemId and amount

    expect(res.status).toBe(400);
  });

  // ── 201 – success ─────────────────────────────────────────────────────────

  it('201 creates a purchase and returns the purchase object', async () => {
    const res = await request(app.getHttpServer())
      .post('/purchases')
      .set('idempotency-key', 'key-e2e-success-001')
      .send(validDto);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.userId).toBe(validDto.userId);
    expect(res.body.itemId).toBe(validDto.itemId);
    expect(res.body.amount).toBe(validDto.amount);
  });

  // ── Duplicate / replay ────────────────────────────────────────────────────

  it('201 returns the same body on a duplicate request (replay)', async () => {
    const key = 'key-e2e-duplicate-001';

    const first = await request(app.getHttpServer())
      .post('/purchases')
      .set('idempotency-key', key)
      .send(validDto);

    const second = await request(app.getHttpServer())
      .post('/purchases')
      .set('idempotency-key', key)
      .send(validDto);

    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
  });

  it('does not create a second purchase row on replay', async () => {
    const key = 'key-e2e-duplicate-002';

    await request(app.getHttpServer())
      .post('/purchases')
      .set('idempotency-key', key)
      .send(validDto);

    await request(app.getHttpServer())
      .post('/purchases')
      .set('idempotency-key', key)
      .send(validDto);

    const count = await purchaseRepo.count();
    expect(count).toBe(1);
  });

  // ── 409 – concurrent / in-flight ─────────────────────────────────────────

  it('409 when the same key is currently being processed', async () => {
    const key = 'key-e2e-concurrent-001';

    // Simulate an in-flight request by inserting a PROCESSING record.
    await idempotencyRepo.insert({
      idempotencyKey: key,
      operation: 'purchases',
      status: IdempotencyStatus.PROCESSING,
      responseBody: null,
      responseStatus: null,
      completedAt: null,
    });

    const res = await request(app.getHttpServer())
      .post('/purchases')
      .set('idempotency-key', key)
      .send(validDto);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already being processed/i);
  });

  it('exactly one of two concurrent requests succeeds', async () => {
    const key = 'key-e2e-concurrent-002';

    const [r1, r2] = await Promise.all([
      request(app.getHttpServer())
        .post('/purchases')
        .set('idempotency-key', key)
        .send(validDto),
      request(app.getHttpServer())
        .post('/purchases')
        .set('idempotency-key', key)
        .send(validDto),
    ]);

    const statuses = [r1.status, r2.status].sort();
    // One 201, one 409
    expect(statuses).toEqual([201, 409]);
  });

  // ── Retry after failure ───────────────────────────────────────────────────

  it('201 allows retry after a previous FAILED attempt', async () => {
    const key = 'key-e2e-retry-001';

    await idempotencyRepo.insert({
      idempotencyKey: key,
      operation: 'purchases',
      status: IdempotencyStatus.FAILED,
      responseBody: null,
      responseStatus: null,
      completedAt: null,
    });

    const res = await request(app.getHttpServer())
      .post('/purchases')
      .set('idempotency-key', key)
      .send(validDto);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();

    const record = await idempotencyRepo.findOneByOrFail({
      idempotencyKey: key,
    });
    expect(record.status).toBe(IdempotencyStatus.COMPLETED);
  });

  // ── GET /purchases/:id ────────────────────────────────────────────────────

  it('200 returns a purchase by ID', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/purchases')
      .set('idempotency-key', 'key-e2e-get-001')
      .send(validDto);

    const getRes = await request(app.getHttpServer()).get(
      `/purchases/${createRes.body.id}`,
    );

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(createRes.body.id);
  });

  it('404 for a non-existent purchase ID', async () => {
    const res = await request(app.getHttpServer()).get(
      '/purchases/00000000-0000-0000-0000-000000000000',
    );
    expect(res.status).toBe(404);
  });
});
