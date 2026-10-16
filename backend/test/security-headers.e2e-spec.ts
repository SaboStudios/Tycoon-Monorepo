import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Security headers (e2e)', () => {
  const buildApp = async (nodeEnv: string): Promise<INestApplication> => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('CONFIGURATION(app)')
      .useValue({ nodeEnv })
      .compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    return app;
  };

  describe('non-production', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp('development');
    });

    afterAll(async () => {
      await app.close();
    });

    it('sets X-Frame-Options to DENY', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('sets X-Content-Type-Options to nosniff', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('does not set X-XSS-Protection', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect(res.headers['x-xss-protection']).toBeUndefined();
    });

    it('sets a Content-Security-Policy with default-src and frame-ancestors', async () => {
      const res = await request(app.getHttpServer()).get('/');
      const csp = res.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    });

    it('does not include upgrade-insecure-requests', async () => {
      const res = await request(app.getHttpServer()).get('/');
      const csp = res.headers['content-security-policy'];
      expect(csp).not.toContain('upgrade-insecure-requests');
    });
  });

  describe('production', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await buildApp('production');
    });

    afterAll(async () => {
      await app.close();
    });

    it('sets X-Frame-Options to DENY', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('sets X-Content-Type-Options to nosniff', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('does not set X-XSS-Protection', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect(res.headers['x-xss-protection']).toBeUndefined();
    });

    it('sets a Content-Security-Policy with default-src and frame-ancestors', async () => {
      const res = await request(app.getHttpServer()).get('/');
      const csp = res.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    });

    it('includes upgrade-insecure-requests', async () => {
      const res = await request(app.getHttpServer()).get('/');
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain('upgrade-insecure-requests');
    });
  });
});
