import { IsNumber, IsPositive } from 'class-validator';

export class BuyPropertyDto {
  @IsNumber()
  @IsPositive()
  propertyCost: number;

  @IsNumber()
  @IsPositive()
  propertyId: number;
}
