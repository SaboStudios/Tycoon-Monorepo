import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebhooksAuditService, WebhookAuditAction } from './webhooks-audit.service';
import { WebhookAuditLog } from './entities/webhook-audit-log.entity';
import { LoggerService } from '../../common/logger/logger.service';

describe('WebhooksAuditService', () => {
  let service: WebhooksAuditService;
  let mockRepo: any;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) => Promise.resolve({ ...entity, id: 'audit-123' })),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      verbose: jest.fn(),
      logWithMeta: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksAuditService,
        {
          provide: getRepositoryToken(WebhookAuditLog),
          useValue: mockRepo,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<WebhooksAuditService>(WebhooksAuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAuditLog', () => {
    it('should create an audit log entry', async () => {
      const context = {
        webhookId: 'wh_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
        action: WebhookAuditAction.RECEIVED,
        success: true,
      };

      const result = await service.createAuditLog(context);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookId: 'wh_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
          action: WebhookAuditAction.RECEIVED,
          success: true,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('audit-123');
    });

    it('should sanitize metadata before saving', async () => {
      const context = {
        webhookId: 'wh_123',
        source: 'stripe',
        action: WebhookAuditAction.RECEIVED,
        success: true,
        metadata: {
          signature: 'secret_signature',
          secret: 'webhook_secret',
          validField: 'keep_this',
        },
      };

      await service.createAuditLog(context);

      const savedEntity = mockRepo.create.mock.calls[0][0];
      expect(savedEntity.metadata).not.toHaveProperty('signature');
      expect(savedEntity.metadata).not.toHaveProperty('secret');
      expect(savedEntity.metadata).toHaveProperty('validField', 'keep_this');
    });

    it('should log error if audit log creation fails', async () => {
      const error = new Error('Database error');
      mockRepo.save.mockRejectedValue(error);

      const context = {
        webhookId: 'wh_123',
        source: 'stripe',
        action: WebhookAuditAction.RECEIVED,
        success: true,
      };

      await expect(service.createAuditLog(context)).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('auditWebhookReceived', () => {
    it('should create audit log for webhook received', async () => {
      await service.auditWebhookReceived(
        'wh_123',
        'payment.succeeded',
        'stripe',
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookId: 'wh_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
          action: WebhookAuditAction.RECEIVED,
          success: true,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      );
    });
  });

  describe('auditSignatureVerification', () => {
    it('should audit successful signature verification', async () => {
      await service.auditSignatureVerification(
        'wh_123',
        'stripe',
        true,
        5,
        undefined,
        '192.168.1.1',
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookId: 'wh_123',
          source: 'stripe',
          action: WebhookAuditAction.SIGNATURE_VERIFIED,
          success: true,
          durationMs: 5,
          ipAddress: '192.168.1.1',
        }),
      );
    });

    it('should audit failed signature verification with reason', async () => {
      await service.auditSignatureVerification(
        'wh_123',
        'stripe',
        false,
        3,
        'signature_mismatch',
        '192.168.1.1',
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: WebhookAuditAction.SIGNATURE_FAILED,
          success: false,
          errorMessage: 'signature_mismatch',
          metadata: { failureReason: 'signature_mismatch' },
        }),
      );
    });
  });

  describe('auditIdempotencyCheck', () => {
    it('should audit idempotency hit', async () => {
      await service.auditIdempotencyCheck('wh_123', 'payment.succeeded', 'stripe', true);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: WebhookAuditAction.IDEMPOTENCY_HIT,
          metadata: { isDuplicate: true },
        }),
      );
    });

    it('should audit idempotency check for new webhook', async () => {
      await service.auditIdempotencyCheck('wh_123', 'payment.succeeded', 'stripe', false);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: WebhookAuditAction.IDEMPOTENCY_CHECK,
          metadata: { isDuplicate: false },
        }),
      );
    });
  });

  describe('auditProcessingCompleted', () => {
    it('should audit successful processing', async () => {
      await service.auditProcessingCompleted('wh_123', 'payment.succeeded', 'stripe', 150);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: WebhookAuditAction.PROCESSING_COMPLETED,
          success: true,
          durationMs: 150,
        }),
      );
    });
  });

  describe('auditProcessingFailed', () => {
    it('should audit processing failure', async () => {
      const error = new Error('Database connection failed');

      await service.auditProcessingFailed('wh_123', 'payment.succeeded', 'stripe', error, 200);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: WebhookAuditAction.PROCESSING_FAILED,
          success: false,
          errorMessage: 'Database connection failed',
          durationMs: 200,
          metadata: { errorName: 'Error' },
        }),
      );
    });
  });

  describe('getAuditLogsForWebhook', () => {
    it('should retrieve audit logs for a webhook', async () => {
      const mockLogs = [
        { id: '1', action: WebhookAuditAction.RECEIVED },
        { id: '2', action: WebhookAuditAction.SIGNATURE_VERIFIED },
      ];
      mockRepo.find.mockResolvedValue(mockLogs);

      const result = await service.getAuditLogsForWebhook('wh_123');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { webhookId: 'wh_123' },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(mockLogs);
    });
  });

  describe('getFailedOperations', () => {
    it('should retrieve failed operations', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.getFailedOperations('stripe', 50);

      expect(mockQb.where).toHaveBeenCalledWith('audit.success = :success', { success: false });
      expect(mockQb.andWhere).toHaveBeenCalledWith('audit.source = :source', { source: 'stripe' });
      expect(mockQb.take).toHaveBeenCalledWith(50);
    });
  });

  describe('getAuditStatistics', () => {
    it('should calculate audit statistics', async () => {
      const mockLogs = [
        {
          action: WebhookAuditAction.RECEIVED,
          success: true,
          durationMs: 100,
        },
        {
          action: WebhookAuditAction.SIGNATURE_VERIFIED,
          success: true,
          durationMs: 5,
        },
        {
          action: WebhookAuditAction.SIGNATURE_FAILED,
          success: false,
          durationMs: 3,
        },
        {
          action: WebhookAuditAction.IDEMPOTENCY_HIT,
          success: true,
          durationMs: null,
        },
      ];

      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockLogs),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQb);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const stats = await service.getAuditStatistics(startDate, endDate, 'stripe');

      expect(stats.totalEvents).toBe(4);
      expect(stats.successfulEvents).toBe(3);
      expect(stats.failedEvents).toBe(1);
      expect(stats.signatureFailures).toBe(1);
      expect(stats.idempotencyHits).toBe(1);
      expect(stats.averageDurationMs).toBe(36); // (100 + 5 + 3) / 3
    });
  });

  describe('security - sanitizeMetadata', () => {
    it('should remove all sensitive fields', async () => {
      const context = {
        webhookId: 'wh_123',
        source: 'stripe',
        action: WebhookAuditAction.RECEIVED,
        success: true,
        metadata: {
          signature: 'secret',
          secret: 'secret',
          token: 'secret',
          authorization: 'secret',
          apiKey: 'secret',
          api_key: 'secret',
          password: 'secret',
          webhookSecret: 'secret',
          webhook_secret: 'secret',
          safeField: 'keep',
        },
      };

      await service.createAuditLog(context);

      const savedMetadata = mockRepo.create.mock.calls[0][0].metadata;
      expect(savedMetadata).toEqual({ safeField: 'keep' });
    });

    it('should recursively sanitize nested objects', async () => {
      const context = {
        webhookId: 'wh_123',
        source: 'stripe',
        action: WebhookAuditAction.RECEIVED,
        success: true,
        metadata: {
          nested: {
            signature: 'secret',
            safeField: 'keep',
          },
        },
      };

      await service.createAuditLog(context);

      const savedMetadata = mockRepo.create.mock.calls[0][0].metadata;
      expect(savedMetadata.nested).not.toHaveProperty('signature');
      expect(savedMetadata.nested).toHaveProperty('safeField', 'keep');
    });
  });
});
