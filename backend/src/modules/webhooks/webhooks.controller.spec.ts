import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { SortOrder } from '../../common/dto/pagination.dto';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: jest.Mocked<WebhooksService>;

  beforeEach(async () => {
    const mockWebhooksService = {
      verifySignature: jest.fn(),
      processWebhook: jest.fn(),
      listEvents: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [{ provide: WebhooksService, useValue: mockWebhooksService }],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    service = module.get(WebhooksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleStripeWebhook', () => {
    const mockReq = { rawBody: Buffer.from('test') };
    const mockBody = { id: 'evt_123', type: 'test.event' };

    it('should process valid webhook', async () => {
      service.verifySignature.mockReturnValue(true);
      service.processWebhook.mockResolvedValue({ received: true, processed: true });

      const result = await controller.handleStripeWebhook(
        'valid_signature',
        '1234567890',
        mockReq as any,
        mockBody as any,
      );

      expect(result).toEqual({ received: true, processed: true });
      expect(service.verifySignature).toHaveBeenCalledWith('valid_signature', '1234567890', mockReq.rawBody);
      expect(service.processWebhook).toHaveBeenCalledWith(mockBody);
    });

    it('should throw UnauthorizedException for invalid signature', async () => {
      service.verifySignature.mockReturnValue(false);

      await expect(
        controller.handleStripeWebhook('invalid_signature', '1234567890', mockReq as any, mockBody as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException for processing errors', async () => {
      service.verifySignature.mockReturnValue(true);
      service.processWebhook.mockRejectedValue(new Error('Processing failed'));

      await expect(
        controller.handleStripeWebhook('valid_signature', '1234567890', mockReq as any, mockBody as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listEvents', () => {
    const paginatedResult = {
      data: [{ id: 1, eventId: 'evt_1', eventType: 'payment.succeeded', source: 'stripe' }],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    };

    it('should return paginated events', async () => {
      service.listEvents.mockResolvedValue(paginatedResult as any);

      const result = await controller.listEvents({ page: 1, limit: 10 });

      expect(result).toEqual(paginatedResult);
      expect(service.listEvents).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it('should forward sortBy and sortOrder to service', async () => {
      service.listEvents.mockResolvedValue(paginatedResult as any);

      await controller.listEvents({ page: 1, limit: 5, sortBy: 'eventType', sortOrder: SortOrder.DESC });

      expect(service.listEvents).toHaveBeenCalledWith({
        page: 1,
        limit: 5,
        sortBy: 'eventType',
        sortOrder: SortOrder.DESC,
      });
    });
  });
});
