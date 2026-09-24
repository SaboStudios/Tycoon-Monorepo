import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseResponseDto {
  @ApiProperty({ description: 'Purchase ID' })
  id: number;

  @ApiProperty({ description: 'User ID' })
  user_id: number;

  @ApiProperty({ description: 'Shop item ID' })
  shop_item_id: number;

  @ApiProperty({ description: 'Quantity purchased' })
  quantity: number;

  @ApiProperty({ description: 'Original price before discount' })
  original_price: string;

  @ApiProperty({ description: 'Discount amount applied' })
  discount_amount: string;

  @ApiProperty({ description: 'Final price after discount' })
  final_price: string;

  @ApiPropertyOptional({ description: 'Coupon code used' })
  coupon_code?: string;

  @ApiProperty({ description: 'Currency' })
  currency: string;

  @ApiProperty({ description: 'Purchase status' })
  status: string;

  @ApiProperty({ description: 'Purchase timestamp' })
  created_at: Date;

  @ApiPropertyOptional({ description: 'Shop item details' })
  shop_item?: any;
}
