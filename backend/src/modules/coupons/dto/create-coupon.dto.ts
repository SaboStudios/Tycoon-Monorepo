import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  IsInt,
  IsBoolean,
  IsDateString,
  ValidateIf,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CouponType } from '../enums/coupon-type.enum';

export class CreateCouponDto {
  @ApiProperty({ description: 'Unique coupon code', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({
    description: 'Type of discount',
    enum: CouponType,
  })
  @IsEnum(CouponType)
  @IsNotEmpty()
  type: CouponType;

  @ApiProperty({
    description: 'Discount value (percentage 0-100 or fixed amount)',
  })
  @Type(() => Number)
  @IsPositive()
  @ValidateIf((o) => o.type === CouponType.PERCENTAGE)
  @Max(100, { message: 'Percentage discount cannot exceed 100' })
  value: number;

  @ApiPropertyOptional({
    description: 'Maximum number of times this coupon can be used',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  max_uses?: number;

  @ApiPropertyOptional({
    description: 'Expiration date and time (ISO 8601 format)',
  })
  @IsOptional()
  @IsDateString()
  expiration?: string;

  @ApiPropertyOptional({
    description: 'Shop item ID this coupon is restricted to (null for global)',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @IsPositive()
  item_restriction_id?: number;

  @ApiPropertyOptional({
    description: 'Whether the coupon is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Description of the coupon',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Minimum purchase amount required to use this coupon',
  })
  @Type(() => Number)
  @IsOptional()
  @IsPositive()
  min_purchase_amount?: number;

  @ApiPropertyOptional({
    description: 'Maximum discount amount (for percentage coupons)',
  })
  @Type(() => Number)
  @IsOptional()
  @IsPositive()
  max_discount_amount?: number;
}
