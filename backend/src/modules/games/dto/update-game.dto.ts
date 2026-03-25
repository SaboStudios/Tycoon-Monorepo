import {
  IsOptional,
  IsEnum,
  IsInt,
  IsObject,
  IsString,
  MaxLength,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GameStatus } from '../entities/game.entity';
import type { GamePlacements } from '../entities/game.entity';

export class UpdateGameDto {
  @ApiPropertyOptional({
    enum: GameStatus,
    description: 'Game status (PENDING, RUNNING, FINISHED, CANCELLED)',
  })
  @IsOptional()
  @IsEnum(GameStatus, {
    message: 'status must be one of PENDING, RUNNING, FINISHED, CANCELLED',
  })
  status?: GameStatus;

  @ApiPropertyOptional({
    description: 'ID of the player whose turn is next',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  nextPlayerId?: number;

  @ApiPropertyOptional({
    description: 'ID of the winning player (when game is finished)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  winnerId?: number;

  @ApiPropertyOptional({
    description: 'Placements map: playerId -> placement rank (1-based)',
    example: { 1: 2, 2: 1, 3: 3 },
  })
  @IsOptional()
  @IsObject()
  placements?: GamePlacements;

  @ApiPropertyOptional({
    description: 'Smart contract game ID',
    maxLength: 78,
  })
  @IsOptional()
  @IsString()
  @MaxLength(78, { message: 'contract_game_id cannot exceed 78 characters' })
  contract_game_id?: string;

  @ApiPropertyOptional({
    description: 'When the game started (ISO 8601)',
    example: '2024-01-15T10:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startTime?: string;
}
