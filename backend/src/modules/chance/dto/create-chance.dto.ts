import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsInt,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ChanceType } from '../enums/chance-type.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChanceDto {
  @ApiProperty({
    description: 'Instruction text for the chance card',
    example: 'Advance to the nearest railway',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString({ message: 'Instruction must be a string' })
  @IsNotEmpty({ message: 'Instruction cannot be empty' })
  @MinLength(1, { message: 'Instruction must be at least 1 character' })
  @MaxLength(1000, { message: 'Instruction must not exceed 1000 characters' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  instruction: string;

  @ApiProperty({
    description: 'Type of chance card',
    enum: ChanceType,
    example: ChanceType.REWARD,
  })
  @IsEnum(ChanceType, {
    message: `Type must be one of: ${Object.values(ChanceType).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Type is required' })
  type: ChanceType;

  @ApiPropertyOptional({
    description: 'Amount for reward/penalty type cards',
    example: 100,
    minimum: 0,
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'Amount must be a non-negative number' })
  @Max(1000000, { message: 'Amount must not exceed 1000000' })
  @ValidateIf((obj) => obj.type === ChanceType.REWARD || obj.type === ChanceType.PENALTY)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Position for move type cards',
    example: 5,
    minimum: 0,
  })
  @IsNumber({}, { message: 'Position must be a number' })
  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'Position must be a non-negative number' })
  @Max(100, { message: 'Position must not exceed 100' })
  @ValidateIf((obj) => obj.type === ChanceType.MOVE)
  position?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata for the chance card',
    example: { severity: 'high' },
  })
  @IsObject({ message: 'Extra must be an object' })
  @IsOptional()
  extra?: Record<string, unknown>;
}
