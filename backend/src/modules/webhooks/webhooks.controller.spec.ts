import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: jest.Mocked<WebhooksService>;

  beforeEach(async () => {
    const mockWebhooksService = {
      verifySignature: jest.fn(),
      processWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
        },
      ],
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
      service.processWebhook.mockResolvedValue({ received: true });

      const result = await controller.handleStripeWebhook(
        'valid_signature',
        '1234567890',
        mockReq as any,
        mockBody
      );

      expect(result).toEqual({ received: true });
      expect(service.verifySignature).toHaveBeenCalledWith('valid_signature', '1234567890', mockReq.rawBody);
      expect(service.processWebhook).toHaveBeenCalledWith(mockBody);
    });

    it('should throw UnauthorizedException for invalid signature', async () => {
      service.verifySignature.mockReturnValue(false);

      await expect(
        controller.handleStripeWebhook(
          'invalid_signature',
          '1234567890',
          mockReq as any,
          mockBody
        )
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException for processing errors', async () => {
      service.verifySignature.mockReturnValue(true);
      service.processWebhook.mockRejectedValue(new Error('Processing failed'));

      await expect(
        controller.handleStripeWebhook(
          'valid_signature',
          '1234567890',
          mockReq as any,
          mockBody
        )
      ).rejects.toThrow(BadRequestException);
    });
  });
});