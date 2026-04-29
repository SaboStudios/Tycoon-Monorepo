import {
  IsBoolean,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShopItemType, ShopItemRarity } from '../enums/shop-item-type.enum';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterShopItemsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ShopItemType,
    description: 'Filter by item type',
  })
  @IsOptional()
  @IsEnum(ShopItemType)
  type?: ShopItemType;

  @ApiPropertyOptional({
    enum: ShopItemRarity,
    description: 'Filter by rarity tier',
  })
  @IsOptional()
  @IsEnum(ShopItemRarity)
  rarity?: ShopItemRarity;

  @ApiPropertyOptional({
    description: 'Filter by active status',
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
