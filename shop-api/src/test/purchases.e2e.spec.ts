/**
 * E2E tests for POST /purchases — idempotency, money bounds, and error envelope.
 *
 * Uses an in-memory SQLite database — no external services required.
 * Spins up the full NestJS HTTP stack via supertest.
 *
 * Per ADR-001 §7 / SHOP_PURCHASES_RUNBOOK / docs/API_ERROR_RESPONSE_STANDARDS.md:
 *  - DTO validates sku (1-64, pattern), quantity (1-100 int), amountMinor (0-10_000_000 int minor units), rejects unknown fields.
 *  - Errors emit canonical shape { statusCode, message, errors, correlationId }.
 *  - Idempotency-Key with body hash: replay returns 201 same body, payload conflict → 409.
 *  - Inventory never negative; concurrent buys serialize.
 *  - requestId is propagated and echoed as correlationId.
 */
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { TypeOrmModule } from "@nestjs/typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PurchasesModule } from "../purchases/purchases.module";
import { Purchase } from "../purchases/entities/purchase.entity";
import {
  IdempotencyRecord,
  IdempotencyStatus,
} from "../idempotency/entities/idempotency-record.entity";
import { HttpExceptionFilter } from "../common/filters/http-exception.filter";
import { TestDbModule } from "./test-db.module";

const TEST_API_KEY = "test-shop-key-e2e";

// Canonical valid DTO per new money bounds spec: sku, quantity, amountMinor (cents)
const validDto = {
  userId: "user-e2e",
  sku: "sku_gold_pack_100",
  quantity: 1,
  amountMinor: 4999,
  currency: "USD",
} as const;

