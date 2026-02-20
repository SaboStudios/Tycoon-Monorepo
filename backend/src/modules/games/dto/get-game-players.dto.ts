import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class GetGamePlayersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({ description: 'Filter by in_jail status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  inJail?: boolean;

  @ApiPropertyOptional({ description: 'Filter to player with active turn (turn_order = 1)' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeTurn?: boolean;

  @ApiPropertyOptional({ description: 'Minimum balance (inclusive)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  balanceMin?: number;

  @ApiPropertyOptional({ description: 'Maximum balance (inclusive)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  balanceMax?: number;
}
