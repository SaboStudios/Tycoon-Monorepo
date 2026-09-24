import { IsInt, Min, Max } from 'class-validator';

export class RollDiceDto {
  @IsInt()
  @Min(1)
  @Max(6)
  dice1: number;

  @IsInt()
  @Min(1)
  @Max(6)
  dice2: number;
}
