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
import { MAX_PURCHASE_QUANTITY } from './create-purchase.dto';

export class PurchaseAndGiftDto {
  @ApiProperty({ description: 'ID of the shop item to purchase and gift' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  shop_item_id: number;

  @ApiProperty({ description: 'ID of the user receiving the gift' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  receiver_id: number;

  @ApiPropertyOptional({
    description: `Quantity of items to purchase and gift (max ${MAX_PURCHASE_QUANTITY})`,
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
    description: 'Personal message to include with the gift',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional({
    description: 'Payment method (future use)',
    default: 'balance',
  })
  @IsOptional()
  @IsString()
  payment_method?: string;
}
