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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  instruction: string;

  @IsEnum(ChanceType)
  @IsNotEmpty()
  type: ChanceType;

  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 },
    { message: 'Amount must be a finite integer' },
  )
  @IsOptional()
  @Min(0, { message: 'Amount must be a non-negative number' })
  amount?: number;

  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 0 },
    { message: 'Position must be a finite integer' },
  )
  @IsOptional()
  @Min(0, { message: 'Position must be a non-negative number' })
  position?: number;

  @IsObject()
  @IsOptional()
  extra?: Record<string, unknown>;
}
