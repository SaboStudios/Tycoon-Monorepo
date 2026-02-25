import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PerkType } from '../enums/perk-type.enum';
import { PerkCategory } from '../enums/perk-category.enum';

export class FilterPerksDto {
  @ApiPropertyOptional({ enum: PerkType })
  @IsOptional()
  @IsEnum(PerkType)
  type?: PerkType;

  @ApiPropertyOptional({ enum: PerkCategory })
  @IsOptional()
  @IsEnum(PerkCategory)
  category?: PerkCategory;

  @ApiPropertyOptional({ description: 'Filter by active status (public defaults to true)' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_active?: boolean;
}
