import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app';
import { shopService } from '../services/shopService';

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

  // ---------------------------------------------------------------------------
  // POST /api/shop — Create Item
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // GET /api/shop — Get Items (filtering)
  // ---------------------------------------------------------------------------

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

    it('should return paginated result with all items', async () => {
      const response = await request(app).get('/api/shop');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('totalPages');
    });

    it('should return only active items when active=true', async () => {
      const response = await request(app).get('/api/shop?active=true');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].isActive).toBe(true);
      expect(response.body.total).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/shop — pagination query params
  // ---------------------------------------------------------------------------

  describe('GET /api/shop - Pagination', () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        shopService.createItem({
          name: `Item ${i}`,
          description: 'Test',
          price: i * 10,
          isActive: true,
          images: [],
        });
      }
    });

    it('should return correct page metadata', async () => {
      const response = await request(app).get('/api/shop?page=1&limit=2');

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);
      expect(response.body.total).toBe(5);
      expect(response.body.totalPages).toBe(3);
      expect(response.body.items).toHaveLength(2);
    });

    it('should return the correct slice for page 2', async () => {
      const page1 = await request(app).get('/api/shop?page=1&limit=2&sortBy=price&sortOrder=asc');
      const page2 = await request(app).get('/api/shop?page=2&limit=2&sortBy=price&sortOrder=asc');

      expect(page1.body.items[0].price).toBe(10);
      expect(page2.body.items[0].price).toBe(30);
    });

    it('should return an empty items array for an out-of-range page', async () => {
      const response = await request(app).get('/api/shop?page=99&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(0);
      expect(response.body.total).toBe(5);
    });

    it('should clamp an excessive limit to 100', async () => {
      const response = await request(app).get('/api/shop?limit=9999');

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/shop — sorting query params
  // ---------------------------------------------------------------------------

  describe('GET /api/shop - Sorting', () => {
    beforeEach(() => {
      shopService.createItem({
        name: 'Zebra',
        description: 'Test',
        price: 30,
        isActive: true,
        images: [],
      });
      shopService.createItem({
        name: 'Apple',
        description: 'Test',
        price: 10,
        isActive: true,
        images: [],
      });
      shopService.createItem({
        name: 'Mango',
        description: 'Test',
        price: 20,
        isActive: true,
        images: [],
      });
    });

    it('should sort by name ascending', async () => {
      const response = await request(app).get('/api/shop?sortBy=name&sortOrder=asc');

      expect(response.status).toBe(200);
      const names = response.body.items.map((i: any) => i.name);
      expect(names).toEqual(['Apple', 'Mango', 'Zebra']);
    });

    it('should sort by name descending', async () => {
      const response = await request(app).get('/api/shop?sortBy=name&sortOrder=desc');

      expect(response.status).toBe(200);
      const names = response.body.items.map((i: any) => i.name);
      expect(names).toEqual(['Zebra', 'Mango', 'Apple']);
    });

    it('should sort by price ascending', async () => {
      const response = await request(app).get('/api/shop?sortBy=price&sortOrder=asc');

      const prices = response.body.items.map((i: any) => i.price);
      expect(prices).toEqual([10, 20, 30]);
    });

    it('should sort by price descending', async () => {
      const response = await request(app).get('/api/shop?sortBy=price&sortOrder=desc');

      const prices = response.body.items.map((i: any) => i.price);
      expect(prices).toEqual([30, 20, 10]);
    });

    it('should ignore an invalid sortBy value and fall back to createdAt', async () => {
      const response = await request(app).get('/api/shop?sortBy=notafield');

      // Should not error; falls back gracefully
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
    });

    it('should ignore an invalid sortOrder value and fall back to asc', async () => {
      const response = await request(app).get('/api/shop?sortBy=price&sortOrder=random');

      expect(response.status).toBe(200);
      const prices = response.body.items.map((i: any) => i.price);
      expect(prices).toEqual([10, 20, 30]); // asc fallback
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/shop/:id — Get Item by ID
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // PUT /api/shop/:id — Update Item
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // PATCH /api/shop/:id/price — Update Price
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // PATCH /api/shop/:id/status — Activate / Deactivate
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // POST /api/shop/bulk/update — Bulk Update
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // DELETE /api/shop/:id — Delete Item
  // ---------------------------------------------------------------------------

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