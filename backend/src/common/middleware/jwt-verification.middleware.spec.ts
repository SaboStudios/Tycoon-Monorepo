import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwtVerificationMiddleware } from './jwt-verification.middleware';
import { Request, Response } from 'express';

const mockConfigService = {
  get: jest.fn().mockReturnValue('test-secret'),
};

describe('JwtVerificationMiddleware', () => {
  let middleware: JwtVerificationMiddleware;
  const next = jest.fn();

  beforeEach(() => {
    middleware = new JwtVerificationMiddleware(
      mockConfigService as unknown as ConfigService,
    );
    jest.clearAllMocks();
  });

  it('calls next with UnauthorizedException when no token is provided', () => {
    const req = { headers: {} } as Request;
    const res = {} as Response;

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
  });

  it('attaches decoded user and calls next for a valid token', () => {
    const token = jwt.sign({ sub: 'user-1' }, 'test-secret');
    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as Request & { user?: unknown };
    const res = {} as Response;

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual(expect.objectContaining({ sub: 'user-1' }));
  });

  it('calls next with UnauthorizedException for an invalid token', () => {
    const req = {
      headers: { authorization: 'Bearer invalid-token' },
    } as Request;
    const res = {} as Response;

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedException));
  });
});
