import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsBoolean,
  IsOptional,
  Min,
  IsObject,
} from 'class-validator';
import { SkinCategory } from '../enums/skin-category.enum';
import { SkinRarity } from '../enums/skin-rarity.enum';

export class CreateSkinDto {
  @ApiProperty({ description: 'The name of the skin', example: 'Gold Top Hat' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'The category of the skin',
    enum: SkinCategory,
    example: SkinCategory.TOKEN,
  })
  @IsEnum(SkinCategory)
  category: SkinCategory;

  @ApiProperty({
    description: 'The rarity level of the skin',
    enum: SkinRarity,
    example: SkinRarity.EPIC,
  })
  @IsEnum(SkinRarity)
  @IsOptional()
  rarity?: SkinRarity;

  @ApiProperty({
    description: 'Whether the skin is premium (requires purchase)',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_premium?: boolean;

  @ApiProperty({
    description: 'Price of the skin if premium',
    example: 4.99,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({
    description: 'URL to the preview image',
    example: 'https://example.com/images/gold-hat.png',
    required: false,
  })
  @IsString()
  @IsOptional()
  preview_image?: string;

  @ApiProperty({
    description:
      'Additional metadata for the skin (e.g., specific stats or effects)',
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
