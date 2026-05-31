import {
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PurchaseThemeDto {
  @ApiProperty({
    description: 'Array of theme IDs to purchase (skins and/or board styles)',
    example: ['skin-1', 'board-1'],
  })
  @IsArray()
  @IsString({ each: true })
  themeIds: string[];

  @ApiPropertyOptional({
    description: 'Coupon code for discount',
    example: 'WELCOME20',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  couponCode?: string;

  @ApiPropertyOptional({
    description: 'Payment method (balance or card)',
    default: 'balance',
    example: 'balance',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class BulkPurchaseThemeDto {
  @ApiProperty({
    description: 'Array of purchase requests',
  })
  @Type(() => PurchaseThemeDto)
  @IsArray()
  purchases: PurchaseThemeDto[];
}
