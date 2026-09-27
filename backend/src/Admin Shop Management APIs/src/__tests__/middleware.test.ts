import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, requireAdmin } from '../middleware/auth';

describe('Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', () => {
      const token = jwt.sign(
        { id: '1', username: 'admin', role: 'admin' },
        process.env.JWT_SECRET || 'secret',
      );

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).user).toBeDefined();
    });

    it('should reject missing token', () => {
      authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject invalid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin users', () => {
      (mockRequest as any).user = {
        id: '1',
        username: 'admin',
        role: 'admin',
      };

      requireAdmin(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should reject non-admin users', () => {
      (mockRequest as any).user = {
        id: '2',
        username: 'user',
        role: 'user',
      };

      requireAdmin(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject missing user', () => {
      requireAdmin(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
});
