import request from 'supertest';
import { NextFunction, Response } from 'express';
import app from '../app';
import { authenticateToken, AuthRequest } from '../middleware/auth';

describe('Authentication', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid admin credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        username: 'admin',
        password: 'admin123',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.role).toBe('admin');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        username: 'admin',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app).post('/api/auth/login').send({
        username: 'admin',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('authenticateToken', () => {
    it('should return 401 with the required-token error when the authorization header is missing', () => {
      const req = { headers: {} } as AuthRequest;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as unknown as Response & { status: jest.Mock; json: jest.Mock };
      const next = jest.fn() as unknown as NextFunction;

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
