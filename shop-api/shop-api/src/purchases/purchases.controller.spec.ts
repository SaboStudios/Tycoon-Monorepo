import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { Purchase, PurchaseStatus } from './entities/purchase.entity';

const mockPurchase: Purchase = {
  id: 'purchase-uuid-1',
  userId: 'user-1',
  itemId: 'item-42',
  amount: 19.99,
  status: PurchaseStatus.COMPLETED,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockService = {
  create: jest.fn(),
  findOne: jest.fn(),
};

describe('PurchasesController', () => {
  let controller: PurchasesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchasesController],
      providers: [{ provide: PurchasesService, useValue: mockService }],
    }).compile();

    controller = module.get(PurchasesController);
    jest.clearAllMocks();
  });

  const dto = { userId: 'user-1', itemId: 'item-42', amount: 19.99 };

  // ── POST /purchases ───────────────────────────────────────────────────────

  it('creates a purchase when a valid idempotency key is provided', async () => {
    mockService.create.mockResolvedValue(mockPurchase);

    const result = await controller.create(dto, 'valid-key-001');

    expect(mockService.create).toHaveBeenCalledWith(dto, 'valid-key-001');
    expect(result).toEqual(mockPurchase);
  });

  it('throws BadRequestException when Idempotency-Key header is missing', async () => {
    await expect(
      controller.create(dto, undefined as unknown as string),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockService.create).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when Idempotency-Key is empty string', async () => {
    await expect(controller.create(dto, '  ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws BadRequestException when Idempotency-Key exceeds 255 chars', async () => {
    const longKey = 'a'.repeat(256);
    await expect(controller.create(dto, longKey)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('propagates ConflictException from service (concurrent duplicate)', async () => {
    mockService.create.mockRejectedValue(
      new ConflictException('Already processing'),
    );

    await expect(
      controller.create(dto, 'concurrent-key'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // ── GET /purchases/:id ────────────────────────────────────────────────────

  it('returns a purchase by ID', async () => {
    mockService.findOne.mockResolvedValue(mockPurchase);

    const result = await controller.findOne('purchase-uuid-1');
    expect(result).toEqual(mockPurchase);
  });

  it('throws NotFoundException when purchase does not exist', async () => {
    mockService.findOne.mockResolvedValue(null);

    await expect(controller.findOne('nonexistent-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
