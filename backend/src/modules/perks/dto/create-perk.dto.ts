import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  Min,
  MaxLength,
  IsInt,
  Min as MinNumber,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PerkType } from '../enums/perk-type.enum';
import { PerkCategory } from '../enums/perk-category.enum';
import { BlockchainPerkId } from '../enums/blockchain-perk-id.enum';

export class CreatePerkDto {
  @ApiProperty({ description: 'Display name of the perk', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Perk description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PerkType, description: 'Perk duration type' })
  @IsEnum(PerkType)
  type: PerkType;

  @ApiProperty({ enum: PerkCategory, description: 'Perk category' })
  @IsEnum(PerkCategory)
  category: PerkCategory;

  @ApiPropertyOptional({
    description: 'Rarity tier',
    default: 'common',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  rarity?: string;

  @ApiProperty({ description: 'Price of the perk', example: 9.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: 'Arbitrary extra data' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'URL to the perk icon',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  icon_url?: string;

  @ApiPropertyOptional({
    description: 'Blockchain perk ID (1-11) aligning with contract enum',
    enum: BlockchainPerkId,
  })
  @IsOptional()
  @IsEnum(BlockchainPerkId)
  @Type(() => Number)
  @IsInt()
  @MinNumber(1)
  @Max(11)
  blockchain_perk_id?: BlockchainPerkId;
}
