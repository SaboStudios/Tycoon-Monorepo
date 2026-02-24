import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePurchaseDto {
  @ApiProperty({ description: 'Shop item ID to purchase' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  shop_item_id: number;

  @ApiPropertyOptional({
    description: 'Quantity to purchase',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Coupon code to apply',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  coupon_code?: string;
}
