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
} from '@nestjs/common';
import {
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { ShopService, PaginatedShopItems } from './shop.service';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { FilterShopItemsDto } from './dto/filter-shop-items.dto';
import { ShopItem } from './entities/shop-item.entity';

@ApiTags('shop')
@Controller('shop/items')
export class ShopController {
    constructor(private readonly shopService: ShopService) { }

    /**
     * POST /shop/items
     * Create a new shop item (admin use)
     */
    @Post()
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
    @Get()
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
    @Get(':id')
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
    @Patch(':id')
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
    @Delete(':id')
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
}
