import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { Coupon } from './entities/coupon.entity';
import { CouponUsageLog } from './entities/coupon-usage-log.entity';
import { CouponType } from './enums/coupon-type.enum';

const mockCoupon: Partial<Coupon> = {
  id: 1,
  code: 'SAVE10',
  type: CouponType.FIXED,
  value: '10',
  max_uses: 100,
  current_usage: 0,
  active: true,
  expiration: new Date('2099-12-31'),
  item_restriction_id: null,
  min_purchase_amount: null,
  max_discount_amount: null,
};

const mockCouponRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
const mockUsageLogRepo = { createQueryBuilder: jest.fn() };

const buildQr = (coupon: Partial<Coupon> | null, existingLog: Partial<CouponUsageLog> | null) => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    findOne: jest.fn((entity: unknown) => {
      if (entity === Coupon) return Promise.resolve(coupon);
      if (entity === CouponUsageLog) return Promise.resolve(existingLog);
      return Promise.resolve(null);
    }),
    increment: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((_, data) => ({ ...data, id: 99 })),
    save: jest.fn((obj) => Promise.resolve(obj)),
  },
});

describe('CouponsService – redeemCoupon idempotency (#1295)', () => {
  let service: CouponsService;
  let mockDataSource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    mockDataSource = { createQueryRunner: jest.fn() };
    mockCouponRepo.findOne.mockResolvedValue(mockCoupon);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: getRepositoryToken(Coupon), useValue: mockCouponRepo },
        { provide: getRepositoryToken(CouponUsageLog), useValue: mockUsageLogRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('redeems a valid coupon and returns discount + log', async () => {
    const qr = buildQr(mockCoupon, null);
    mockDataSource.createQueryRunner.mockReturnValue(qr);

    const result = await service.redeemCoupon(1, 'SAVE10', 50);

    expect(result.discountAmount).toBe(10);
    expect(qr.manager.increment).toHaveBeenCalledWith(Coupon, { id: 1 }, 'current_usage', 1);
    expect(qr.commitTransaction).toHaveBeenCalled();
  });

  it('throws ConflictException when same user redeems the same coupon twice', async () => {
    const existingLog: Partial<CouponUsageLog> = { id: 5, coupon_id: 1, user_id: 1 };
    const qr = buildQr(mockCoupon, existingLog);
    mockDataSource.createQueryRunner.mockReturnValue(qr);

    await expect(service.redeemCoupon(1, 'SAVE10', 50)).rejects.toBeInstanceOf(ConflictException);
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(qr.manager.increment).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for an unknown coupon code', async () => {
    const qr = buildQr(null, null);
    mockDataSource.createQueryRunner.mockReturnValue(qr);

    await expect(service.redeemCoupon(1, 'UNKNOWN', 50)).rejects.toBeInstanceOf(BadRequestException);
    expect(qr.rollbackTransaction).toHaveBeenCalled();
  });

  it('throws BadRequestException when coupon is inactive', async () => {
    const inactiveCoupon = { ...mockCoupon, active: false };
    const qr = buildQr(inactiveCoupon, null);
    mockDataSource.createQueryRunner.mockReturnValue(qr);

    mockCouponRepo.findOne.mockResolvedValue(inactiveCoupon);

    await expect(service.redeemCoupon(1, 'SAVE10', 50)).rejects.toBeInstanceOf(BadRequestException);
    expect(qr.rollbackTransaction).toHaveBeenCalled();
  });

  it('different users can redeem the same coupon independently', async () => {
    const qrUser1 = buildQr(mockCoupon, null);
    const qrUser2 = buildQr(mockCoupon, null);
    mockDataSource.createQueryRunner
      .mockReturnValueOnce(qrUser1)
      .mockReturnValueOnce(qrUser2);

    const r1 = await service.redeemCoupon(1, 'SAVE10', 50);
    const r2 = await service.redeemCoupon(2, 'SAVE10', 50);

    expect(r1.discountAmount).toBe(10);
    expect(r2.discountAmount).toBe(10);
    expect(qrUser1.commitTransaction).toHaveBeenCalled();
    expect(qrUser2.commitTransaction).toHaveBeenCalled();
  });

  it('rolls back and rethrows on unexpected error', async () => {
    const qr = buildQr(mockCoupon, null);
    qr.manager.increment.mockRejectedValueOnce(new Error('DB error'));
    mockDataSource.createQueryRunner.mockReturnValue(qr);

    await expect(service.redeemCoupon(1, 'SAVE10', 50)).rejects.toThrow('DB error');
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(qr.release).toHaveBeenCalled();
  });
});
