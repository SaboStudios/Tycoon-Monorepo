import request from 'supertest';
import app from '../app';
import { shopService } from '../services/shopService';
import jwt from 'jsonwebtoken';

const adminToken = jwt.sign(
  { id: '1', username: 'admin', role: 'admin' },
  process.env.JWT_SECRET || 'secret',
);

const userToken = jwt.sign(
  { id: '2', username: 'user', role: 'user' },
  process.env.JWT_SECRET || 'secret',
);

describe('Shop Item CRUD', () => {
  beforeEach(() => {
    shopService.clearAll();
  });

  describe('POST /api/shop - Create Item', () => {
    it('should create item as admin', async () => {
      const response = await request(app)
        .post('/api/shop')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Item',
          description: 'Test Description',
          price: 99.99,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Item');
      expect(response.body.price).toBe(99.99);
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .post('/api/shop')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Item',
          description: 'Test Description',
          price: 99.99,
        });

      expect(response.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app).post('/api/shop').send({
        name: 'Test Item',
        description: 'Test Description',
        price: 99.99,
      });

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/shop')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Item',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/shop - Get Items', () => {
    beforeEach(async () => {
      shopService.createItem({
        name: 'Active Item',
        description: 'Active',
        price: 50,
        isActive: true,
        images: [],
      });
      shopService.createItem({
        name: 'Inactive Item',
        description: 'Inactive',
        price: 30,
        isActive: false,
        images: [],
      });
    });

    it('should get all items', async () => {
      const response = await request(app).get('/api/shop');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should get only active items', async () => {
      const response = await request(app).get('/api/shop?active=true');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].isActive).toBe(true);
    });
  });

  describe('GET /api/shop/:id - Get Item by ID', () => {
    it('should get item by id', async () => {
      const item = shopService.createItem({
        name: 'Test Item',
        description: 'Test',
        price: 100,
        isActive: true,
        images: [],
      });

      const response = await request(app).get(`/api/shop/${item.id}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(item.id);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app).get('/api/shop/999');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/shop/:id - Update Item', () => {
    it('should update item as admin', async () => {
      const item = shopService.createItem({
        name: 'Old Name',
        description: 'Old Description',
        price: 50,
        isActive: true,
        images: [],
      });

      const response = await request(app)
        .put(`/api/shop/${item.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Name',
          price: 75,
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Name');
      expect(response.body.price).toBe(75);
    });

    it('should reject non-admin users', async () => {
      const item = shopService.createItem({
        name: 'Test',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });

      const response = await request(app)
        .put(`/api/shop/${item.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/shop/:id/price - Update Price', () => {
    it('should update price as admin', async () => {
      const item = shopService.createItem({
        name: 'Test',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });

      const response = await request(app)
        .patch(`/api/shop/${item.id}/price`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 99.99 });

      expect(response.status).toBe(200);
      expect(response.body.price).toBe(99.99);
    });

    it('should validate price field', async () => {
      const item = shopService.createItem({
        name: 'Test',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });

      const response = await request(app)
        .patch(`/api/shop/${item.id}/price`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/shop/:id/status - Activate/Deactivate', () => {
    it('should deactivate item as admin', async () => {
      const item = shopService.createItem({
        name: 'Test',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });

      const response = await request(app)
        .patch(`/api/shop/${item.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(false);
    });

    it('should activate item as admin', async () => {
      const item = shopService.createItem({
        name: 'Test',
        description: 'Test',
        price: 50,
        isActive: false,
        images: [],
      });

      const response = await request(app)
        .patch(`/api/shop/${item.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true });

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(true);
    });
  });

  describe('POST /api/shop/bulk/update - Bulk Update', () => {
    it('should bulk update items as admin', async () => {
      const item1 = shopService.createItem({
        name: 'Item 1',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });
      const item2 = shopService.createItem({
        name: 'Item 2',
        description: 'Test',
        price: 60,
        isActive: true,
        images: [],
      });

      const response = await request(app)
        .post('/api/shop/bulk/update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          updates: [
            { id: item1.id, data: { price: 100 } },
            { id: item2.id, data: { price: 200 } },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.updated).toBe(2);
      expect(response.body.items[0].price).toBe(100);
      expect(response.body.items[1].price).toBe(200);
    });

    it('should validate updates array', async () => {
      const response = await request(app)
        .post('/api/shop/bulk/update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ updates: 'invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/shop/:id - Delete Item', () => {
    it('should delete item as admin', async () => {
      const item = shopService.createItem({
        name: 'Test',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });

      const response = await request(app)
        .delete(`/api/shop/${item.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(204);

      const getResponse = await request(app).get(`/api/shop/${item.id}`);
      expect(getResponse.status).toBe(404);
    });

    it('should reject non-admin users', async () => {
      const item = shopService.createItem({
        name: 'Test',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });

      const response = await request(app)
        .delete(`/api/shop/${item.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });
});
