import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Max,
  MaxLength,
} from 'class-validator';

export class CreatePurchaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  itemId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(99999999.99)
  amount: number;
}
