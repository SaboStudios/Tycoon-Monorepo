import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppModule } from "../src/app.module";
import { AppLogger } from "../src/logger/app-logger.service";
import { User } from "../src/users/entities/user.entity";
import { AuditLog } from "../src/users/entities/audit-log.entity";
import { REQUEST_ID_HEADER } from "../src/logger/correlation-id.middleware";

describe("Correlation ID / Logging (e2e)", () => {
  let app: INestApplication;
  let logger: AppLogger;
  const logLines: Array<{ level: string; message: string; requestId?: string }> =
    [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "postgres",
          host: process.env.DB_HOST || "localhost",
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USERNAME || "postgres",
          password: process.env.DB_PASSWORD || "postgres",
          database: process.env.DB_NAME || "test_db",
          entities: [User, AuditLog],
          synchronize: false,
        }),
        AppModule,
      ],
    })
      .overrideProvider(AppLogger)
      .useValue({
        log: (msg: string, ctx?: string) =>
          logLines.push({ level: "info", message: msg }),
        error: (msg: string) => logLines.push({ level: "error", message: msg }),
        warn: (msg: string) => logLines.push({ level: "warn", message: msg }),
        debug: () => {},
        verbose: () => {},
      })
      .compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });
    logger = moduleFixture.get(AppLogger);
    app.useLogger(logger);
    await app.init();
  });

  afterAll(() => app.close());

  describe("x-request-id header", () => {
    it("echoes back a supplied x-request-id", async () => {
      const id = "test-correlation-id-123";
      const res = await request(app.getHttpServer())
        .get("/health")
        .set(REQUEST_ID_HEADER, id);

      expect(res.headers[REQUEST_ID_HEADER]).toBe(id);
    });

    it("generates a uuid x-request-id when none supplied", async () => {
      const res = await request(app.getHttpServer()).get("/health");
      const id = res.headers[REQUEST_ID_HEADER];

      expect(id).toBeDefined();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("uses different ids for concurrent requests", async () => {
      const [r1, r2] = await Promise.all([
        request(app.getHttpServer()).get("/health"),
        request(app.getHttpServer()).get("/health"),
      ]);
      expect(r1.headers[REQUEST_ID_HEADER]).not.toBe(
        r2.headers[REQUEST_ID_HEADER],
      );
    });
  });

  describe("PII scrubbing", () => {
    it("redacts password fields in log metadata", () => {
      // Import scrub indirectly by checking AppLogger behaviour
      const captured: unknown[] = [];
      const spy = jest
        .spyOn(logger, "log")
        .mockImplementation((msg: unknown) => {
          captured.push(msg);
        });

      logger.log(
        JSON.stringify({ user: "admin", password: "secret123" }),
        "TestContext",
      );

      spy.mockRestore();
      // The raw call receives the message — scrubbing happens inside write()
      // Verify the scrub function directly via the service
      expect(captured[0]).not.toContain("secret123");
    });

    it("masks email addresses in log output", async () => {
      const { scrubForTest } = await import("../src/logger/app-logger.service");
      const result = scrubForTest({ email: "john.doe@example.com" });
      expect((result as Record<string, string>).email).toMatch(/\*\*\*/);
      expect((result as Record<string, string>).email).not.toContain(
        "john.doe",
      );
    });
  });

  describe("Single request trace across log lines (log aggregator mock)", () => {
    it("all log lines for a request share the same requestId", async () => {
      const capturedEntries: Array<{ requestId?: string }> = [];

      // Replace logger with a capturing spy
      const realLogger = new AppLogger();
      const writeSpy = jest
        .spyOn(realLogger as unknown as { write: (...a: unknown[]) => void }, "write" as never)
        .mockImplementation((...args: unknown[]) => {
          // args: [level, message, context, meta]
          const meta = args[3] as Record<string, unknown> | undefined;
          capturedEntries.push({ requestId: meta?.requestId as string });
        });

      const correlationId = "trace-test-" + Date.now();

      // Simulate two log calls within the same CLS context
      const { clsNamespace, setRequestId } = await import(
        "../src/logger/correlation.context"
      );

      await new Promise<void>((resolve) => {
        clsNamespace.run(() => {
          setRequestId(correlationId);
          realLogger.log("first log line", "TestCtx");
          realLogger.warn("second log line", "TestCtx");
          realLogger.error("third log line", undefined, "TestCtx");
          resolve();
        });
      });

      writeSpy.mockRestore();

      expect(capturedEntries.length).toBe(3);
      capturedEntries.forEach((entry) => {
        expect(entry.requestId).toBe(correlationId);
      });
    });
  });
});
