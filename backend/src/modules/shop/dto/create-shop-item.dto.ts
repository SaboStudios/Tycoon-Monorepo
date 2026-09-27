import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShopItemType } from '../enums/shop-item-type.enum';
import { Transform, Type } from 'class-transformer';

export class CreateShopItemDto {
  @ApiProperty({ description: 'Display name of the item', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Item description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: ShopItemType,
    description: 'Category of the shop item',
  })
  @IsEnum(ShopItemType)
  type: ShopItemType;

  @ApiProperty({ description: 'Price of the item', example: 9.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    default: 'USD',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Arbitrary extra data (textures, colors, config)',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Rarity tier (common, rare, epic, legendary)',
    default: 'common',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  rarity?: string;

  @ApiPropertyOptional({
    description: 'Whether the item is available in the shop',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;
}
