import { Test, TestingModule } from '@nestjs/testing';
import { WebhookAuditHooksService } from './webhook-audit-hooks.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';

const makeAuditTrailMock = () => ({
  log: jest.fn().mockResolvedValue(undefined),
});

describe('WebhookAuditHooksService', () => {
  let service: WebhookAuditHooksService;
  let auditTrailService: ReturnType<typeof makeAuditTrailMock>;

  beforeEach(async () => {
    auditTrailService = makeAuditTrailMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookAuditHooksService,
        { provide: AuditTrailService, useValue: auditTrailService },
      ],
    }).compile();

    service = module.get<WebhookAuditHooksService>(WebhookAuditHooksService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('onReceived', () => {
    it('fires WEBHOOK_RECEIVED with source, webhookId, eventType', () => {
      service.onReceived({
        webhookId: 'wh_1',
        eventType: 'payment.succeeded',
        source: 'stripe',
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
      });

      expect(auditTrailService.log).toHaveBeenCalledWith(
        AuditAction.WEBHOOK_RECEIVED,
        expect.objectContaining({
          changes: {
            webhookId: 'wh_1',
            eventType: 'payment.succeeded',
            source: 'stripe',
          },
          ipAddress: '1.2.3.4',
          userAgent: 'test-agent',
        }),
      );
    });
  });

  describe('onSignatureVerified', () => {
    it('fires WEBHOOK_SIGNATURE_VERIFIED', () => {
      service.onSignatureVerified({ source: 'stripe', ipAddress: '1.2.3.4', durationMs: 8 });

      expect(auditTrailService.log).toHaveBeenCalledWith(
        AuditAction.WEBHOOK_SIGNATURE_VERIFIED,
        expect.objectContaining({
          changes: { source: 'stripe', durationMs: 8 },
          ipAddress: '1.2.3.4',
        }),
      );
    });
  });

  describe('onSignatureFailed', () => {
    it('fires WEBHOOK_SIGNATURE_FAILED with reason', () => {
      service.onSignatureFailed({
        source: 'stripe',
        reason: 'signature_mismatch',
        ipAddress: '1.2.3.4',
        durationMs: 3,
      });

      expect(auditTrailService.log).toHaveBeenCalledWith(
        AuditAction.WEBHOOK_SIGNATURE_FAILED,
        expect.objectContaining({
          changes: { source: 'stripe', durationMs: 3 },
          reason: 'signature_mismatch',
          ipAddress: '1.2.3.4',
        }),
      );
    });
  });

  describe('onDuplicate', () => {
    it('fires WEBHOOK_DUPLICATE', () => {
      service.onDuplicate({ webhookId: 'wh_1', eventType: 'payment.succeeded', source: 'stripe' });

      expect(auditTrailService.log).toHaveBeenCalledWith(
        AuditAction.WEBHOOK_DUPLICATE,
        expect.objectContaining({
          changes: {
            webhookId: 'wh_1',
            eventType: 'payment.succeeded',
            source: 'stripe',
          },
        }),
      );
    });
  });

  describe('onProcessed', () => {
    it('fires WEBHOOK_PROCESSED with durationMs', () => {
      service.onProcessed({
        webhookId: 'wh_1',
        eventType: 'payment.succeeded',
        source: 'stripe',
        durationMs: 120,
      });

      expect(auditTrailService.log).toHaveBeenCalledWith(
        AuditAction.WEBHOOK_PROCESSED,
        expect.objectContaining({
          changes: expect.objectContaining({ durationMs: 120, source: 'stripe' }),
        }),
      );
    });
  });

  describe('onFailed', () => {
    it('fires WEBHOOK_FAILED with errorName and errorMessage as reason', () => {
      service.onFailed({
        webhookId: 'wh_1',
        eventType: 'payment.succeeded',
        source: 'stripe',
        errorName: 'Error',
        errorMessage: 'DB gone',
        durationMs: 200,
      });

      expect(auditTrailService.log).toHaveBeenCalledWith(
        AuditAction.WEBHOOK_FAILED,
        expect.objectContaining({
          changes: expect.objectContaining({ errorName: 'Error', source: 'stripe' }),
          reason: 'DB gone',
        }),
      );
    });
  });

  describe('error resilience', () => {
    it('does not throw when AuditTrailService.log rejects', async () => {
      auditTrailService.log.mockRejectedValueOnce(new Error('DB error'));

      expect(() =>
        service.onReceived({ source: 'stripe', webhookId: 'wh_1', eventType: 'x' }),
      ).not.toThrow();

      // give microtask queue a tick so the catch fires
      await Promise.resolve();
    });
  });
});
