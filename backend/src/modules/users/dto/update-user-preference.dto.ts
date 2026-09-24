import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsObject,
  IsBoolean,
  IsString,
} from 'class-validator';

export class UpdateUserPreferenceDto {
  @ApiProperty({
    description: 'The ID of the preferred board style for this user.',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  board_style_id?: number;

  @ApiProperty({
    description: 'A JSON object containing various user settings.',
    example: {
      soundEnabled: true,
      animationSpeed: 'fast',
      accessibility: { highContrast: false },
      defaultSkins: { token: 2, dice: 5 },
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
