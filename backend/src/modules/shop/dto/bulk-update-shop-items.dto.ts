import {
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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
    description: 'Array of items to update',
    type: [BulkUpdateItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateItemDto)
  items: BulkUpdateItemDto[];
}
