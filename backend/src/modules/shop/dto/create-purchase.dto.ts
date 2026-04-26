import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/** Maximum quantity per single purchase to prevent abuse. */
export const MAX_PURCHASE_QUANTITY = 100;

export class CreatePurchaseDto {
  @ApiProperty({ description: 'Shop item ID to purchase' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  shop_item_id: number;

  @ApiPropertyOptional({
    description: `Quantity to purchase (max ${MAX_PURCHASE_QUANTITY})`,
    default: 1,
    minimum: 1,
    maximum: MAX_PURCHASE_QUANTITY,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PURCHASE_QUANTITY)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Coupon code to apply',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  coupon_code?: string;

  @ApiPropertyOptional({
    description: 'Idempotency key to prevent duplicate purchases',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotency_key?: string;
}
