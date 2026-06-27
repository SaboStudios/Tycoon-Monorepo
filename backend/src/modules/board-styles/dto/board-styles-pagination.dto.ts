import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common';

export class BoardStylesPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by premium status',
    type: Boolean,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_premium?: boolean;
}
