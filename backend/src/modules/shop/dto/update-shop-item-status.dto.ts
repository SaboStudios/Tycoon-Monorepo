import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateShopItemStatusDto {
  @ApiProperty({ description: 'Active status of the item' })
  @IsBoolean()
  isActive: boolean;
}
