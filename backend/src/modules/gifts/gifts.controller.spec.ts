import { Test, TestingModule } from '@nestjs/testing';
import { GiftsController } from './gifts.controller';
import { GiftsService } from './gifts.service';
import { CreateGiftDto } from './dto/create-gift.dto';
import { GiftStatus } from './enums/gift-status.enum';
import { GiftResponse } from './dto/respond-gift.dto';

describe('GiftsController', () => {
  let controller: GiftsController;
  let service: GiftsService;

  const mockGiftsService = {
    create: jest.fn(),
    findSentGifts: jest.fn(),
    findReceivedGifts: jest.fn(),
    findOne: jest.fn(),
    respondToGift: jest.fn(),
    cancelGift: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GiftsController],
      providers: [
        {
          provide: GiftsService,
          useValue: mockGiftsService,
        },
      ],
    }).compile();

    controller = module.get<GiftsController>(GiftsController);
    service = module.get<GiftsService>(GiftsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a gift', async () => {
      const user = { id: 1 };
      const createGiftDto: CreateGiftDto = {
        receiver_id: 2,
        shop_item_id: 1,
        quantity: 1,
        message: 'Happy birthday!',
      };

      const mockGift = {
        id: 1,
        sender_id: user.id,
        ...createGiftDto,
        status: GiftStatus.PENDING,
      };

      mockGiftsService.create.mockResolvedValue(mockGift);

      const result = await controller.create(user, createGiftDto);

      expect(result).toEqual(mockGift);
      expect(service.create).toHaveBeenCalledWith(user.id, createGiftDto);
    });
  });

  describe('findSentGifts', () => {
    it('should return sent gifts', async () => {
      const user = { id: 1 };
      const filterDto = { page: 1, limit: 20 };
      const mockResponse = {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockGiftsService.findSentGifts.mockResolvedValue(mockResponse);

      const result = await controller.findSentGifts(user, filterDto);

      expect(result).toEqual(mockResponse);
      expect(service.findSentGifts).toHaveBeenCalledWith(user.id, filterDto);
    });
  });

  describe('findReceivedGifts', () => {
    it('should return received gifts', async () => {
      const user = { id: 1 };
      const filterDto = { page: 1, limit: 20 };
      const mockResponse = {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockGiftsService.findReceivedGifts.mockResolvedValue(mockResponse);

      const result = await controller.findReceivedGifts(user, filterDto);

      expect(result).toEqual(mockResponse);
      expect(service.findReceivedGifts).toHaveBeenCalledWith(
        user.id,
        filterDto,
      );
    });
  });

  describe('findOne', () => {
    it('should return a gift', async () => {
      const user = { id: 1 };
      const giftId = 1;
      const mockGift = {
        id: giftId,
        sender_id: user.id,
        receiver_id: 2,
        status: GiftStatus.PENDING,
      };

      mockGiftsService.findOne.mockResolvedValue(mockGift);

      const result = await controller.findOne(user, giftId);

      expect(result).toEqual(mockGift);
      expect(service.findOne).toHaveBeenCalledWith(giftId, user.id);
    });
  });

  describe('respondToGift', () => {
    it('should accept a gift', async () => {
      const user = { id: 2 };
      const giftId = 1;
      const respondDto = { action: GiftResponse.ACCEPT };
      const mockGift = {
        id: giftId,
        sender_id: 1,
        receiver_id: user.id,
        status: GiftStatus.ACCEPTED,
      };

      mockGiftsService.respondToGift.mockResolvedValue(mockGift);

      const result = await controller.respondToGift(user, giftId, respondDto);

      expect(result).toEqual(mockGift);
      expect(service.respondToGift).toHaveBeenCalledWith(
        giftId,
        user.id,
        respondDto.action,
      );
    });
  });

  describe('cancelGift', () => {
    it('should cancel a gift', async () => {
      const user = { id: 1 };
      const giftId = 1;
      const mockGift = {
        id: giftId,
        sender_id: user.id,
        receiver_id: 2,
        status: GiftStatus.CANCELLED,
      };

      mockGiftsService.cancelGift.mockResolvedValue(mockGift);

      const result = await controller.cancelGift(user, giftId);

      expect(result).toEqual(mockGift);
      expect(service.cancelGift).toHaveBeenCalledWith(giftId, user.id);
    });
  });
});
