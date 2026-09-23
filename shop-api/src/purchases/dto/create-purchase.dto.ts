import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class CreatePurchaseDto {
  @ApiProperty({ description: 'ID of the user making the purchase.' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'ID of the item being purchased.' })
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ example: 49.99, description: 'Purchase amount in currency units.' })
  @IsNumber()
  @IsPositive()
  amount: number;
}
