import { IsNumber, IsPositive } from 'class-validator';

export class PayTaxDto {
  @IsNumber()
  @IsPositive()
  baseTax: number;
}
