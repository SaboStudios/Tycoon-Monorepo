import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShopItemType, ShopItemRarity } from '../enums/shop-item-type.enum';
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

  @ApiProperty({ description: 'Price of the item (min 0.01)', example: 9.99 })
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
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO 4217 code (e.g. USD)' })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Arbitrary extra data (textures, colors, config)',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: ShopItemRarity,
    description: 'Rarity tier',
    default: ShopItemRarity.COMMON,
  })
  @IsOptional()
  @IsEnum(ShopItemRarity)
  rarity?: ShopItemRarity;

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
