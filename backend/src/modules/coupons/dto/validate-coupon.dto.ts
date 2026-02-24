import { IsNotEmpty, IsString, IsOptional, IsInt, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ValidateCouponDto {
  @ApiProperty({ description: 'Coupon code to validate' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: 'Shop item ID (for item-specific coupons)' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @IsPositive()
  shop_item_id?: number;

  @ApiPropertyOptional({ description: 'Purchase amount to validate against' })
  @Type(() => Number)
  @IsOptional()
  @IsPositive()
  purchase_amount?: number;
}

export class CouponValidationResult {
  valid: boolean;
  message?: string;
  discount_amount?: number;
  coupon?: {
    id: number;
    code: string;
    type: string;
    value: string;
  };
}
