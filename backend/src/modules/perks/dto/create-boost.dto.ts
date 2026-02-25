import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateBoostDto {
  @ApiProperty({ description: 'Boost type identifier', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  boost_type: string;

  @ApiProperty({ description: 'Effect value (e.g. multiplier or flat amount)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  effect_value: number;

  @ApiPropertyOptional({ description: 'Duration in seconds (null = permanent)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  duration_seconds?: number;

  @ApiPropertyOptional({ description: 'Whether boost stacks with others', default: false })
  @IsOptional()
  @IsBoolean()
  stackable?: boolean;
}
