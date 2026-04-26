import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { GameMode, GameStatus } from '../entities/game.entity';

/** Allowlist of columns that callers may sort games by. */
export enum GameSortField {
  ID = 'id',
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
  STATUS = 'status',
  MODE = 'mode',
  NUMBER_OF_PLAYERS = 'number_of_players',
  STARTED_AT = 'started_at',
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return undefined;
}

export class GetGamesDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: GameSortField,
    description: 'Field to sort games by',
    default: GameSortField.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(GameSortField)
  override sortBy?: GameSortField = GameSortField.CREATED_AT;

  @ApiPropertyOptional({ description: 'Filter by creator/user ID' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({
    enum: GameStatus,
    description: 'Filter by game status',
  })
  @IsOptional()
  @IsEnum(GameStatus)
  status?: GameStatus;

  @ApiPropertyOptional({
    enum: GameMode,
    description: 'Filter by game mode',
  })
  @IsOptional()
  @IsEnum(GameMode)
  mode?: GameMode;

  @ApiPropertyOptional({ description: 'Filter by AI games' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isAi?: boolean;

  @ApiPropertyOptional({ description: 'Filter by MiniPay games' })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isMinipay?: boolean;

  @ApiPropertyOptional({ description: 'Filter by chain name (e.g., ethereum)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  chain?: string;

  @ApiPropertyOptional({
    description: 'Only active games (RUNNING)',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Only games that are started or pending (RUNNING or PENDING)',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  startedOrPending?: boolean;
}
