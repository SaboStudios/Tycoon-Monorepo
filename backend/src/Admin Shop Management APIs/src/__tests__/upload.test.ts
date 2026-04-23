import request from 'supertest';
import app from '../app';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { shopService } from '../services/shopService';

const adminToken = jwt.sign(
  { id: '1', username: 'admin', role: 'admin' },
  process.env.JWT_SECRET || 'secret',
);

describe('Image Upload', () => {
  let testImagePath: string;

  beforeAll(() => {
    // Create a test image file
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    testImagePath = path.join(__dirname, 'test-image.jpg');
    // Create a minimal valid JPEG file
    const jpegHeader = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
    ]);
    fs.writeFileSync(testImagePath, jpegHeader);
  });

  afterAll(() => {
    // Clean up test image
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  beforeEach(() => {
    shopService.clearAll();
  });

  describe('POST /api/shop/:id/images', () => {
    it('should upload images successfully', async () => {
      const item = shopService.createItem({
        name: 'Test Item',
        description: 'Test',
        price: 50,
        isActive: true,
        images: [],
      });

      const response = await request(app)
        .post(`/api/shop/${item.id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('images', testImagePath);

      expect(response.status).toBe(200);
      expect(response.body.images).toHaveLength(1);
    });

    it('should handle non-existent item', async () => {
      const response = await request(app)
        .post('/api/shop/999/images')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('images', testImagePath);

      expect(response.status).toBe(404);
    });
  });
});
