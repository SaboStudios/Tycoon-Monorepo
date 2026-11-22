import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  IsObject,
} from 'class-validator';

export class CreateBoardStyleDto {
  @ApiProperty({
    description: 'The name of the board style',
    example: 'Cyberpunk Theme',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Description of the board style',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Whether the board style is premium',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_premium?: boolean;

  @ApiProperty({
    description: 'Price of the board style if premium',
    example: 9.99,
    required: false,
  })
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: 'Price must be a finite number with at most 2 decimal places' },
  )
  @Min(0, { message: 'Price must be a non-negative number' })
  @IsOptional()
  price?: number;

  @ApiProperty({
    description: 'URL to the preview image',
    required: false,
  })
  @IsString()
  @IsOptional()
  preview_image?: string;

  @ApiProperty({
    description: 'JSON configuration for colors, tiles, etc.',
    required: false,
  })
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}
