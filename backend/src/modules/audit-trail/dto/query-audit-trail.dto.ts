import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction } from '../entities/audit-trail.entity';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Number of records to return (max 100)',
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Number of records to skip',
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class QueryAuditTrailDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter audit logs by User ID',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({
    enum: AuditAction,
    description: 'Filter audit logs by Audit Action',
  })
  @IsOptional()
  @IsEnum(AuditAction, {
    message: `action must be a valid AuditAction enum value. Allowed values: ${Object.values(AuditAction).join(', ')}`,
  })
  action?: AuditAction;
}
