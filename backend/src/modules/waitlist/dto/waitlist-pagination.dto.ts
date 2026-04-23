import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common';

export class WaitlistPaginationDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by wallet address' })
  @IsOptional()
  @IsString()
  wallet?: string;

  @ApiPropertyOptional({ description: 'Filter by email address' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Filter by telegram username' })
  @IsOptional()
  @IsString()
  telegram?: string;
}
