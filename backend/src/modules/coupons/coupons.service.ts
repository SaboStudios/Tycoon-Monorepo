import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Coupon } from './entities/coupon.entity';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { FilterCouponsDto } from './dto/filter-coupons.dto';
import { ValidateCouponDto, CouponValidationResult } from './dto/validate-coupon.dto';
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

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
  ) {}

  async create(createCouponDto: CreateCouponDto): Promise<Coupon> {
    const existingCoupon = await this.couponRepository.findOne({
      where: { code: createCouponDto.code },
    });

    if (existingCoupon) {
      throw new ConflictException(`Coupon with code '${createCouponDto.code}' already exists`);
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
      expiration: createCouponDto.expiration ? new Date(createCouponDto.expiration) : undefined,
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

  async validateCoupon(validateDto: ValidateCouponDto): Promise<CouponValidationResult> {
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

    if (coupon.item_restriction_id && shop_item_id !== coupon.item_restriction_id) {
      return {
        valid: false,
        message: 'This coupon is not valid for the selected item',
      };
    }

    if (
      coupon.min_purchase_amount &&
      purchase_amount &&
      purchase_amount < parseFloat(coupon.min_purchase_amount)
    ) {
      return {
        valid: false,
        message: `Minimum purchase amount of ${coupon.min_purchase_amount} required`,
      };
    }

    let discount_amount = 0;
    if (purchase_amount) {
      discount_amount = this.calculateDiscount(coupon, purchase_amount);
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

  calculateDiscount(coupon: Coupon, purchaseAmount: number): number {
    let discount = 0;

    if (coupon.type === CouponType.PERCENTAGE) {
      discount = (purchaseAmount * parseFloat(coupon.value)) / 100;

      if (coupon.max_discount_amount) {
        discount = Math.min(discount, parseFloat(coupon.max_discount_amount));
      }
    } else if (coupon.type === CouponType.FIXED) {
      discount = parseFloat(coupon.value);
    }

    return Math.min(discount, purchaseAmount);
  }

  async incrementUsage(id: number): Promise<void> {
    await this.couponRepository.increment({ id }, 'current_usage', 1);
  }

  async applyCoupon(code: string, shop_item_id: number, purchase_amount: number): Promise<number> {
    const validation = await this.validateCoupon({
      code,
      shop_item_id,
      purchase_amount,
    });

    if (!validation.valid || !validation.coupon) {
      throw new BadRequestException(validation.message);
    }

    await this.incrementUsage(validation.coupon.id);

    return validation.discount_amount || 0;
  }
}
