import { IsNumber, IsPositive } from 'class-validator';

export class PayRentDto {
  @IsNumber()
  @IsPositive()
  payeeId: number;

  @IsNumber()
  @IsPositive()
  baseRent: number;
}
