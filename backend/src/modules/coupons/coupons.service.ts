import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Coupon } from './entities/coupon.entity';
import { CouponUsageLog } from './entities/coupon-usage-log.entity';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { FilterCouponsDto } from './dto/filter-coupons.dto';
import {
  ValidateCouponDto,
  CouponValidationResult,
} from './dto/validate-coupon.dto';
import { CouponType } from './enums/coupon-type.enum';

export interface PaginatedCoupons {
  data: Coupon[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Parse a canonical decimal string (e.g. "10.10", "5", "0.005") into integer
 * minor units (2 decimal places). Rejects anything that is not a canonical
 * decimal so that binary floating point never touches coupon money.
 */
function parseMinorUnits(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    throw new BadRequestException('Coupon amount is missing');
  }

  const raw = typeof value === 'number' ? String(value) : value.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new BadRequestException(`Invalid coupon amount: '${raw}'`);
  }

  const [whole, fraction = ''] = raw.split('.');
  const paddedFraction = (fraction + '00').slice(0, 2);

  return parseInt(whole, 10) * 100 + parseInt(paddedFraction, 10);
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @InjectRepository(CouponUsageLog)
    private readonly couponUsageLogRepository: Repository<CouponUsageLog>,
  ) {}

  async create(createCouponDto: CreateCouponDto): Promise<Coupon> {
    const existingCoupon = await this.couponRepository.findOne({
      where: { code: createCouponDto.code },
    });

    if (existingCoupon) {
      throw new ConflictException(
        `Coupon with code '${createCouponDto.code}' already exists`,
      );
    }

    const couponData = {
      code: createCouponDto.code,
      type: createCouponDto.type,
      value: String(createCouponDto.value),
      max_uses: createCouponDto.max_uses,
      active: createCouponDto.active ?? true,
      description: createCouponDto.description,
      item_restriction_id: createCouponDto.item_restriction_id,
      min_purchase_amount: createCouponDto.min_purchase_amount
        ? String(createCouponDto.min_purchase_amount)
        : undefined,
      max_discount_amount: createCouponDto.max_discount_amount
        ? String(createCouponDto.max_discount_amount)
        : undefined,
      expiration: createCouponDto.expiration
        ? new Date(createCouponDto.expiration)
        : undefined,
    };

    const coupon = this.couponRepository.create(couponData);

    return this.couponRepository.save(coupon);
  }

  async findAll(filterDto: FilterCouponsDto): Promise<PaginatedCoupons> {
    const { type, active, page = 1, limit = 20 } = filterDto;

    const qb = this.couponRepository
      .createQueryBuilder('coupon')
      .orderBy('coupon.created_at', 'DESC');

    if (type) {
      qb.andWhere('coupon.type = :type', { type });
    }

    if (active !== undefined) {
      qb.andWhere('coupon.active = :active', { active });
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({
      where: { id },
      relations: ['item_restriction'],
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${id} not found`);
    }

    return coupon;
  }

  async findByCode(code: string): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({
      where: { code },
      relations: ['item_restriction'],
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with code '${code}' not found`);
    }

    return coupon;
  }

  async update(id: number, updateCouponDto: UpdateCouponDto): Promise<Coupon> {
    const coupon = await this.findOne(id);

    const updateData: any = { ...updateCouponDto };

    if (updateCouponDto.value !== undefined) {
      updateData.value = String(updateCouponDto.value);
    }

    if (updateCouponDto.min_purchase_amount !== undefined) {
      updateData.min_purchase_amount = updateCouponDto.min_purchase_amount
        ? String(updateCouponDto.min_purchase_amount)
        : null;
    }

    if (updateCouponDto.max_discount_amount !== undefined) {
      updateData.max_discount_amount = updateCouponDto.max_discount_amount
        ? String(updateCouponDto.max_discount_amount)
        : null;
    }

    if (updateCouponDto.expiration !== undefined) {
      updateData.expiration = updateCouponDto.expiration
        ? new Date(updateCouponDto.expiration)
        : null;
    }

    Object.assign(coupon, updateData);
    return this.couponRepository.save(coupon);
  }

  async remove(id: number): Promise<void> {
    const coupon = await this.findOne(id);
    await this.couponRepository.remove(coupon);
  }

  async validateCoupon(
    validateDto: ValidateCouponDto,
  ): Promise<CouponValidationResult> {
    const { code, shop_item_id, purchase_amount } = validateDto;

    let coupon: Coupon;
    try {
      coupon = await this.findByCode(code);
    } catch (error) {
      return {
        valid: false,
        message: 'Invalid coupon code',
      };
    }

    if (!coupon.active) {
      return {
        valid: false,
        message: 'This coupon is no longer active',
      };
    }

    if (coupon.expiration && new Date(coupon.expiration) < new Date()) {
      return {
        valid: false,
        message: 'This coupon has expired',
      };
    }

    if (coupon.max_uses && coupon.current_usage >= coupon.max_uses) {
      return {
        valid: false,
        message: 'This coupon has reached its usage limit',
      };
    }

    if (
      coupon.item_restriction_id &&
      shop_item_id !== coupon.item_restriction_id
    ) {
      return {
        valid: false,
        message: 'This coupon is not valid for the selected item',
      };
    }

    if (coupon.min_purchase_amount && purchase_amount) {
      const minimumMinorUnits = parseMinorUnits(coupon.min_purchase_amount);
      const purchaseMinorUnits = Math.round(purchase_amount * 100);

      if (purchaseMinorUnits < minimumMinorUnits) {
        return {
          valid: false,
          message: `Minimum purchase amount of ${(minimumMinorUnits / 100).toFixed(2)} required`,
        };
      }
    }

    let discount_amount = 0;
    if (purchase_amount) {
      try {
        discount_amount = this.calculateDiscount(coupon, purchase_amount);
      } catch (error) {
        if (error instanceof BadRequestException) {
          return { valid: false, message: error.message };
        }
        throw error;
      }
    }

    return {
      valid: true,
      message: 'Coupon is valid',
      discount_amount,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      },
    };
  }

  /**
   * Atomically consume one use of a coupon. The conditional update
   * (`current_usage < max_uses`) is the single source of truth for the usage
   * limit: concurrent callers race on the same row and only the one whose
   * update affects a row wins. Callers must run this inside the same
   * transaction as the purchase write so a rolled-back purchase does not
   * consume a use.
   */
  async incrementUsage(
    couponId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager
      ? manager.getRepository(Coupon)
      : this.couponRepository;

    const result = await repository
      .createQueryBuilder()
      .update(Coupon)
      .set({ current_usage: () => 'current_usage + 1' })
      .where('id = :couponId', { couponId })
      .andWhere('(max_uses IS NULL OR current_usage < max_uses)')
      .execute();

    if (!result.affected) {
      throw new ConflictException(
        'This coupon has reached its usage limit',
      );
    }
  }

  calculateDiscount(coupon: Coupon, purchaseAmount: number): number {
    const purchaseMinorUnits = Math.round(purchaseAmount * 100);
    let discountMinorUnits = 0;

    if (coupon.type === CouponType.PERCENTAGE) {
      // Percentage value is expressed in basis points (1% = 100 bps).
      const basisPoints = parseMinorUnits(coupon.value);

      if (basisPoints < 100 || basisPoints > 10000) {
        throw new BadRequestException(
          'Percentage discount must be between 1 and 100',
        );
      }

      discountMinorUnits = Math.floor(
        (purchaseMinorUnits * basisPoints) / 10000,
      );

      if (coupon.max_discount_amount) {
        const capMinorUnits = parseMinorUnits(coupon.max_discount_amount);
        discountMinorUnits = Math.min(discountMinorUnits, capMinorUnits);
      }
    } else if (coupon.type === CouponType.FIXED) {
      discountMinorUnits = parseMinorUnits(coupon.value);

      if (discountMinorUnits > purchaseMinorUnits) {
        throw new BadRequestException(
          'Fixed discount cannot exceed the purchase amount',
        );
      }
    }

    discountMinorUnits = Math.min(discountMinorUnits, purchaseMinorUnits);

    return discountMinorUnits / 100;
  }
}
