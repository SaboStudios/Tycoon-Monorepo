import { INestApplication, Controller, Get, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import * as request from "supertest";
import { RequestIdMiddleware, isValidRequestId } from "./request-id.middleware";
import { HttpExceptionFilter } from "../filters/http-exception.filter";
import { StructuredLoggerService } from "../logger/structured-logger.service";

interface MockRequest {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
}

interface MockResponse {
  headers: Record<string, string>;
  setHeader(name: string, value: string): void;
}

function createRequest(headers: Record<string, string | string[] | undefined> = {}): MockRequest {
  return { headers };
}

function createResponse(): MockResponse {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader(name: string, value: string): void {
      headers[name.toLowerCase()] = value;
    },
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('reuses a valid inbound x-request-id verbatim and echoes it', () => {
    const req = createRequest({ 'x-request-id': 'abc-123_XYZ.~' });
    const res = createResponse();
    const next = jest.fn();

    middleware.use(req as never, res as never, next);

    expect(req.requestId).toBe('abc-123_XYZ.~');
    expect(res.headers['x-request-id']).toBe('abc-123_XYZ.~');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a new id when the inbound header is missing and echoes it', () => {
    const req = createRequest();
    const res = createResponse();
    const next = jest.fn();

    middleware.use(req as never, res as never, next);

    expect(req.requestId).toMatch(UUID_PATTERN);
    expect(res.headers['x-request-id']).toBe(req.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects an over-long inbound header and replaces it with a generated id', () => {
    const req = createRequest({ 'x-request-id': 'a'.repeat(129) });
    const res = createResponse();

    middleware.use(req as never, res as never, jest.fn());

    expect(req.requestId).toMatch(UUID_PATTERN);
    expect(req.requestId).not.toBe('a'.repeat(129));
    expect(res.headers['x-request-id']).toBe(req.requestId);
  });

  it('rejects a newline-containing inbound header and replaces it with a generated id', () => {
    const req = createRequest({ 'x-request-id': 'abc\r\nInjected: 1' });
    const res = createResponse();

    middleware.use(req as never, res as never, jest.fn());

    expect(req.requestId).toMatch(UUID_PATTERN);
    expect(req.requestId).not.toContain('\n');
    expect(res.headers['x-request-id']).toBe(req.requestId);
  });

  it('rejects an empty inbound header and replaces it with a generated id', () => {
    const req = createRequest({ 'x-request-id': '' });
    const res = createResponse();

    middleware.use(req as never, res as never, jest.fn());

    expect(req.requestId).toMatch(UUID_PATTERN);
    expect(res.headers['x-request-id']).toBe(req.requestId);
  });

  describe('isValidRequestId', () => {
    it('accepts well-formed ids', () => {
      expect(isValidRequestId('abc-123_XYZ.~')).toBe(true);
    });

    it('rejects non-strings, empty, over-long, and unsafe values', () => {
      expect(isValidRequestId(undefined)).toBe(false);
      expect(isValidRequestId(123)).toBe(false);
      expect(isValidRequestId('')).toBe(false);
      expect(isValidRequestId('a'.repeat(129))).toBe(false);
      expect(isValidRequestId('bad\nvalue')).toBe(false);
      expect(isValidRequestId('bad value')).toBe(false);
    });
  });
});

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
  });
});
