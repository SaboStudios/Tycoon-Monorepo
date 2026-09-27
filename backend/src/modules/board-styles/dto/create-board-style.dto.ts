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
  @IsNumber()
  @Min(0)
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
