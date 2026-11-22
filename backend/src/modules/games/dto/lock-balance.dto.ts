import { IsInt, Min } from 'class-validator';

export class LockBalanceDto {
  @IsInt()
  @Min(1)
  amount: number;
}
