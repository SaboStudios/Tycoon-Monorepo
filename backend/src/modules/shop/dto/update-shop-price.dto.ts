import {
  IsNumber,
  IsOptional,
  Min,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateShopPriceDto {
  @ApiProperty({
    description: 'New price for the item (min 0.01)',
    example: 19.99,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price: number;

  @ApiPropertyOptional({
    description: 'ISO 4217 currency code (e.g. USD, EUR)',
    default: 'USD',
    maxLength: 3,
    pattern: '^[A-Z]{3}$',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'Currency code must be a 3-letter ISO 4217 code (e.g., USD)',
  })
  currency?: string;
}
