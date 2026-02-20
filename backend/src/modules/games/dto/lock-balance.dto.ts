import { IsNumber, IsPositive } from 'class-validator';

export class LockBalanceDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}
