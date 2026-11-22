import { IsInt, Min } from 'class-validator';

export class UnlockBalanceDto {
  @IsInt()
  @Min(1)
  amount: number;
}
