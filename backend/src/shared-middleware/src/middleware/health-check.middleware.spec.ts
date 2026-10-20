import { NextFunction, Request, Response } from 'express';
import { HealthCheckMiddleware } from './health-check.middleware';

describe('HealthCheckMiddleware', () => {
  let middleware: HealthCheckMiddleware;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    middleware = new HealthCheckMiddleware();
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('responds with a 200 ok', () => {
    middleware.use(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }));
  });
});
