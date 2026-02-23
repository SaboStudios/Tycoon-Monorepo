import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { GamePlayerSymbol } from '../enums/game-player-symbol.enum';

export class UpdateGamePlayerDto {
  /** Allowed only before game starts */
  @IsOptional()
  @IsEnum(GamePlayerSymbol)
  symbol?: GamePlayerSymbol;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  trade_locked_balance?: number;

  /** Admin/system only */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  in_jail?: boolean;
}
