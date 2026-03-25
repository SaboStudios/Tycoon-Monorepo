import request from 'supertest';
import app from '../app';

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
});
