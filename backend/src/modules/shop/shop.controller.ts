import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ShopService, PaginatedShopItems } from './shop.service';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { FilterShopItemsDto } from './dto/filter-shop-items.dto';
import { PurchaseAndGiftDto } from './dto/purchase-and-gift.dto';
import { ShopItem } from './entities/shop-item.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('shop')
@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  /**
   * POST /shop/items
   * Create a new shop item (admin use)
   */
  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new shop item' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Shop item created successfully.',
    type: ShopItem,
  })
  create(@Body() createShopItemDto: CreateShopItemDto): Promise<ShopItem> {
    return this.shopService.create(createShopItemDto);
  }

  /**
   * GET /shop/items
   * List all items with optional filters (type, rarity, active) and pagination
   */
  @Get('items')
  @ApiOperation({ summary: 'List shop items with optional filters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated list of shop items.',
  })
  findAll(@Query() filterDto: FilterShopItemsDto): Promise<PaginatedShopItems> {
    return this.shopService.findAll(filterDto);
  }

  /**
   * GET /shop/items/:id
   */
  @Get('items/:id')
  @ApiOperation({ summary: 'Get a shop item by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Shop item found.',
    type: ShopItem,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Shop item not found.',
  })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ShopItem> {
    return this.shopService.findOne(id);
  }

  /**
   * PATCH /shop/items/:id
   */
  @Patch('items/:id')
  @ApiOperation({ summary: 'Update a shop item' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Shop item updated.',
    type: ShopItem,
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateShopItemDto: UpdateShopItemDto,
  ): Promise<ShopItem> {
    return this.shopService.update(id, updateShopItemDto);
  }

  /**
   * DELETE /shop/items/:id
   * Soft-deletes by setting active = false
   */
  @Delete('items/:id')
  @ApiOperation({ summary: 'Deactivate (soft-delete) a shop item' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Shop item deactivated.',
    type: ShopItem,
  })
  remove(@Param('id', ParseIntPipe) id: number): Promise<ShopItem> {
    return this.shopService.remove(id);
  }

  /**
   * POST /shop/gift
   * Purchase an item and send it as a gift
   */
  @Post('gift')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Purchase and gift an item to another user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Item purchased and gift sent successfully.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request or business rule violation.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User or shop item not found.',
  })
  async purchaseAndGift(
    @CurrentUser() user: { id: number },
    @Body() purchaseAndGiftDto: PurchaseAndGiftDto,
  ) {
    return this.shopService.purchaseAndGift(user.id, purchaseAndGiftDto);
  }

  /**
   * GET /shop/purchases
   * Get purchase history for the authenticated user
   */
  @Get('purchases')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get purchase history' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Purchase history retrieved successfully.',
  })
  async getPurchaseHistory(
    @CurrentUser() user: { id: number },
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    return this.shopService.getPurchaseHistory(user.id, page, limit);
  }
}
