import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ShopItemType } from '../enums/shop-item-type.enum';
import { Transform, Type } from 'class-transformer';

export class FilterShopItemsDto {
    @ApiPropertyOptional({
        enum: ShopItemType,
        description: 'Filter by item type',
    })
    @IsOptional()
    @IsEnum(ShopItemType)
    type?: ShopItemType;

    @ApiPropertyOptional({
        description: 'Filter by rarity (e.g. common, rare, epic)',
        maxLength: 50,
    })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    rarity?: string;

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

    @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Items per page',
        default: 20,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;
}
