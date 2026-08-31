import {
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/** Maximum number of items accepted in a single bulk update request. */
export const MAX_BULK_UPDATE_ITEMS = 100;

export class BulkUpdateItemDto {
  @ApiProperty({ description: 'Shop item ID' })
  @IsNumber()
  id: number;

  @ApiPropertyOptional({ description: 'New name for the item' })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ description: 'New active status for the item' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class BulkUpdateShopItemsDto {
  @ApiProperty({
    description: `Array of items to update (1-${MAX_BULK_UPDATE_ITEMS} items). Items are processed independently; a failure on one item does not roll back the others (see ShopService.bulkUpdate partial-success policy).`,
    type: [BulkUpdateItemDto],
    minItems: 1,
    maxItems: MAX_BULK_UPDATE_ITEMS,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'items must not be empty' })
  @ArrayMaxSize(MAX_BULK_UPDATE_ITEMS, {
    message: `items must not contain more than ${MAX_BULK_UPDATE_ITEMS} elements`,
  })
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateItemDto)
  items: BulkUpdateItemDto[];
}
