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
    description: 'Quantity of items to purchase and gift',
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
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
