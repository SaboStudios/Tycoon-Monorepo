import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ChanceType } from '../enums/chance-type.enum';

export class CreateChanceDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  instruction: string;

  @IsEnum(ChanceType)
  @IsNotEmpty()
  type: ChanceType;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Amount must be a non-negative number' })
  amount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Position must be a non-negative number' })
  position?: number;

  @IsObject()
  @IsOptional()
  extra?: Record<string, any>;
}
