import {
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { GiftStatus } from '../enums/gift-status.enum';

export class FilterGiftsDto {
  @ApiPropertyOptional({
    enum: GiftStatus,
    description: 'Filter by gift status',
  })
  @IsOptional()
  @IsEnum(GiftStatus)
  status?: GiftStatus;

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
