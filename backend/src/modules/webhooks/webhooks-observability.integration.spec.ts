import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { WebhooksModule } from './webhooks.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../redis/redis.module';
import * as crypto from 'crypto';

/**
 * Integration tests for webhook observability
 * Tests the full flow including metrics collection
 */
describe('Webhooks Observability Integration', () => {
  let app: INestApplication;
  const webhookSecret = 'test_webhook_secret_for_integration';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              WEBHOOK_SECRET: webhookSecret,
              REDIS_HOST: process.env.REDIS_HOST || 'localhost',
              REDIS_PORT: process.env.REDIS_PORT || 6379,
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [__dirname + '/entities/*.entity{.ts,.js}'],
          synchronize: true,
        }),
        RedisModule,
        WebhooksModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /webhooks/stripe with observability', () => {
    it('should process webhook and expose metrics', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        id: 'evt_test_observability_123',
        type: 'payment.succeeded',
        data: { amount: 1000 },
      };
      const body = JSON.stringify(payload);
      const signedPayload = `${timestamp}.${body}`;
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      // Process webhook
      const response = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('x-stripe-signature', signature)
        .set('x-stripe-timestamp', timestamp)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        received: true,
        processed: true,
      });

      // Check metrics endpoint
      const metricsResponse = await request(app.getHttpServer())
        .get('/webhooks/metrics')
        .expect(200);

      const metricsText = metricsResponse.text;

      // Verify key metrics are present
      expect(metricsText).toContain('tycoon_webhook_events_total');
      expect(metricsText).toContain('tycoon_webhook_signature_verification_total');
      expect(metricsText).toContain('tycoon_webhook_signature_verification_duration_seconds');
      expect(metricsText).toContain('tycoon_webhook_processing_duration_seconds');

      // Verify labels are present
      expect(metricsText).toContain('source="stripe"');
      expect(metricsText).toContain('event_type="payment.succeeded"');
      expect(metricsText).toContain('result="valid"');
    });

    it('should record signature verification failure metrics', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        id: 'evt_test_invalid_sig',
        type: 'payment.failed',
      };
      const body = JSON.stringify(payload);
      const invalidSignature = 'invalid_signature_hex';

      // Attempt webhook with invalid signature
      const response = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('x-stripe-signature', invalidSignature)
        .set('x-stripe-timestamp', timestamp)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(response.status).toBe(401);

      // Check metrics
      const metricsResponse = await request(app.getHttpServer())
        .get('/webhooks/metrics')
        .expect(200);

      const metricsText = metricsResponse.text;

      // Verify failure metrics
      expect(metricsText).toContain('tycoon_webhook_signature_verification_total');
      expect(metricsText).toContain('result="invalid"');
      expect(metricsText).toContain('failure_reason="signature_length_mismatch"');
    });

    it('should record idempotency hit metrics for duplicate webhooks', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        id: 'evt_test_idempotency_456',
        type: 'charge.refunded',
      };
      const body = JSON.stringify(payload);
      const signedPayload = `${timestamp}.${body}`;
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      // First request - should process
      await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('x-stripe-signature', signature)
        .set('x-stripe-timestamp', timestamp)
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(200);

      // Second request - should be idempotent
      const duplicateResponse = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('x-stripe-signature', signature)
        .set('x-stripe-timestamp', timestamp)
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(200);

      expect(duplicateResponse.body).toMatchObject({
        received: true,
        idempotent: true,
      });

      // Check metrics for idempotency
      const metricsResponse = await request(app.getHttpServer())
        .get('/webhooks/metrics')
        .expect(200);

      const metricsText = metricsResponse.text;

      // Verify idempotency metrics
      expect(metricsText).toContain('tycoon_webhook_idempotency_hits_total');
      expect(metricsText).toContain('source="stripe"');
      expect(metricsText).toContain('event_type="charge.refunded"');
    });
  });

  describe('Metrics format and structure', () => {
    it('should return Prometheus-compatible metrics format', async () => {
      const metricsResponse = await request(app.getHttpServer())
        .get('/webhooks/metrics')
        .expect(200);

      const metricsText = metricsResponse.text;

      // Verify Prometheus format
      expect(metricsText).toMatch(/# HELP tycoon_webhook_events_total/);
      expect(metricsText).toMatch(/# TYPE tycoon_webhook_events_total counter/);
      expect(metricsText).toMatch(/# HELP tycoon_webhook_signature_verification_duration_seconds/);
      expect(metricsText).toMatch(/# TYPE tycoon_webhook_signature_verification_duration_seconds histogram/);
    });

    it('should include histogram buckets for latency metrics', async () => {
      const metricsResponse = await request(app.getHttpServer())
        .get('/webhooks/metrics')
        .expect(200);

      const metricsText = metricsResponse.text;

      // Verify histogram buckets are present
      expect(metricsText).toMatch(/tycoon_webhook_signature_verification_duration_seconds_bucket{.*le="0.001"/);
      expect(metricsText).toMatch(/tycoon_webhook_signature_verification_duration_seconds_bucket{.*le="0.01"/);
      expect(metricsText).toMatch(/tycoon_webhook_processing_duration_seconds_bucket{.*le="0.1"/);
      expect(metricsText).toMatch(/tycoon_webhook_processing_duration_seconds_bucket{.*le="\+Inf"/);
    });
  });

  describe('Security - no secrets in responses', () => {
    it('should not expose webhook secret in any endpoint', async () => {
      // Check metrics endpoint
      const metricsResponse = await request(app.getHttpServer())
        .get('/webhooks/metrics')
        .expect(200);

      expect(metricsResponse.text).not.toContain(webhookSecret);

      // Check events listing endpoint
      const eventsResponse = await request(app.getHttpServer())
        .get('/webhooks/events')
        .expect(200);

      const eventsText = JSON.stringify(eventsResponse.body);
      expect(eventsText).not.toContain(webhookSecret);
    });

    it('should not expose signatures in error responses', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = { id: 'evt_test', type: 'test' };
      const body = JSON.stringify(payload);
      const signature = 'test_signature_should_not_appear_in_response';

      const response = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('x-stripe-signature', signature)
        .set('x-stripe-timestamp', timestamp)
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(401);

      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain(signature);
    });
  });
});