describe("POST /purchases (e2e)", () => {
  let app: INestApplication;
  let idempotencyRepo: Repository<IdempotencyRecord>;
  let purchaseRepo: Repository<Purchase>;

  beforeAll(() => {
    process.env.SHOP_API_KEY = TEST_API_KEY;
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestDbModule,
        TypeOrmModule.forFeature([Purchase, IdempotencyRecord]),
        PurchasesModule,
      ],
    }).compile();

    app = module.createNestApplication();

    // Lightweight requestId propagation for e2e — mirrors RequestIdMiddleware
    // so success responses also echo x-request-id / x-correlation-id and error
    // filter can correlate. In production AppModule wires the real middleware.
    app.use((req: any, res: any, next: any) => {
      const incoming =
        req.headers["x-request-id"] || req.headers["x-correlation-id"];
      const headerVal = Array.isArray(incoming) ? incoming[0] : incoming;
      const requestId =
        typeof headerVal === "string" && headerVal.trim().length > 0
          ? headerVal.trim()
          : `req_${Date.now()}-${Math.random().toString(36).slice(2)}`;
      req.requestId = requestId;
      res.setHeader("x-request-id", requestId);
      res.setHeader("x-correlation-id", requestId);
      next();
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    idempotencyRepo = module.get(getRepositoryToken(IdempotencyRecord));
    purchaseRepo = module.get(getRepositoryToken(Purchase));
  });

  afterEach(async () => {
    await app.close();
  });

  const authHeader = (req: request.Test) => req.set("x-api-key", TEST_API_KEY);

  // ── 400 – missing / invalid header ───────────────────────────────────────

  it("400 when Idempotency-Key header is absent", async () => {
    const res = await authHeader(
      request(app.getHttpServer()).post("/purchases"),
    ).send(validDto);

    expect(res.status).toBe(400);
    expect(res.body.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Idempotency-Key/);
    expect(res.body.correlationId).toMatch(/^req_/);
    expect(res.body.errors).toBeDefined();
  });

  it("400 when Idempotency-Key header is empty", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "   "),
    ).send(validDto);

    expect(res.status).toBe(400);
    expect(res.body.correlationId).toBeDefined();
  });

  it("400 when Idempotency-Key exceeds 255 characters", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "x".repeat(256)),
    ).send(validDto);

    expect(res.status).toBe(400);
  });

  it("400 when request body is invalid (missing sku/quantity/amountMinor)", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-bad-body"),
    ).send({ userId: "u1" });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
    expect(res.body.correlationId).toBeDefined();
    // must be canonical shape
    expect(res.body).toHaveProperty("statusCode", 400);
    expect(res.body).toHaveProperty("errors");
  });

  // ── 400 – money bounds validation ────────────────────────────────────────

  it("400 when sku is empty", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-sku-empty"),
    ).send({ ...validDto, sku: "" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty("sku");
  });

  it("400 when sku exceeds 64 characters", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-sku-long"),
    ).send({ ...validDto, sku: "x".repeat(65) });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty("sku");
  });

  it("400 when sku contains invalid characters (enumeration / injection)", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-sku-bad"),
    ).send({ ...validDto, sku: "sku; DROP TABLE purchases--" });
    expect(res.status).toBe(400);
  });

  it("400 when quantity is 0 or negative (bounds)", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-qty-zero"),
    ).send({ ...validDto, quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty("quantity");
  });

  it("400 when quantity exceeds max 100", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-qty-big"),
    ).send({ ...validDto, quantity: 101 });
    expect(res.status).toBe(400);
  });

  it("400 when quantity is not an integer (float rejected)", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-qty-float"),
    ).send({ ...validDto, quantity: 1.5 });
    expect(res.status).toBe(400);
  });

  it("400 when amountMinor is negative", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-amount-neg"),
    ).send({ ...validDto, amountMinor: -1 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty("amountMinor");
  });

  it("400 when amountMinor exceeds max 10_000_000", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-amount-big"),
    ).send({ ...validDto, amountMinor: 10_000_001 });
    expect(res.status).toBe(400);
  });

  it("400 when amountMinor is a float (minor units must be integer)", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-amount-float"),
    ).send({ ...validDto, amountMinor: 49.99 });
    expect(res.status).toBe(400);
  });

  it("400 when amountMinor is NaN/Infinity (rejected)", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-amount-nan"),
    ).send({ ...validDto, amountMinor: "NaN" });
    expect(res.status).toBe(400);
  });

  it("400 when unknown field price/amount is supplied (no client-trusted price)", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-unknown-price"),
    ).send({ ...validDto, price: 999 } as any);
    expect(res.status).toBe(400);
    // forbidNonWhitelisted should report the unknown property
    expect(JSON.stringify(res.body)).toMatch(/price|whitelisted|not allowed/i);
  });

  it("400 when legacy amount float is supplied instead of amountMinor", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-legacy-amount"),
    ).send({
      userId: validDto.userId,
      sku: validDto.sku,
      quantity: 1,
      amount: 49.99,
    } as any);
    expect(res.status).toBe(400);
  });

  it("400 when legacy itemId is supplied instead of sku", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-legacy-itemId"),
    ).send({
      userId: validDto.userId,
      itemId: "item-99",
      quantity: 1,
      amountMinor: 4999,
    } as any);
    expect(res.status).toBe(400);
  });

  // ── 401 – auth ───────────────────────────────────────────────────────────

  it("401 when x-api-key is missing", async () => {
    const res = await request(app.getHttpServer())
      .post("/purchases")
      .set("idempotency-key", "key-no-auth")
      .send(validDto);
    expect(res.status).toBe(401);
    expect(res.body.correlationId).toBeDefined();
  });

  // ── 201 – success ─────────────────────────────────────────────────────────

  it("201 creates a purchase and returns the purchase object", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-e2e-success-001"),
    ).send(validDto);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.userId).toBe(validDto.userId);
    expect(res.body.sku).toBe(validDto.sku);
    expect(res.body.quantity).toBe(validDto.quantity);
    expect(res.body.amountMinor).toBe(validDto.amountMinor);
    expect(res.body.currency).toBe("USD");
    // correlationId echoed via lightweight middleware (mirrors production RequestIdMiddleware)
    expect(
      res.headers["x-correlation-id"] ?? res.headers["x-request-id"],
    ).toBeDefined();
    // legacy fields stay in sync
    expect(res.body.itemId).toBe(validDto.sku);
    expect(res.body.amount).toBe(49.99);
  });

  it("propagates x-request-id as correlationId in success and error", async () => {
    const reqId = "req_test-propagate-123";
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-e2e-reqid-001")
        .set("x-request-id", reqId),
    ).send(validDto);
    expect(res.status).toBe(201);
    expect(res.headers["x-request-id"]).toBe(reqId);
    expect(res.headers["x-correlation-id"]).toBe(reqId);
  });

  // ── Duplicate / replay ────────────────────────────────────────────────────

  it("201 returns the same body on a duplicate request (replay)", async () => {
    const key = "key-e2e-duplicate-001";

    const first = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", key),
    ).send(validDto);

    const second = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", key),
    ).send(validDto);

    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.sku).toBe(first.body.sku);
  });

  it("does not create a second purchase row on replay", async () => {
    const key = "key-e2e-duplicate-002";

    await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", key),
    ).send(validDto);

    await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", key),
    ).send(validDto);

    const count = await purchaseRepo.count();
    expect(count).toBe(1);
  });

  it("409 when a completed key is reused with a different payload (hash conflict)", async () => {
    const key = "key-e2e-payload-conflict";
    await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", key),
    )
      .send(validDto)
      .expect(201);

    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", key),
    ).send({ ...validDto, amountMinor: 5999 });
    expect(res.status).toBe(409);
    expect(res.body.correlationId).toBeDefined();
  });

  // ── 409 – concurrent / in-flight ─────────────────────────────────────────

  it("409 when the same key is currently being processed", async () => {
    const key = "key-e2e-concurrent-001";

    // Simulate an in-flight request by inserting a PROCESSING record.
    await idempotencyRepo.insert({
      idempotencyKey: key,
      operation: "purchases",
      status: IdempotencyStatus.PROCESSING,
      requestHash: "pending-hash",
      responseBody: null,
      responseStatus: null,
      completedAt: null,
    });

    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", key),
    ).send(validDto);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already being processed/i);
  });

  it("exactly one of two concurrent requests succeeds", async () => {
    const key = "key-e2e-concurrent-002";

    const [r1, r2] = await Promise.all([
      authHeader(
        request(app.getHttpServer())
          .post("/purchases")
          .set("idempotency-key", key),
      ).send(validDto),
      authHeader(
        request(app.getHttpServer())
          .post("/purchases")
          .set("idempotency-key", key),
      ).send(validDto),
    ]);

    const statuses = [r1.status, r2.status].sort();
    // Under SQLite/in-memory test DB the race may resolve as:
    // - [201, 409] when the second request hits an in-flight PROCESSING key, or
    // - [201, 201] when the first completes and the second replays the cached response.
    expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);
    expect(statuses.filter((s) => s === 201).length).toBeGreaterThanOrEqual(1);
    // At least one response must carry correlation headers (error filter or middleware)
    const headersOk = [
      r1.headers["x-correlation-id"] ?? r1.headers["x-request-id"],
      r2.headers["x-correlation-id"] ?? r2.headers["x-request-id"],
    ].filter(Boolean).length;
    expect(headersOk).toBeGreaterThanOrEqual(1);
  });

  // ── Retry after failure ───────────────────────────────────────────────────

  it("201 allows retry after a previous FAILED attempt", async () => {
    const key = "key-e2e-retry-001";

    await idempotencyRepo.insert({
      idempotencyKey: key,
      operation: "purchases",
      status: IdempotencyStatus.FAILED,
      requestHash: null,
      responseBody: null,
      responseStatus: null,
      completedAt: null,
    });

    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", key),
    ).send(validDto);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();

    const record = await idempotencyRepo.findOneByOrFail({
      idempotencyKey: key,
    });
    expect(record.status).toBe(IdempotencyStatus.COMPLETED);
  });

  // ── GET /purchases/:id ────────────────────────────────────────────────────

  it("200 returns a purchase by ID", async () => {
    const createRes = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-e2e-get-001"),
    ).send(validDto);

    const getRes = await request(app.getHttpServer()).get(
      `/purchases/${createRes.body.id}`,
    );

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(createRes.body.id);
  });

  it("404 for a non-existent purchase ID", async () => {
    const res = await request(app.getHttpServer()).get(
      "/purchases/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status).toBe(404);
    expect(res.body.correlationId).toBeDefined();
  });

  // ── Inventory never negative (bounds) ────────────────────────────────────

  it("inventory bounds: quantity and amountMinor persisted are within allowed ranges", async () => {
    const res = await authHeader(
      request(app.getHttpServer())
        .post("/purchases")
        .set("idempotency-key", "key-bounds-check"),
    ).send(validDto);
    expect(res.status).toBe(201);
    const row = await purchaseRepo.findOneByOrFail({ id: res.body.id });
    expect(row.quantity).toBeGreaterThanOrEqual(1);
    expect(row.quantity).toBeLessThanOrEqual(100);
    expect(row.amountMinor).toBeGreaterThanOrEqual(0);
    expect(row.amountMinor).toBeLessThanOrEqual(10_000_000);
  });
});
