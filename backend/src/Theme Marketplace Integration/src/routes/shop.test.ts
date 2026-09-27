import request from 'supertest';
import { createApp } from '../app';
import { db } from '../database';

const app = createApp();

describe('Shop API Routes', () => {
  beforeEach(() => {
    db.seed();
  });

  describe('POST /shop/purchase', () => {
    it('should purchase theme successfully', async () => {
      const response = await request(app)
        .post('/shop/purchase')
        .send({
          userId: 'user-1',
          themeIds: ['skin-1'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.transaction).toBeDefined();
      expect(response.body.unlockedThemes).toEqual(['skin-1']);
    });

    it('should purchase multiple themes (bulk)', async () => {
      const response = await request(app)
        .post('/shop/purchase')
        .send({
          userId: 'user-1',
          themeIds: ['skin-1', 'board-1', 'board-2'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.unlockedThemes.length).toBe(3);
    });

    it('should apply coupon discount', async () => {
      const response = await request(app)
        .post('/shop/purchase')
        .send({
          userId: 'user-1',
          themeIds: ['skin-1'],
          couponCode: 'WELCOME20',
        });

      expect(response.status).toBe(200);
      expect(response.body.transaction.discountAmount).toBe(100);
      expect(response.body.transaction.finalAmount).toBe(400);
    });

    it('should return 400 for missing userId', async () => {
      const response = await request(app)
        .post('/shop/purchase')
        .send({
          themeIds: ['skin-1'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for empty themeIds', async () => {
      const response = await request(app).post('/shop/purchase').send({
        userId: 'user-1',
        themeIds: [],
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for invalid user', async () => {
      const response = await request(app)
        .post('/shop/purchase')
        .send({
          userId: 'invalid-user',
          themeIds: ['skin-1'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 400 for insufficient balance', async () => {
      db.updateUser('user-1', { balance: 10 });

      const response = await request(app)
        .post('/shop/purchase')
        .send({
          userId: 'user-1',
          themeIds: ['skin-1'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Insufficient balance');
    });
  });

  describe('GET /shop/themes', () => {
    it('should return all themes', async () => {
      const response = await request(app).get('/shop/themes');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.themes).toBeDefined();
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should filter themes by type - skin', async () => {
      const response = await request(app).get('/shop/themes?type=skin');

      expect(response.status).toBe(200);
      expect(response.body.themes.every((t: any) => t.type === 'skin')).toBe(
        true,
      );
    });

    it('should filter themes by type - board', async () => {
      const response = await request(app).get('/shop/themes?type=board');

      expect(response.status).toBe(200);
      expect(response.body.themes.every((t: any) => t.type === 'board')).toBe(
        true,
      );
    });

    it('should return 400 for invalid type', async () => {
      const response = await request(app).get('/shop/themes?type=invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /shop/transactions/:userId', () => {
    it('should return user transactions', async () => {
      // Make a purchase first
      await request(app)
        .post('/shop/purchase')
        .send({
          userId: 'user-1',
          themeIds: ['skin-1'],
        });

      const response = await request(app).get('/shop/transactions/user-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.transactions).toBeDefined();
      expect(response.body.count).toBe(1);
    });

    it('should return empty array for user with no transactions', async () => {
      const response = await request(app).get('/shop/transactions/user-2');

      expect(response.status).toBe(200);
      expect(response.body.transactions).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });
});
