import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { WebhooksService } from './webhooks.service';
import { RedisService } from '../redis/redis.service';
import { WebhookEvent } from './entities/webhook-event.entity';
import { SortOrder } from '../../common/dto/pagination.dto';

const mockRepo = () => ({
  create: jest.fn((v) => v),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('WebhooksService', () => {
  let service: WebhooksService;
  let redisService: jest.Mocked<RedisService>;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    repo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: getRepositoryToken(WebhookEvent), useValue: repo },
        { provide: ConfigService, useValue: new ConfigService({ WEBHOOK_SECRET: 'test_secret' }) },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    redisService = module.get(RedisService);
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

    it('should verify valid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({ test: 'data' });
      const signedPayload = `${timestamp}.${body}`;
      const signature = require('crypto')
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      const result = service.verifySignature(signature, timestamp, Buffer.from(body));
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({ test: 'data' });

      // Invalid hex signature of wrong length returns false (no throw)
      const result = service.verifySignature('aabbcc', timestamp, Buffer.from(body));
      expect(result).toBe(false);
    });

    it('should reject timestamp outside tolerance', () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
      const body = JSON.stringify({ test: 'data' });

      expect(() => {
        service.verifySignature('signature', oldTimestamp, Buffer.from(body));
      }).toThrow('Webhook timestamp outside of tolerance');
    });
  });

  describe('processWebhook', () => {
    it('should process new webhook and persist event', async () => {
      const payload = { id: 'evt_123', type: 'payment.succeeded' };
      redisService.get.mockResolvedValue(null);
      redisService.set.mockResolvedValue(undefined);
      repo.save.mockResolvedValue({});

      const result = await service.processWebhook(payload);

      expect(result).toEqual({ received: true, processed: true });
      expect(redisService.set).toHaveBeenCalledWith('webhook:evt_123', true, 604800);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt_123', eventType: 'payment.succeeded', source: 'stripe' }),
      );
    });

    it('should return idempotent response for duplicate webhook', async () => {
      const payload = { id: 'evt_123', type: 'test.event' };
      redisService.get.mockResolvedValue(true);

      const result = await service.processWebhook(payload);

      expect(result).toEqual({ received: true, idempotent: true });
      expect(redisService.set).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should reject webhook without ID', async () => {
      await expect(service.processWebhook({ type: 'test.event' })).rejects.toThrow(
        'Webhook payload missing ID for idempotency',
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
