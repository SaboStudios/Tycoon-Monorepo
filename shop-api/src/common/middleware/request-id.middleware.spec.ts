import { INestApplication, Controller, Get, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import * as request from "supertest";
import { RequestIdMiddleware } from "./request-id.middleware";
import { HttpExceptionFilter } from "../filters/http-exception.filter";
import { StructuredLoggerService } from "../logger/structured-logger.service";

@Controller("probe")
class ProbeController {
  @Get("ok")
  ok() {
    return { ok: true };
  }

  @Get("boom")
  boom() {
    throw new BadRequestException("Validation failed");
  }
}

@Module({
  controllers: [ProbeController],
  providers: [
    StructuredLoggerService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
class ProbeModule {}

describe("RequestIdMiddleware correlation (issue #1872)", () => {
  let app: INestApplication;
  let logger: StructuredLoggerService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();

    app = moduleRef.createNestApplication();
    logger = app.get(StructuredLoggerService);
    app.use(RequestIdMiddleware);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("echoes an incoming x-request-id header on the response", async () => {
    const incoming = "req_11111111-1111-1111-1111-111111111111";
    const res = await request(app.getHttpServer())
      .get("/probe/ok")
      .set("x-request-id", incoming)
      .expect(200);

    expect(res.headers["x-request-id"]).toBe(incoming);
  });

  it("generates a request id when the header is absent", async () => {
    const res = await request(app.getHttpServer()).get("/probe/ok").expect(200);

    expect(res.headers["x-request-id"]).toBeDefined();
    expect(String(res.headers["x-request-id"]).length).toBeGreaterThan(0);
  });

  it("carries the same id in the HttpExceptionFilter error body", async () => {
    const incoming = "req_22222222-2222-2222-2222-222222222222";
    const res = await request(app.getHttpServer())
      .get("/probe/boom")
      .set("x-request-id", incoming)
      .expect(400);

    expect(res.body.correlationId).toBe(incoming);
    expect(res.headers["x-request-id"]).toBe(incoming);
  });

  it("includes the same id in the structured log entry", async () => {
    const incoming = "req_33333333-3333-3333-3333-333333333333";
    const logSpy = jest.spyOn(logger, "log");

    await request(app.getHttpServer())
      .get("/probe/ok")
      .set("x-request-id", incoming)
      .expect(200);

    const entries = logSpy.mock.calls.map((call) => call[0]);
    const match = entries.find(
      (entry: any) => entry && entry.requestId === incoming,
    );
    expect(match).toBeDefined();
  });
});
