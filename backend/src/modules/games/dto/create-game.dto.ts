import { IsOptional, IsString, IsInt, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateGameSettingsDto } from './create-game-settings.dto';

export class CreateGameDto {
  @ApiProperty({ example: 'PUBLIC' })
  @IsString()
  mode: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(2)
  @Max(8)
  numberOfPlayers: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateGameSettingsDto)
  settings?: CreateGameSettingsDto;
}
