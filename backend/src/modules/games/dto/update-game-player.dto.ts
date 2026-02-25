import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
  IsInt,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GamePlayerSymbol } from '../enums/game-player-symbol.enum';

export class UpdateGamePlayerDto {
  @ApiPropertyOptional({
    description: 'Player token/symbol (allowed only before game starts)',
    enum: GamePlayerSymbol,
  })
  @IsOptional()
  @IsEnum(GamePlayerSymbol, {
    message: `symbol must be one of: ${Object.values(GamePlayerSymbol).join(', ')}`,
  })
  symbol?: GamePlayerSymbol;

  @ApiPropertyOptional({ description: 'Player address', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'address cannot exceed 120 characters' })
  address?: string;

  @ApiPropertyOptional({
    description: 'Balance (must be positive)',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'balance must be positive' })
  @Transform(({ value }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  balance?: number;

  @ApiPropertyOptional({
    description: 'Board position',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'position must be >= 0' })
  @Type(() => Number)
  position?: number;

  @ApiPropertyOptional({
    description: 'Turn order (1-based position in play order)',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'turn_order must be >= 0' })
  @Type(() => Number)
  turn_order?: number;

  @ApiPropertyOptional({
    description: 'Trade locked balance (must be >= 0)',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'trade_locked_balance must be >= 0' })
  @Transform(({ value }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  trade_locked_balance?: number;

  /** Admin/system only */
  @ApiPropertyOptional({
    description: 'Whether player is in jail (admin only)',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  in_jail?: boolean;
}
