import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Minimal mock of Express Response sufficient for the controller methods. */
function makeResponse() {
  const res = {
    _status: 0,
    _body: undefined as unknown,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
  };
  return res;
}

describe('HealthController (issue #1934)', () => {
  let controller: HealthController;
  const mockQuery = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: getDataSourceToken(),
          useValue: { query: mockQuery },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    mockQuery.mockReset();
  });

  describe('GET /health — liveness', () => {
    it('returns status "ok" with uptime and timestamp', () => {
      const result = controller.liveness() as Record<string, unknown>;
      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('GET /ready — readiness', () => {
    it('returns HTTP 200 with ok payload when DataSource.query resolves', async () => {
      mockQuery.mockResolvedValue([{ '?column?': 1 }]);
      const res = makeResponse();

      await controller.readiness(res as never);

      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
      expect(res._status).toBe(HttpStatus.OK);
      expect((res._body as Record<string, string>).status).toBe('ok');
      expect((res._body as Record<string, string>).database).toBe('up');
    });

    it('returns HTTP 503 with error payload when DataSource.query rejects', async () => {
      mockQuery.mockRejectedValue(new Error('Connection refused'));
      const res = makeResponse();

      await controller.readiness(res as never);

      expect(res._status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect((res._body as Record<string, string>).status).toBe('error');
      expect((res._body as Record<string, string>).database).toBe('down');
    });
  });
});
