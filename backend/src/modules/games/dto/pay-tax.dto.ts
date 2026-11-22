import { IsInt, Min } from 'class-validator';

export class PayTaxDto {
  @IsInt()
  @Min(1)
  baseTax: number;
}
