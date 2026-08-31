import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';
import { RedisService } from '../redis/redis.service';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhooksService } from './webhooks.service';
import { WebhooksObservabilityService } from './webhooks-observability.service';
import { WebhooksAuditService } from './webhooks-audit.service';
import { WebhookAuditHooksService } from './webhook-audit-hooks.service';
import * as crypto from 'crypto';

describe('Webhooks Observability Integration', () => {
  let service: WebhooksService;
  let observability: WebhooksObservabilityService;
  let redis: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    const repo = {
      create: jest.fn((v) => v),
      save: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn(),
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        WebhooksObservabilityService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'WEBHOOK_SECRET'
                ? 'test_webhook_secret_for_integration'
                : undefined,
            ),
          },
        },
        { provide: RedisService, useValue: redis },
        {
          provide: WebhooksAuditService,
          useValue: {
            auditSignatureVerification: jest.fn(),
            auditWebhookReceived: jest.fn(),
            auditIdempotencyCheck: jest.fn(),
            auditWebhookPersisted: jest.fn(),
            auditProcessingCompleted: jest.fn(),
            auditProcessingFailed: jest.fn(),
          },
        },
        {
          provide: WebhookAuditHooksService,
          useValue: {
            onReceived: jest.fn(),
            onSignatureVerified: jest.fn(),
            onSignatureFailed: jest.fn(),
            onDuplicate: jest.fn(),
            onProcessed: jest.fn(),
            onFailed: jest.fn(),
          },
        },
        { provide: getRepositoryToken(WebhookEvent), useValue: repo },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            logWithMeta: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(WebhooksService);
    observability = module.get(WebhooksObservabilityService);
  });

  it('processes valid webhook and emits metrics', async () => {
    const payload = {
      id: 'evt_test_observability_123',
      type: 'payment.succeeded',
    };
    const body = Buffer.from(JSON.stringify(payload));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac('sha256', 'test_webhook_secret_for_integration')
      .update(`${timestamp}.${body.toString()}`)
      .digest('hex');

    const valid = await service.verifySignature(
      signature,
      timestamp,
      body,
      'stripe',
    );
    expect(valid).toBe(true);

    const result = await service.processWebhook(payload, 'stripe');
    expect(result).toEqual({ received: true, processed: true });

    const metricsText = await observability.getMetricsText();
    expect(metricsText).toContain('tycoon_webhook_events_total');
    expect(metricsText).toContain('tycoon_webhook_processing_duration_seconds');
  });

  it('records idempotency hit for duplicate webhook', async () => {
    redis.get.mockResolvedValue(true);
    const payload = { id: 'evt_duplicate', type: 'charge.refunded' };

    const result = await service.processWebhook(payload, 'stripe');
    expect(result).toEqual({ received: true, idempotent: true });

    const metricsText = await observability.getMetricsText();
    expect(metricsText).toContain('tycoon_webhook_idempotency_hits_total');
  });

  it('rejects webhook with invalid signature and emits failure metric', async () => {
    const payload = {
      id: 'evt_test_invalid_sig_123',
      type: 'payment.succeeded',
    };
    const body = Buffer.from(JSON.stringify(payload));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const invalidSignature = 'definitely_not_a_valid_signature';

    const valid = await service.verifySignature(
      invalidSignature,
      timestamp,
      body,
      'stripe',
    );
    expect(valid).toBe(false);

    const metricsText = await observability.getMetricsText();
    expect(metricsText).toContain('tycoon_webhook_signature_verification_total');
    expect(metricsText).toContain('result="invalid"');
  });

  it('rejects webhook with tampered signature', async () => {
    const payload = {
      id: 'evt_test_tampered_sig_456',
      type: 'charge.refunded',
    };
    const body = Buffer.from(JSON.stringify(payload));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const correctSignature = crypto
      .createHmac('sha256', 'test_webhook_secret_for_integration')
      .update(`${timestamp}.${body.toString()}`)
      .digest('hex');

    const tamperedSignature = correctSignature
      .split('')
      .reverse()
      .join('');

    const valid = await service.verifySignature(
      tamperedSignature,
      timestamp,
      body,
      'stripe',
    );
    expect(valid).toBe(false);
  });

  it('handles idempotent replay of same event as safe no-op', async () => {
    const payload = {
      id: 'evt_test_replay_123',
      type: 'payment.succeeded',
    };
    const body = Buffer.from(JSON.stringify(payload));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac('sha256', 'test_webhook_secret_for_integration')
      .update(`${timestamp}.${body.toString()}`)
      .digest('hex');

    const valid = await service.verifySignature(
      signature,
      timestamp,
      body,
      'stripe',
    );
    expect(valid).toBe(true);

    const result1 = await service.processWebhook(payload, 'stripe');
    expect(result1).toEqual({ received: true, processed: true });

    const result2 = await service.processWebhook(payload, 'stripe');
    expect(result2).toEqual({ received: true, idempotent: true });

    const metricsText = await observability.getMetricsText();
    expect(metricsText).toContain('tycoon_webhook_idempotency_hits_total{source="stripe",event_type="payment.succeeded"} 1');
  });
});
