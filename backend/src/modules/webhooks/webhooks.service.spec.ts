import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { WebhooksService } from './webhooks.service';
import { RedisService } from '../redis/redis.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [
        WebhooksService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({ test: 'data' });
      const secret = 'test_secret';
      const signedPayload = `${timestamp}.${body}`;
      const signature = require('crypto')
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      // Mock config to return our test secret
      jest.spyOn(service as any, 'webhookSecret', 'get').mockReturnValue(secret);

      const result = service.verifySignature(signature, timestamp, Buffer.from(body));
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({ test: 'data' });

      jest.spyOn(service as any, 'webhookSecret', 'get').mockReturnValue('test_secret');

      expect(() => {
        service.verifySignature('invalid_signature', timestamp, Buffer.from(body));
      }).toThrow('Invalid webhook signature');
    });

    it('should reject timestamp outside tolerance', () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400 seconds ago
      const body = JSON.stringify({ test: 'data' });

      jest.spyOn(service as any, 'webhookSecret', 'get').mockReturnValue('test_secret');

      expect(() => {
        service.verifySignature('signature', oldTimestamp, Buffer.from(body));
      }).toThrow('Webhook timestamp outside of tolerance');
    });
  });

  describe('processWebhook', () => {
    it('should process new webhook', async () => {
      const payload = { id: 'evt_123', type: 'test.event' };
      redisService.get.mockResolvedValue(null);
      redisService.set.mockResolvedValue(undefined);

      const result = await service.processWebhook(payload);

      expect(result).toEqual({ received: true, processed: true });
      expect(redisService.get).toHaveBeenCalledWith('webhook:evt_123');
      expect(redisService.set).toHaveBeenCalledWith('webhook:evt_123', true, 604800);
    });

    it('should return idempotent response for duplicate webhook', async () => {
      const payload = { id: 'evt_123', type: 'test.event' };
      redisService.get.mockResolvedValue(true);

      const result = await service.processWebhook(payload);

      expect(result).toEqual({ received: true, idempotent: true });
      expect(redisService.get).toHaveBeenCalledWith('webhook:evt_123');
      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('should reject webhook without ID', async () => {
      const payload = { type: 'test.event' };

      await expect(service.processWebhook(payload)).rejects.toThrow(
        'Webhook payload missing ID for idempotency'
      );
    });
  });
});