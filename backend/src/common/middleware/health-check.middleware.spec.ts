import { HealthCheckMiddleware } from './health-check.middleware';
import { Request, Response } from 'express';

function buildRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('HealthCheckMiddleware', () => {
  let middleware: HealthCheckMiddleware;
  const next = jest.fn();

  beforeEach(() => {
    middleware = new HealthCheckMiddleware();
    jest.clearAllMocks();
  });

  it('skips non-status health paths', async () => {
    const req = { path: '/health/live' } as Request;
    const res = buildRes();

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns healthy status for /health/status', async () => {
    const req = { path: '/health/status' } as Request;
    const res = buildRes();

    await middleware.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'healthy',
        service: 'tycoon-backend',
      }),
    );
  });
});
