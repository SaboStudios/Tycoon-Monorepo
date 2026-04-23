import {
  IsOptional,
  IsEnum,
  IsInt,
  IsObject,
  IsString,
  MaxLength,
  IsDateString,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GameStatus } from '../entities/game.entity';
import type { GamePlacements } from '../entities/game.entity';
import { IsValidGameStatusTransition, IsValidGamePlacement } from '../validators/game-validators';

export class EnhancedUpdateGameDto {
  @ApiPropertyOptional({
    enum: GameStatus,
    description: 'Game status (PENDING, RUNNING, FINISHED, CANCELLED)',
  })
  @IsOptional()
  @IsEnum(GameStatus, {
    message: 'status must be one of PENDING, RUNNING, FINISHED, CANCELLED',
  })
  @IsValidGameStatusTransition({
    message: 'Invalid game status transition',
  })
  status?: GameStatus;

  @ApiPropertyOptional({
    description: 'ID of the player whose turn is next',
  })
  @IsOptional()
  @IsInt({ message: 'nextPlayerId must be an integer' })
  @Min(1, { message: 'nextPlayerId must be at least 1' })
  nextPlayerId?: number;

  @ApiPropertyOptional({
    description: 'ID of the winning player (when game is finished)',
  })
  @IsOptional()
  @IsInt({ message: 'winnerId must be an integer' })
  @Min(1, { message: 'winnerId must be at least 1' })
  winnerId?: number;

  @ApiPropertyOptional({
    description: 'Placements map: playerId -> placement rank (1-based)',
    example: { 1: 2, 2: 1, 3: 3 },
  })
  @IsOptional()
  @IsObject({ message: 'placements must be an object' })
  @IsValidGamePlacement({ message: 'Invalid game placement format' })
  placements?: GamePlacements;

  @ApiPropertyOptional({
    description: 'Smart contract game ID',
    maxLength: 78,
  })
  @IsOptional()
  @IsString({ message: 'contract_game_id must be a string' })
  @MaxLength(78, { message: 'contract_game_id cannot exceed 78 characters' })
  @IsNotEmpty({ message: 'contract_game_id cannot be empty if provided' })
  contract_game_id?: string;

  @ApiPropertyOptional({
    description: 'When the game started (ISO 8601)',
    example: '2024-01-15T10:30:00.000Z',
  })
  @IsOptional()
  @IsDateString({ 
    message: 'startTime must be a valid ISO 8601 date string' 
  })
  startTime?: string;
}
