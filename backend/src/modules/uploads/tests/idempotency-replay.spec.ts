import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { UploadsModule } from '../uploads.module';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

describe('Uploads Idempotency and Replay Tests', () => {
  let app: INestApplication;
  let idempotencyService: IdempotencyService;
  let redis: Redis;

  beforeAll(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config = {
          'REDIS_HOST': 'localhost',
          'REDIS_PORT': 6379,
          'REDIS_PASSWORD': null,
          'upload.s3Bucket': null,
          'upload.localUploadDir': './test-uploads',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [UploadsModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();

    app = module.createNestApplication();
    idempotencyService = module.get<IdempotencyService>(IdempotencyService);
    redis = (idempotencyService as any).redis;

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear Redis before each test
    await redis.flushall();
  });

  describe('Idempotency Tests', () => {
    it('should return same response for identical requests with same idempotency key', async () => {
      const idempotencyKey = 'test-key-' + Date.now();
      const testFile = Buffer.from('test file content');

      // First request
      const firstResponse = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'test.txt')
        .expect(201);

      // Second request with same key
      const secondResponse = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'test.txt')
        .expect(200); // Should be 200 for replayed response

      expect(secondResponse.body).toEqual(firstResponse.body);
      expect(secondResponse.headers['x-idempotent-replayed']).toBe('true');
    });

    it('should reject requests with same idempotency key but different content', async () => {
      const idempotencyKey = 'test-key-' + Date.now();
      const testFile1 = Buffer.from('test file content 1');
      const testFile2 = Buffer.from('test file content 2');

      // First request
      await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile1, 'test.txt')
        .expect(201);

      // Second request with same key but different content
      await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile2, 'test.txt')
        .expect(409)
        .expect((res) => {
          expect(res.body.error).toBe('IDEMPOTENCY_MISMATCH');
        });
    });

    it('should handle idempotency for PUT requests', async () => {
      const idempotencyKey = 'put-key-' + Date.now();

      // First PUT request
      const firstResponse = await request(app.getHttpServer())
        .put('/uploads/signed-url')
        .set('X-Idempotency-Key', idempotencyKey)
        .send({ key: 'test-key' })
        .expect(200);

      // Second PUT request with same key
      const secondResponse = await request(app.getHttpServer())
        .put('/uploads/signed-url')
        .set('X-Idempotency-Key', idempotencyKey)
        .send({ key: 'test-key' })
        .expect(200);

      expect(secondResponse.body).toEqual(firstResponse.body);
      expect(secondResponse.headers['x-idempotent-replayed']).toBe('true');
    });

    it('should not apply idempotency to GET requests without explicit key', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/uploads/signed-url?key=test')
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/uploads/signed-url?key=test')
        .expect(200);

      // GET requests should not have idempotency headers unless explicitly set
      expect(response1.headers['x-idempotent']).toBeUndefined();
      expect(response2.headers['x-idempotent']).toBeUndefined();
    });

    it('should respect TTL for idempotency keys', async () => {
      const idempotencyKey = 'ttl-key-' + Date.now();
      const testFile = Buffer.from('test file content');

      // Create a custom idempotency service with short TTL for testing
      const customOptions = { ttl: 1 }; // 1 second TTL

      // First request
      await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'test.txt')
        .expect(201);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second request after TTL expiration should be processed as new
      const response = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'test.txt')
        .expect(201);

      expect(response.headers['x-idempotent']).toBe('true');
      expect(response.headers['x-idempotent-replayed']).toBeUndefined();
    });
  });

  describe('Replay Tests', () => {
    it('should replay successful upload responses', async () => {
      const idempotencyKey = 'replay-success-' + Date.now();
      const testFile = Buffer.from('replay test content');

      // Original request
      const originalResponse = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'replay.txt')
        .expect(201);

      // Replay request
      const replayResponse = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'replay.txt')
        .expect(200);

      expect(replayResponse.body).toEqual(originalResponse.body);
      expect(replayResponse.headers['x-idempotent-replayed']).toBe('true');
      expect(replayResponse.status).toBe(originalResponse.status);
    });

    it('should replay error responses', async () => {
      const idempotencyKey = 'replay-error-' + Date.now();
      const largeFile = Buffer.alloc(10 * 1024 * 1024); // 10MB file (should exceed limit)

      // Original request that should fail
      const originalResponse = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', largeFile, 'large.txt')
        .expect(413);

      // Replay request
      const replayResponse = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', largeFile, 'large.txt')
        .expect(413);

      expect(replayResponse.body).toEqual(originalResponse.body);
      expect(replayResponse.headers['x-idempotent-replayed']).toBe('true');
    });

    it('should preserve response headers in replay', async () => {
      const idempotencyKey = 'replay-headers-' + Date.now();
      const testFile = Buffer.from('header test content');

      // Original request
      const originalResponse = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'headers.txt')
        .expect(201);

      // Replay request
      const replayResponse = await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'headers.txt')
        .expect(200);

      // Check that important headers are preserved
      const importantHeaders = ['content-type', 'content-length'];
      importantHeaders.forEach(header => {
        if (originalResponse.headers[header]) {
          expect(replayResponse.headers[header]).toBe(originalResponse.headers[header]);
        }
      });

      expect(replayResponse.headers['x-idempotent-replayed']).toBe('true');
    });

    it('should handle large response bodies correctly', async () => {
      const idempotencyKey = 'replay-large-' + Date.now();
      
      // Create a response that's close to the size limit
      const largeResponse = {
        data: 'x'.repeat(900 * 1024), // ~900KB response
        metadata: {
          size: 900 * 1024,
          type: 'large-response',
        },
      };

      // Mock a controller method that returns large response
      // This would require setting up a test endpoint
      // For now, we'll test the idempotency service directly
      
      const mockRequest = {
        method: 'POST',
        path: '/test-large',
        headers: { 'x-idempotency-key': idempotencyKey },
        body: { test: 'data' },
      } as any;

      const mockResponse = {
        statusCode: 200,
        getHeaders: () => ({ 'content-type': 'application/json' }),
        body: largeResponse,
      } as any;

      // Store the response
      await idempotencyService.storeResponse(mockRequest, mockResponse, { maxResponseSize: 1024 * 1024 });

      // Check if the response was stored correctly
      const record = await idempotencyService.checkIdempotency(mockRequest);
      expect(record).toBeDefined();
      expect(record.response?.body).toEqual(largeResponse);
    });

    it('should reject responses that exceed size limit', async () => {
      const idempotencyKey = 'replay-oversize-' + Date.now();
      
      // Create a response that exceeds the size limit
      const oversizedResponse = {
        data: 'x'.repeat(2 * 1024 * 1024), // 2MB response (exceeds 1MB limit)
      };

      const mockRequest = {
        method: 'POST',
        path: '/test-oversize',
        headers: { 'x-idempotency-key': idempotencyKey },
        body: { test: 'data' },
      } as any;

      const mockResponse = {
        statusCode: 200,
        getHeaders: () => ({ 'content-type': 'application/json' }),
        body: oversizedResponse,
      } as any;

      // Store the response with size limit
      await idempotencyService.storeResponse(mockRequest, mockResponse, { maxResponseSize: 1024 * 1024 });

      // Check that the response body was not stored due to size limit
      const record = await idempotencyService.checkIdempotency(mockRequest);
      expect(record).toBeDefined();
      expect(record.response?.body).toBeUndefined(); // Body should not be stored
    });
  });

  describe('Concurrent Request Tests', () => {
    it('should handle concurrent requests with same idempotency key', async () => {
      const idempotencyKey = 'concurrent-' + Date.now();
      const testFile = Buffer.from('concurrent test content');

      // Make multiple concurrent requests with the same key
      const requests = Array(5).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/uploads/avatar')
          .set('X-Idempotency-Key', idempotencyKey)
          .set('Authorization', 'Bearer valid-token')
          .attach('file', testFile, 'concurrent.txt')
      );

      const responses = await Promise.allSettled(requests);

      // One should succeed, others should be replays
      const successfulResponses = responses.filter(r => r.status === 'fulfilled');
      const replayResponses = successfulResponses.filter(r => 
        r.status === 'fulfilled' && r.value.headers['x-idempotent-replayed'] === 'true'
      );

      expect(successfulResponses).toHaveLength(5);
      expect(replayResponses.length).toBeGreaterThan(0);

      // All replay responses should have the same body
      const replayBodies = replayResponses.map(r => 
        r.status === 'fulfilled' ? r.value.body : null
      ).filter(Boolean);

      if (replayBodies.length > 1) {
        // All replay bodies should be identical
        const firstBody = replayBodies[0];
        replayBodies.forEach(body => {
          expect(body).toEqual(firstBody);
        });
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty idempotency key', async () => {
      const testFile = Buffer.from('empty key test');

      await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', '')
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'empty.txt')
        .expect(201);
    });

    it('should handle very long idempotency key', async () => {
      const longKey = 'x'.repeat(1000);
      const testFile = Buffer.from('long key test');

      await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', longKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'long.txt')
        .expect(201);
    });

    it('should handle special characters in idempotency key', async () => {
      const specialKey = 'test-key-!@#$%^&*()_+-={}[]|\\:";\'<>?,./';
      const testFile = Buffer.from('special chars test');

      await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', specialKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'special.txt')
        .expect(201);
    });

    it('should handle Unicode characters in idempotency key', async () => {
      const unicodeKey = 'test-key-ñáéíóú-emoji-ð';
      const testFile = Buffer.from('unicode test');

      await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', unicodeKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'unicode.txt')
        .expect(201);
    });
  });

  describe('Performance Tests', () => {
    it('should handle high volume of idempotency requests efficiently', async () => {
      const startTime = Date.now();
      const requestCount = 100;

      // Make many requests with unique keys
      const requests = Array.from({ length: requestCount }, (_, i) =>
        request(app.getHttpServer())
          .post('/uploads/avatar')
          .set('X-Idempotency-Key', `perf-test-${i}`)
          .set('Authorization', 'Bearer valid-token')
          .attach('file', Buffer.from(`test content ${i}`), `perf-${i}.txt`)
      );

      await Promise.all(requests);

      const duration = Date.now() - startTime;
      const avgTimePerRequest = duration / requestCount;

      // Should handle requests efficiently (less than 100ms per request on average)
      expect(avgTimePerRequest).toBeLessThan(100);
    });

    it('should handle replay requests faster than original requests', async () => {
      const idempotencyKey = 'perf-replay-' + Date.now();
      const testFile = Buffer.from('performance replay test');

      // Original request
      const originalStart = Date.now();
      await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'perf-replay.txt')
        .expect(201);
      const originalDuration = Date.now() - originalStart;

      // Replay request
      const replayStart = Date.now();
      await request(app.getHttpServer())
        .post('/uploads/avatar')
        .set('X-Idempotency-Key', idempotencyKey)
        .set('Authorization', 'Bearer valid-token')
        .attach('file', testFile, 'perf-replay.txt')
        .expect(200);
      const replayDuration = Date.now() - replayStart;

      // Replay should be significantly faster
      expect(replayDuration).toBeLessThan(originalDuration * 0.5);
    });
  });

  describe('Service Level Tests', () => {
    it('should provide idempotency statistics', async () => {
      // Create some test data
      const testKeys = ['stats-test-1', 'stats-test-2', 'stats-test-3'];
      
      for (const key of testKeys) {
        const mockRequest = {
          method: 'POST',
          path: '/test',
          headers: { 'x-idempotency-key': key },
          body: { test: 'data' },
        } as any;

        const mockResponse = {
          statusCode: 200,
          getHeaders: () => ({ 'content-type': 'application/json' }),
          body: { success: true },
        } as any;

        await idempotencyService.storeResponse(mockRequest, mockResponse);
      }

      const stats = await idempotencyService.getStats();
      
      expect(stats.totalRecords).toBeGreaterThan(0);
      expect(stats.recordsByAge).toBeDefined();
      expect(typeof stats.recordsByAge['0-1h']).toBe('number');
    });

    it('should perform cleanup of expired records', async () => {
      // Create a record without TTL (simulating expired record)
      const mockRequest = {
        method: 'POST',
        path: '/cleanup-test',
        headers: { 'x-idempotency-key': 'cleanup-test' },
        body: { test: 'data' },
      } as any;

      const mockResponse = {
        statusCode: 200,
        getHeaders: () => ({ 'content-type': 'application/json' }),
        body: { success: true },
      } as any;

      // Store without TTL
      await idempotencyService.storeResponse(mockRequest, mockResponse, { ttl: 0 });
      
      // Manually set TTL to -1 to simulate no expiration
      const key = await idempotencyService.generateKey(mockRequest);
      await redis.persist(key);

      // Run cleanup
      const cleaned = await idempotencyService.cleanup();
      
      expect(cleaned).toBeGreaterThan(0);
    });

    it('should pass health check', async () => {
      const health = await idempotencyService.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.redis).toBe(true);
    });
  });
});
