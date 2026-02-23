import { PartialType } from '@nestjs/swagger';
import { CreateShopItemDto } from './create-shop-item.dto';

export class UpdateShopItemDto extends PartialType(CreateShopItemDto) { }
