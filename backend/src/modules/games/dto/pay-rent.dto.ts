import { IsInt, IsNumber, IsPositive, Min } from 'class-validator';

export class PayRentDto {
  @IsNumber()
  @IsPositive()
  payeeId: number;

  @IsInt()
  @Min(1)
  baseRent: number;
}
