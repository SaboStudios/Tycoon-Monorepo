import { IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGameSettingsDto {
  @ApiPropertyOptional({ description: 'Whether auction is enabled' })
  @IsOptional()
  @IsBoolean()
  auction?: boolean;

  @ApiPropertyOptional({ description: 'Whether rent in prison is enabled' })
  @IsOptional()
  @IsBoolean()
  rentInPrison?: boolean;

  @ApiPropertyOptional({ description: 'Whether mortgage is enabled' })
  @IsOptional()
  @IsBoolean()
  mortgage?: boolean;

  @ApiPropertyOptional({ description: 'Whether even build is enabled' })
  @IsOptional()
  @IsBoolean()
  evenBuild?: boolean;

  @ApiPropertyOptional({ description: 'Whether to randomize play order' })
  @IsOptional()
  @IsBoolean()
  randomizePlayOrder?: boolean;

  @ApiPropertyOptional({ description: 'Starting cash per player', minimum: 100 })
  @IsOptional()
  @IsInt()
  @Min(100)
  startingCash?: number;
}
