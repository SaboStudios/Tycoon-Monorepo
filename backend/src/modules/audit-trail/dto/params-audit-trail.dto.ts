import { IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '../entities/audit-trail.entity';

export class UserAuditTrailParamsDto {
  @ApiProperty({
    description: 'The ID of the user to fetch audit logs for',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId: number;
}

export class ActionAuditTrailParamsDto {
  @ApiProperty({
    enum: AuditAction,
    description: 'The audit action type to fetch audit logs for',
  })
  @IsEnum(AuditAction, {
    message: `action must be a valid AuditAction enum value. Allowed values: ${Object.values(AuditAction).join(', ')}`,
  })
  action: AuditAction;
}
