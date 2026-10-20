import { NextFunction, Request, Response } from 'express';
import { ErrorHandlerMiddleware } from './error-handler.middleware';
import { ErrorResponse } from '../types/error-response.type';

describe('ErrorHandlerMiddleware', () => {
  let middleware: ErrorHandlerMiddleware;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    middleware = new ErrorHandlerMiddleware();
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('returns the ErrorResponse shape without leaking internals', () => {
    const error = new Error('internal database failure');

    middleware.use(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledTimes(1);

    const body = (res.json as jest.Mock).mock.calls[0][0] as ErrorResponse;
    expect(body).toEqual(
      expect.objectContaining({
        statusCode: 500,
        message: expect.any(String),
      }),
    );
    expect(body).not.toHaveProperty('stack');
    expect(JSON.stringify(body)).not.toContain('internal database failure');
  });
});
