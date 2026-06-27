import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ShopService } from './shop.service';
import { UpdateShopPriceDto } from './dto/update-shop-price.dto';
import { UpdateShopItemStatusDto } from './dto/update-shop-item-status.dto';
import { BulkUpdateShopItemsDto } from './dto/bulk-update-shop-items.dto';
import { ShopItem } from './entities/shop-item.entity';
import { AuditLog } from '../audit-trail/audit-log.decorator';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';
import { AuditTrailInterceptor } from '../audit-trail/audit-trail.interceptor';

@ApiTags('shop-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/shop')
@UseInterceptors(AuditTrailInterceptor)
export class AdminShopController {
  constructor(private readonly shopService: ShopService) {}

  /**
   * PATCH /admin/shop/:id/price
   * Update the price of a shop item
   */
  @Patch(':id/price')
  @AuditLog(AuditAction.SHOP_ITEM_UPDATED)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update shop item price (admin only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Shop item ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Price updated successfully.',
    type: ShopItem,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Shop item not found.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required.',
  })
  async updatePrice(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePriceDto: UpdateShopPriceDto,
  ): Promise<ShopItem> {
    return this.shopService.update(id, {
      price: updatePriceDto.price,
      currency: updatePriceDto.currency,
    });
  }

  /**
   * PATCH /admin/shop/:id/status
   * Toggle the active status of a shop item
   */
  @Patch(':id/status')
  @AuditLog(AuditAction.SHOP_ITEM_UPDATED)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update shop item status (admin only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Shop item ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Status updated successfully.',
    type: ShopItem,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Shop item not found.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required.',
  })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateShopItemStatusDto,
  ): Promise<ShopItem> {
    return this.shopService.update(id, {
      active: updateStatusDto.isActive,
    });
  }

  /**
   * POST /admin/shop/:id/upload
   * Upload images for a shop item (up to 5 images)
   */
  @Post(':id/upload')
  @AuditLog(AuditAction.SHOP_ITEM_UPDATED)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: diskStorage({
        destination: './uploads/shop-items',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'), false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
    }),
  )
  @ApiOperation({ summary: 'Upload images for a shop item (admin only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Shop item ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Images uploaded successfully.',
    type: ShopItem,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Shop item not found.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file type or file too large.',
  })
  async uploadImages(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ShopItem> {
    const imageUrls = files.map((file) => `/uploads/shop-items/${file.filename}`);
    return this.shopService.update(id, {
      images: imageUrls,
    });
  }

  /**
   * POST /admin/shop/bulk/update
   * Bulk update multiple shop items (price, status, etc.)
   */
  @Post('bulk/update')
  @AuditLog(AuditAction.SHOP_ITEM_UPDATED)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk update shop items (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Items updated successfully.',
    type: [ShopItem],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid bulk update request.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required.',
  })
  async bulkUpdate(
    @Body() bulkUpdateDto: BulkUpdateShopItemsDto,
  ): Promise<ShopItem[]> {
    return this.shopService.bulkUpdate(bulkUpdateDto.items);
  }
}
