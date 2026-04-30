import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';
import { RedisService } from '../redis/redis.service';
import { WebhookEvent } from './entities/webhook-event.entity';
import { WebhooksService } from './webhooks.service';
import { WebhooksObservabilityService } from './webhooks-observability.service';
import { WebhooksAuditService } from './webhooks-audit.service';
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
    const payload = { id: 'evt_test_observability_123', type: 'payment.succeeded' };
    const body = Buffer.from(JSON.stringify(payload));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac('sha256', 'test_webhook_secret_for_integration')
      .update(`${timestamp}.${body.toString()}`)
      .digest('hex');

    const valid = await service.verifySignature(signature, timestamp, body, 'stripe');
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
});
