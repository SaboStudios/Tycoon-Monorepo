import { IsString, IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class CreatePurchaseDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
