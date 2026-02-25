import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GiftsService } from './gifts.service';
import { Gift } from './entities/gift.entity';
import { GiftStatus } from './enums/gift-status.enum';
import { ShopService } from '../shop/shop.service';
import { UsersService } from '../users/users.service';
import {
  repositoryMockFactory,
  MockType,
} from '../../../test/mocks/database.mock';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { GiftResponse } from './dto/respond-gift.dto';

describe('GiftsService', () => {
  let service: GiftsService;
  let repositoryMock: MockType<Repository<Gift>>;
  let dataSourceMock: MockType<DataSource>;

  const mockShopService = {
    findOne: jest.fn(),
  };

  const mockUsersService = {
    findOne: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      save: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftsService,
        {
          provide: getRepositoryToken(Gift),
          useFactory: repositoryMockFactory,
        },
        {
          provide: ShopService,
          useValue: mockShopService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(() => mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<GiftsService>(GiftsService);
    repositoryMock = module.get(getRepositoryToken(Gift));
    dataSourceMock = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new gift', async () => {
      const senderId = 1;
      const createGiftDto = {
        receiver_id: 2,
        shop_item_id: 1,
        quantity: 1,
        message: 'Happy birthday!',
        expiration_hours: 168,
      };

      const mockUser = { id: 1, email: 'test@example.com' };
      const mockShopItem = { id: 1, name: 'Test Item', active: true };
      const mockGift = {
        id: 1,
        sender_id: senderId,
        ...createGiftDto,
        status: GiftStatus.PENDING,
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);
      mockShopService.findOne.mockResolvedValue(mockShopItem);
      repositoryMock.create!.mockReturnValue(mockGift);
      repositoryMock.save!.mockResolvedValue(mockGift);

      const result = await service.create(senderId, createGiftDto);

      expect(result).toEqual(mockGift);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(senderId);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(createGiftDto.receiver_id);
      expect(mockShopService.findOne).toHaveBeenCalledWith(createGiftDto.shop_item_id);
      expect(repositoryMock.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if sender gifts to themselves', async () => {
      const senderId = 1;
      const createGiftDto = {
        receiver_id: 1,
        shop_item_id: 1,
        quantity: 1,
      };

      await expect(service.create(senderId, createGiftDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if shop item is not active', async () => {
      const senderId = 1;
      const createGiftDto = {
        receiver_id: 2,
        shop_item_id: 1,
        quantity: 1,
      };

      const mockUser = { id: 1, email: 'test@example.com' };
      const mockShopItem = { id: 1, name: 'Test Item', active: false };

      mockUsersService.findOne.mockResolvedValue(mockUser);
      mockShopService.findOne.mockResolvedValue(mockShopItem);

      await expect(service.create(senderId, createGiftDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a gift if user is sender', async () => {
      const giftId = 1;
      const userId = 1;
      const mockGift = {
        id: giftId,
        sender_id: userId,
        receiver_id: 2,
        status: GiftStatus.PENDING,
      };

      repositoryMock.findOne!.mockResolvedValue(mockGift);

      const result = await service.findOne(giftId, userId);

      expect(result).toEqual(mockGift);
    });

    it('should return a gift if user is receiver', async () => {
      const giftId = 1;
      const userId = 2;
      const mockGift = {
        id: giftId,
        sender_id: 1,
        receiver_id: userId,
        status: GiftStatus.PENDING,
      };

      repositoryMock.findOne!.mockResolvedValue(mockGift);

      const result = await service.findOne(giftId, userId);

      expect(result).toEqual(mockGift);
    });

    it('should throw NotFoundException if gift not found', async () => {
      repositoryMock.findOne!.mockResolvedValue(null);

      await expect(service.findOne(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not sender or receiver', async () => {
      const mockGift = {
        id: 1,
        sender_id: 1,
        receiver_id: 2,
        status: GiftStatus.PENDING,
      };

      repositoryMock.findOne!.mockResolvedValue(mockGift);

      await expect(service.findOne(1, 3)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('respondToGift', () => {
    it('should accept a gift', async () => {
      const giftId = 1;
      const receiverId = 2;
      const mockGift = {
        id: giftId,
        sender_id: 1,
        receiver_id: receiverId,
        status: GiftStatus.PENDING,
        expiration: new Date(Date.now() + 86400000),
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockGift);
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockGift,
        status: GiftStatus.ACCEPTED,
      });

      const result = await service.respondToGift(
        giftId,
        receiverId,
        GiftResponse.ACCEPT,
      );

      expect(result.status).toBe(GiftStatus.ACCEPTED);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reject a gift', async () => {
      const giftId = 1;
      const receiverId = 2;
      const mockGift = {
        id: giftId,
        sender_id: 1,
        receiver_id: receiverId,
        status: GiftStatus.PENDING,
        expiration: new Date(Date.now() + 86400000),
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockGift);
      mockQueryRunner.manager.save.mockResolvedValue({
        ...mockGift,
        status: GiftStatus.REJECTED,
      });

      const result = await service.respondToGift(
        giftId,
        receiverId,
        GiftResponse.REJECT,
      );

      expect(result.status).toBe(GiftStatus.REJECTED);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not receiver', async () => {
      const mockGift = {
        id: 1,
        sender_id: 1,
        receiver_id: 2,
        status: GiftStatus.PENDING,
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockGift);

      await expect(
        service.respondToGift(1, 3, GiftResponse.ACCEPT),
      ).rejects.toThrow(ForbiddenException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if gift is not pending', async () => {
      const mockGift = {
        id: 1,
        sender_id: 1,
        receiver_id: 2,
        status: GiftStatus.ACCEPTED,
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockGift);

      await expect(
        service.respondToGift(1, 2, GiftResponse.ACCEPT),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('cancelGift', () => {
    it('should cancel a pending gift', async () => {
      const giftId = 1;
      const senderId = 1;
      const mockGift = {
        id: giftId,
        sender_id: senderId,
        receiver_id: 2,
        status: GiftStatus.PENDING,
      };

      repositoryMock.findOne!.mockResolvedValue(mockGift);
      repositoryMock.save!.mockResolvedValue({
        ...mockGift,
        status: GiftStatus.CANCELLED,
      });

      const result = await service.cancelGift(giftId, senderId);

      expect(result.status).toBe(GiftStatus.CANCELLED);
    });

    it('should throw ForbiddenException if user is not sender', async () => {
      const mockGift = {
        id: 1,
        sender_id: 1,
        receiver_id: 2,
        status: GiftStatus.PENDING,
      };

      repositoryMock.findOne!.mockResolvedValue(mockGift);

      await expect(service.cancelGift(1, 2)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('expireOldGifts', () => {
    it('should expire old pending gifts', async () => {
      repositoryMock.update!.mockResolvedValue({ affected: 5 });

      const result = await service.expireOldGifts();

      expect(result).toBe(5);
      expect(repositoryMock.update).toHaveBeenCalled();
    });
  });
});
