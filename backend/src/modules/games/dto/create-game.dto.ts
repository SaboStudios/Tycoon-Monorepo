import {
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsBoolean,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateGameSettingsDto } from './create-game-settings.dto';
import { GameMode } from '../entities/game.entity';

export class CreateGameDto {
  @ApiProperty({
    example: 'PUBLIC',
    enum: GameMode,
    description: 'Game mode (PUBLIC or PRIVATE)',
  })
  @IsEnum(GameMode, { message: 'mode must be either PUBLIC or PRIVATE' })
  mode: GameMode;

  @ApiProperty({
    example: 4,
    description: 'Number of players (2-8)',
  })
  @IsInt({ message: 'numberOfPlayers must be an integer' })
  @Min(2, { message: 'numberOfPlayers must be at least 2' })
  @Max(8, { message: 'numberOfPlayers cannot exceed 8' })
  numberOfPlayers: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateGameSettingsDto)
  settings?: CreateGameSettingsDto;

  @ApiPropertyOptional({
    default: false,
    description: 'Whether the game includes AI players',
  })
  @IsOptional()
  @IsBoolean({ message: 'is_ai must be a boolean' })
  is_ai?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Whether the game uses MiniPay',
  })
  @IsOptional()
  @IsBoolean({ message: 'is_minipay must be a boolean' })
  is_minipay?: boolean;

  @ApiPropertyOptional({
    example: 'ethereum',
    description: 'Blockchain chain for the game (optional)',
  })
  @IsOptional()
  @IsString({ message: 'chain must be a string' })
  @MaxLength(255, { message: 'chain cannot exceed 255 characters' })
  chain?: string;

  @ApiPropertyOptional({
    example: '0x123abc...',
    description: 'Smart contract game ID (optional)',
  })
  @IsOptional()
  @IsString({ message: 'contract_game_id must be a string' })
  @MaxLength(78, { message: 'contract_game_id cannot exceed 78 characters' })
  contract_game_id?: string;
}
