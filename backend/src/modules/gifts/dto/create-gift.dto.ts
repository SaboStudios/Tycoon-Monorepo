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

export class CreateGiftDto {
  @ApiProperty({ description: 'ID of the user receiving the gift' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  receiver_id: number;

  @ApiProperty({ description: 'ID of the shop item to gift' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  shop_item_id: number;

  @ApiPropertyOptional({
    description: 'Quantity of items to gift',
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
    description: 'Expiration time in hours (default: 168 hours / 7 days)',
    default: 168,
    minimum: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  expiration_hours?: number;
}
