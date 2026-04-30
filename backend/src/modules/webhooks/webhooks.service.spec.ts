import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { WebhooksService } from './webhooks.service';
import { WebhooksObservabilityService } from './webhooks-observability.service';
import { WebhooksAuditService } from './webhooks-audit.service';
import { RedisService } from '../redis/redis.service';
import { WebhookEvent } from './entities/webhook-event.entity';
import { SortOrder } from '../../common/dto/pagination.dto';

const mockRepo = () => ({
  create: jest.fn((v) => v),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockObservability = () => ({
  logWebhookReceived: jest.fn(),
  logSignatureVerification: jest.fn(),
  logIdempotencyHit: jest.fn(),
  logWebhookProcessed: jest.fn(),
  logWebhookProcessingFailed: jest.fn(),
});

const mockAudit = () => ({
  auditSignatureVerification: jest.fn(),
  auditWebhookReceived: jest.fn(),
  auditIdempotencyCheck: jest.fn(),
  auditWebhookPersisted: jest.fn(),
  auditProcessingCompleted: jest.fn(),
  auditProcessingFailed: jest.fn(),
});

describe('WebhooksService', () => {
  let service: WebhooksService;
  let redisService: jest.Mocked<RedisService>;
  let observability: ReturnType<typeof mockObservability>;
  let auditService: ReturnType<typeof mockAudit>;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    repo = mockRepo();
    observability = mockObservability();
    auditService = mockAudit();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: WebhooksObservabilityService, useValue: observability },
        { provide: WebhooksAuditService, useValue: auditService },
        { provide: getRepositoryToken(WebhookEvent), useValue: repo },
        { provide: ConfigService, useValue: new ConfigService({ WEBHOOK_SECRET: 'test_secret' }) },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    redisService = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifySignature', () => {
    const secret = 'test_secret';

    beforeEach(() => {
      // Set the private field directly since it's not a getter
      (service as any).webhookSecret = secret;
    });

    it('should verify valid signature and log success', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({ test: 'data' });
      const signedPayload = `${timestamp}.${body}`;
      const signature = require('crypto')
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      const result = await service.verifySignature(
        signature,
        timestamp,
        Buffer.from(body),
        'stripe',
      );
      
      expect(result).toBe(true);
      expect(observability.logSignatureVerification).toHaveBeenCalledWith(
        'stripe',
        true,
        expect.any(Number),
        undefined,
      );
    });

    it('should reject invalid signature and log failure', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({ test: 'data' });

      // Invalid hex signature of wrong length returns false (no throw)
      const result = await service.verifySignature(
        'aabbcc',
        timestamp,
        Buffer.from(body),
        'stripe',
      );
      
      expect(result).toBe(false);
      expect(observability.logSignatureVerification).toHaveBeenCalledWith(
        'stripe',
        false,
        expect.any(Number),
        'signature_length_mismatch',
      );
    });

    it('should reject timestamp outside tolerance and log failure', async () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
      const body = JSON.stringify({ test: 'data' });

      await expect(
        service.verifySignature('signature', oldTimestamp, Buffer.from(body), 'stripe'),
      ).rejects.toThrow('Webhook timestamp outside of tolerance');

      expect(observability.logSignatureVerification).toHaveBeenCalledWith(
        'stripe',
        false,
        expect.any(Number),
        'timestamp_outside_tolerance',
      );
    });

    it('should log failure for missing signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({ test: 'data' });

      await expect(
        service.verifySignature('', timestamp, Buffer.from(body), 'stripe'),
      ).rejects.toThrow('Missing webhook signature or timestamp');

      expect(observability.logSignatureVerification).toHaveBeenCalledWith(
        'stripe',
        false,
        expect.any(Number),
        'missing_signature_or_timestamp',
      );
    });
  });

  describe('processWebhook', () => {
    it('should process new webhook, persist event, and log success', async () => {
      const payload = { id: 'evt_123', type: 'payment.succeeded' };
      redisService.get.mockResolvedValue(null);
      redisService.set.mockResolvedValue(undefined);
      repo.save.mockResolvedValue({});

      const result = await service.processWebhook(payload, 'stripe');

      expect(result).toEqual({ received: true, processed: true });
      expect(redisService.set).toHaveBeenCalledWith('webhook:evt_123', true, 604800);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt_123', eventType: 'payment.succeeded', source: 'stripe' }),
      );

      // Verify observability calls
      expect(observability.logWebhookReceived).toHaveBeenCalledWith({
        webhookId: 'evt_123',
        eventType: 'payment.succeeded',
        source: 'stripe',
      });
      expect(observability.logWebhookProcessed).toHaveBeenCalledWith(
        {
          webhookId: 'evt_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
        },
        expect.any(Number),
      );
    });

    it('should return idempotent response for duplicate webhook and log hit', async () => {
      const payload = { id: 'evt_123', type: 'test.event' };
      redisService.get.mockResolvedValue(true);

      const result = await service.processWebhook(payload, 'stripe');

      expect(result).toEqual({ received: true, idempotent: true });
      expect(redisService.set).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();

      // Verify observability calls
      expect(observability.logWebhookReceived).toHaveBeenCalled();
      expect(observability.logIdempotencyHit).toHaveBeenCalledWith({
        webhookId: 'evt_123',
        eventType: 'test.event',
        source: 'stripe',
      });
    });

    it('should reject webhook without ID and log failure', async () => {
      const payload = { type: 'test.event' };

      await expect(service.processWebhook(payload, 'stripe')).rejects.toThrow(
        'Webhook payload missing ID for idempotency',
      );

      expect(observability.logWebhookReceived).toHaveBeenCalled();
      expect(observability.logWebhookProcessingFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'test.event',
          source: 'stripe',
        }),
        expect.any(Error),
        expect.any(Number),
      );
    });

    it('should log processing failure on database error', async () => {
      const payload = { id: 'evt_123', type: 'payment.succeeded' };
      const dbError = new Error('Database connection failed');
      
      redisService.get.mockResolvedValue(null);
      redisService.set.mockResolvedValue(undefined);
      repo.save.mockRejectedValue(dbError);

      await expect(service.processWebhook(payload, 'stripe')).rejects.toThrow(dbError);

      expect(observability.logWebhookProcessingFailed).toHaveBeenCalledWith(
        {
          webhookId: 'evt_123',
          eventType: 'payment.succeeded',
          source: 'stripe',
        },
        dbError,
        expect.any(Number),
      );
    });
  });

  describe('listEvents', () => {
    const buildQb = (data: any[], total: number) => {
      const qb: any = {
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([data, total]),
      };
      return qb;
    };

    it('should return paginated events with default params', async () => {
      const events = [{ id: 1 }, { id: 2 }] as WebhookEvent[];
      repo.createQueryBuilder.mockReturnValue(buildQb(events, 2));

      const result = await service.listEvents({});

      expect(result.data).toEqual(events);
      expect(result.meta).toMatchObject({
        page: 1,
        limit: 10,
        totalItems: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('should apply stable sort tiebreaker (id ASC)', async () => {
      const qb = buildQb([], 0);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.listEvents({ sortBy: 'createdAt', sortOrder: SortOrder.DESC });

      expect(qb.orderBy).toHaveBeenCalledWith('we.createdAt', SortOrder.DESC);
      expect(qb.addOrderBy).toHaveBeenCalledWith('we.id', 'ASC');
    });

    it('should fall back to createdAt for unknown sortBy field', async () => {
      const qb = buildQb([], 0);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.listEvents({ sortBy: '__proto__' });

      expect(qb.orderBy).toHaveBeenCalledWith('we.createdAt', SortOrder.ASC);
    });

    it('should calculate pagination meta correctly', async () => {
      repo.createQueryBuilder.mockReturnValue(buildQb([], 25));

      const result = await service.listEvents({ page: 2, limit: 10 });

      expect(result.meta).toMatchObject({
        page: 2,
        limit: 10,
        totalItems: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });
  });
});
