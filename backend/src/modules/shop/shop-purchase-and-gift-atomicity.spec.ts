import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopItem } from './entities/shop-item.entity';
import { Purchase } from './entities/purchase.entity';
import { UsersService } from '../users/users.service';
import { GiftsService } from '../gifts/gifts.service';
import { RedisService } from '../redis/redis.service';
import { PaginationService } from '../../common/services/pagination.service';
import { repositoryMockFactory } from '../../../test/mocks/database.mock';
import { NotificationsService } from '../fetch-notification/notifications.service';

const mockShopItem: Partial<ShopItem> = {
  id: 1,
  name: 'Skin A',
  price: '9.99',
  currency: 'USD',
  active: true,
};

const makePurchaseQr = (overrides: {
  purchaseSaveFails?: boolean;
  giftSaveFails?: boolean;
}) => {
  let callCount = 0;
  const qr = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn((_, data) => ({ ...data, id: ++callCount })),
      save: jest.fn(),
    },
  };

  qr.manager.save.mockImplementation((obj: { id?: number }) => {
    if (overrides.purchaseSaveFails && obj.id === 1) {
      return Promise.reject(new Error('purchase save failed'));
    }
    if (overrides.giftSaveFails && obj.id === 2) {
      return Promise.reject(new Error('gift save failed'));
    }
    return Promise.resolve({ ...obj, id: obj.id ?? 99 });
  });

  return qr;
};

describe('ShopService – purchaseAndGift atomicity (#1294)', () => {
  let service: ShopService;
  let mockDataSource: { createQueryRunner: jest.Mock };

  const mockUsersService = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
  const mockGiftsService = {};
  const mockRedisService = { delByPattern: jest.fn() };
  const mockPaginationService = { paginate: jest.fn() };
  const mockNotificationsService = {
    create: jest.fn().mockResolvedValue({ id: 'n1' }),
  };

  beforeEach(async () => {
    mockDataSource = { createQueryRunner: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopService,
        { provide: getRepositoryToken(ShopItem), useFactory: repositoryMockFactory },
        { provide: getRepositoryToken(Purchase), useFactory: repositoryMockFactory },
        { provide: UsersService, useValue: mockUsersService },
        { provide: GiftsService, useValue: mockGiftsService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: RedisService, useValue: mockRedisService },
        { provide: PaginationService, useValue: mockPaginationService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<ShopService>(ShopService);

    jest.spyOn(service, 'findOne').mockResolvedValue(mockShopItem as ShopItem);
  });

  afterEach(() => jest.clearAllMocks());

  it('commits purchase and gift in a single transaction on success', async () => {
    const qr = makePurchaseQr({});
    mockDataSource.createQueryRunner.mockReturnValue(qr);

    const result = await service.purchaseAndGift(1, {
      shop_item_id: 1,
      receiver_id: 2,
      quantity: 1,
    });

    expect(result.purchase).toBeDefined();
    expect(result.gift).toBeDefined();
    expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
    expect(qr.rollbackTransaction).not.toHaveBeenCalled();
    expect(qr.release).toHaveBeenCalled();
    expect(mockNotificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: '2' }),
    );
  });

  it('sets correct price fields on the purchase record', async () => {
    const qr = makePurchaseQr({});
    mockDataSource.createQueryRunner.mockReturnValue(qr);

    await service.purchaseAndGift(1, { shop_item_id: 1, receiver_id: 2 });

    const purchaseData = qr.manager.create.mock.calls[0][1];
    expect(purchaseData.original_price).toBe('9.99');
    expect(purchaseData.discount_amount).toBe('0.00');
    expect(purchaseData.final_price).toBe('9.99');
    expect(purchaseData.status).toBe('completed');
  });

  it('keeps the committed gift when notification fails', async () => {
    const qr = makePurchaseQr({});
    mockDataSource.createQueryRunner.mockReturnValue(qr);
    mockNotificationsService.create.mockRejectedValueOnce(new Error('offline'));

    await expect(
      service.purchaseAndGift(1, {
        shop_item_id: 1,
        receiver_id: 2,
      }),
    ).resolves.toBeDefined();
    expect(qr.commitTransaction).toHaveBeenCalled();
    expect(qr.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('rolls back when gift save fails (atomicity)', async () => {
    const qr = makePurchaseQr({ giftSaveFails: true });
    mockDataSource.createQueryRunner.mockReturnValue(qr);

    await expect(
      service.purchaseAndGift(1, { shop_item_id: 1, receiver_id: 2 }),
    ).rejects.toThrow('gift save failed');

    expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(qr.commitTransaction).not.toHaveBeenCalled();
    expect(qr.release).toHaveBeenCalled();
  });

  it('rolls back when purchase save fails', async () => {
    const qr = makePurchaseQr({ purchaseSaveFails: true });
    mockDataSource.createQueryRunner.mockReturnValue(qr);

    await expect(
      service.purchaseAndGift(1, { shop_item_id: 1, receiver_id: 2 }),
    ).rejects.toThrow('purchase save failed');

    expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(qr.release).toHaveBeenCalled();
  });

  it('throws BadRequestException when sender === receiver', async () => {
    const qr = makePurchaseQr({});
    mockDataSource.createQueryRunner.mockReturnValue(qr);

    await expect(
      service.purchaseAndGift(1, { shop_item_id: 1, receiver_id: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(qr.rollbackTransaction).toHaveBeenCalled();
  });

  it('throws BadRequestException when shop item is inactive', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({ ...mockShopItem, active: false } as ShopItem);
    const qr = makePurchaseQr({});
    mockDataSource.createQueryRunner.mockReturnValue(qr);

    await expect(
      service.purchaseAndGift(1, { shop_item_id: 1, receiver_id: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(qr.rollbackTransaction).toHaveBeenCalled();
  });

  it('always releases the query runner even on error', async () => {
    const qr = makePurchaseQr({ giftSaveFails: true });
    mockDataSource.createQueryRunner.mockReturnValue(qr);

    await expect(
      service.purchaseAndGift(1, { shop_item_id: 1, receiver_id: 2 }),
    ).rejects.toThrow();

    expect(qr.release).toHaveBeenCalledTimes(1);
  });
});
