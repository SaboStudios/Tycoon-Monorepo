import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksObservabilityService, WebhookEventType } from './webhooks-observability.service';
import { LoggerService } from '../../common/logger/logger.service';

describe('WebhooksObservabilityService', () => {
  let service: WebhooksObservabilityService;
  let loggerService: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    // Mock LoggerService
    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      logWithMeta: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksObservabilityService,
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<WebhooksObservabilityService>(WebhooksObservabilityService);
    loggerService = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logWebhookReceived', () => {
    it('should log webhook received event', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };

      service.logWebhookReceived(context);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Webhook received: stripe - payment.succeeded',
        'WebhooksObservability',
      );

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Webhook received',
        expect.objectContaining({
          webhookId: 'wh_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
          event: WebhookEventType.RECEIVED,
        }),
      );
    });

    it('should handle missing source and eventType', () => {
      const context = {
        webhookId: 'wh_123',
      };

      service.logWebhookReceived(context);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Webhook received: unknown - unknown',
        'WebhooksObservability',
      );
    });

    it('should sanitize sensitive fields from context', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
        signature: 'secret_signature', // Should be removed
        secret: 'secret_key', // Should be removed
      } as any;

      service.logWebhookReceived(context);

      const loggedContext = loggerService.logWithMeta.mock.calls[0][2];
      expect(loggedContext).not.toHaveProperty('signature');
      expect(loggedContext).not.toHaveProperty('secret');
    });
  });

  describe('logSignatureVerification', () => {
    it('should log successful signature verification', () => {
      service.logSignatureVerification('stripe', true, 5);

      expect(loggerService.debug).toHaveBeenCalledWith(
        'Signature verified for stripe in 5ms',
        'WebhooksObservability',
      );

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'debug',
        'Signature verification',
        expect.objectContaining({
          event: WebhookEventType.SIGNATURE_VERIFIED,
          source: 'stripe',
          result: 'valid',
          durationMs: 5,
        }),
      );
    });

    it('should log failed signature verification with reason', () => {
      service.logSignatureVerification('stripe', false, 3, 'signature_mismatch');

      expect(loggerService.warn).toHaveBeenCalledWith(
        'Signature verification failed for stripe: signature_mismatch',
        'WebhooksObservability',
      );

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'warn',
        'Signature verification',
        expect.objectContaining({
          event: WebhookEventType.SIGNATURE_FAILED,
          source: 'stripe',
          result: 'invalid',
          durationMs: 3,
          failureReason: 'signature_mismatch',
        }),
      );
    });

    it('should record metrics for signature verification', async () => {
      service.logSignatureVerification('stripe', true, 5);

      // Verify metrics are recorded by getting metrics text
      const metricsText = await service.getMetricsText();
      expect(metricsText).toContain('tycoon_webhook_signature_verification_total');
    });
  });

  describe('logIdempotencyHit', () => {
    it('should log idempotency hit', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };

      service.logIdempotencyHit(context);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Duplicate webhook detected: wh_123 (stripe)',
        'WebhooksObservability',
      );

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Idempotency hit',
        expect.objectContaining({
          webhookId: 'wh_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
          event: WebhookEventType.IDEMPOTENCY_HIT,
        }),
      );
    });
  });

  describe('logWebhookProcessed', () => {
    it('should log successful webhook processing', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };

      service.logWebhookProcessed(context, 150);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Webhook processed: wh_123 (stripe) in 150ms',
        'WebhooksObservability',
      );

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'info',
        'Webhook processed',
        expect.objectContaining({
          webhookId: 'wh_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
          event: WebhookEventType.PROCESSED,
          processingTimeMs: 150,
        }),
      );
    });

    it('should record processing duration metrics', async () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };

      service.logWebhookProcessed(context, 150);

      const metricsText = await service.getMetricsText();
      expect(metricsText).toContain('tycoon_webhook_processing_duration_seconds');
    });
  });

  describe('logWebhookProcessingFailed', () => {
    it('should log webhook processing failure', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      };
      const error = new Error('Database connection failed');

      service.logWebhookProcessingFailed(context, error, 200);

      expect(loggerService.error).toHaveBeenCalledWith(
        'Webhook processing failed: wh_123 (stripe) - Database connection failed',
        error.stack,
        'WebhooksObservability',
      );

      expect(loggerService.logWithMeta).toHaveBeenCalledWith(
        'error',
        'Webhook processing failed',
        expect.objectContaining({
          webhookId: 'wh_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
          event: WebhookEventType.PROCESSING_FAILED,
          error: 'Database connection failed',
          processingTimeMs: 200,
        }),
      );
    });
  });

  describe('getMetricsText', () => {
    it('should return Prometheus metrics text', async () => {
      // Log some events to generate metrics
      service.logSignatureVerification('stripe', true, 5);
      service.logWebhookReceived({
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      });

      const metricsText = await service.getMetricsText();

      expect(metricsText).toContain('tycoon_webhook_events_total');
      expect(metricsText).toContain('tycoon_webhook_signature_verification_total');
      expect(metricsText).toContain('tycoon_webhook_signature_verification_duration_seconds');
    });
  });

  describe('metrics counters', () => {
    it('should increment webhook events counter', async () => {
      service.logWebhookReceived({
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      });

      const metricsText = await service.getMetricsText();
      expect(metricsText).toContain('tycoon_webhook_events_total');
    });

    it('should increment idempotency hits counter', async () => {
      service.logIdempotencyHit({
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      });

      const metricsText = await service.getMetricsText();
      expect(metricsText).toContain('tycoon_webhook_idempotency_hits_total');
    });
  });

  describe('security - no secrets in logs', () => {
    it('should not log signature values', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
        signature: 'secret_signature_value',
      } as any;

      service.logWebhookReceived(context);

      // Check that signature is not in any log call
      const allLogCalls = [
        ...loggerService.log.mock.calls,
        ...loggerService.logWithMeta.mock.calls,
      ];

      allLogCalls.forEach((call) => {
        const callString = JSON.stringify(call);
        expect(callString).not.toContain('secret_signature_value');
      });
    });

    it('should not log secret values', () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
        secret: 'webhook_secret_key',
        token: 'auth_token_value',
      } as any;

      service.logWebhookProcessed(context, 100);

      const allLogCalls = [
        ...loggerService.log.mock.calls,
        ...loggerService.logWithMeta.mock.calls,
      ];

      allLogCalls.forEach((call) => {
        const callString = JSON.stringify(call);
        expect(callString).not.toContain('webhook_secret_key');
        expect(callString).not.toContain('auth_token_value');
      });
    });
  });
});
