import { IsOptional, IsInt, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common';

export class AdminLogQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  adminId?: number;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
