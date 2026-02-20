import { IsNumber, IsPositive } from 'class-validator';

export class UnlockBalanceDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}
