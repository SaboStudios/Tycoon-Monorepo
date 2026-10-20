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
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateGameSettingsDto } from './create-game-settings.dto';
import { GameMode } from '../entities/game.entity';
import { 
  IsValidPlayerCount, 
  IsValidBlockchainAddress, 
  IsValidContractGameId 
} from '../validators/game-validators';

export class EnhancedCreateGameDto {
  @ApiProperty({
    example: 'PUBLIC',
    enum: GameMode,
    description: 'Game mode (PUBLIC or PRIVATE)',
  })
  @IsEnum(GameMode, { 
    message: 'mode must be either PUBLIC or PRIVATE' 
  })
  @IsNotEmpty({ message: 'mode is required' })
  mode: GameMode;

  @ApiProperty({
    example: 4,
    description: 'Number of players (2-8)',
  })
  @IsInt({ message: 'numberOfPlayers must be an integer' })
  @IsValidPlayerCount({ message: 'Number of players must be between 2 and 8' })
  @IsNotEmpty({ message: 'numberOfPlayers is required' })
  numberOfPlayers: number;

  @ApiPropertyOptional({
    description: 'Game settings configuration',
  })
  @IsOptional()
  @ValidateNested({ message: 'Invalid game settings format' })
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
  @MaxLength(50, { message: 'chain cannot exceed 50 characters' })
  @IsNotEmpty({ message: 'chain cannot be empty if provided' })
  chain?: string;

  @ApiPropertyOptional({
    example: '0x123abc...',
    description: 'Smart contract game ID (optional)',
  })
  @IsOptional()
  @IsValidContractGameId({ message: 'Invalid contract game ID format' })
  contract_game_id?: string;
}
