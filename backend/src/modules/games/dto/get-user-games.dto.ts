import { IsOptional, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class GetUserGamesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by game ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gameId?: number;

  @ApiPropertyOptional({ description: 'Filter by in_jail status of the player in that game' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  inJail?: boolean;
}
