import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBoardStyleDto {
  @ApiProperty({
    description: 'The name of the board style',
    example: 'Cyberpunk Theme',
  })
  @IsString()
  @IsNotEmpty({ message: 'board style name is required' })
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
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'price must be a non-negative number' })
  @Max(99999999.99, { message: 'price exceeds maximum allowed value' })
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
