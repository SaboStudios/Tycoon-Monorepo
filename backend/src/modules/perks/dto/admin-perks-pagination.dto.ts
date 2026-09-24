import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common';
import { PerkType } from '../enums/perk-type.enum';
import { PerkCategory } from '../enums/perk-category.enum';

export class AdminPerksPaginationDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PerkType })
  @IsOptional()
  @IsEnum(PerkType)
  type?: PerkType;

  @ApiPropertyOptional({ enum: PerkCategory })
  @IsOptional()
  @IsEnum(PerkCategory)
  category?: PerkCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_active?: boolean;
}
