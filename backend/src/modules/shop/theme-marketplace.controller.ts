import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ThemeMarketplaceService } from './theme-marketplace.service';
import { PurchaseThemeDto } from './dto/purchase-theme.dto';
import { Purchase } from './entities/purchase.entity';
import { AuditLog } from '../audit-trail/audit-log.decorator';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';
import { AuditTrailInterceptor } from '../audit-trail/audit-trail.interceptor';
import { AdvancedCacheInterceptor } from '../../common/interceptors/advanced-cache.interceptor';
import { CacheOptions } from '../../common/decorators/cache-options.decorator';

@ApiTags('theme-marketplace')
@Controller('theme-marketplace')
@UseInterceptors(AuditTrailInterceptor)
export class ThemeMarketplaceController {
  constructor(private readonly themeMarketplaceService: ThemeMarketplaceService) {}

  /**
   * POST /theme-marketplace/purchase
   * Purchase skins and/or board styles with optional coupon
   */
  @Post('purchase')
  @AuditLog(AuditAction.PURCHASE_CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Purchase themes (skins/board styles)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Theme purchase completed successfully.',
    type: Purchase,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid purchase request or insufficient balance.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User or theme not found.',
  })
  async purchaseThemes(
    @CurrentUser() user: { id: number },
    @Body() purchaseThemeDto: PurchaseThemeDto,
  ) {
    return this.themeMarketplaceService.purchaseThemes(
      user.id,
      purchaseThemeDto,
    );
  }

  /**
   * GET /theme-marketplace/themes
   * Get available themes with optional filtering by type
   */
  @Get('themes')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AdvancedCacheInterceptor)
  @CacheOptions({ ttl: 600, keyPrefix: 'themes', useUserPrefix: false })
  @ApiOperation({ summary: 'Get available themes' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of available themes.',
  })
  async getAvailableThemes(
    @Query('type') type?: 'skin' | 'board',
  ): Promise<{ themes: any[]; count: number }> {
    const themes = await this.themeMarketplaceService.getAvailableThemes(type);
    return {
      themes,
      count: themes.length,
    };
  }

  /**
   * GET /theme-marketplace/transactions
   * Get user's theme purchase transaction history
   */
  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get theme purchase history' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User theme purchase transactions.',
  })
  async getTransactionHistory(
    @CurrentUser() user: { id: number },
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.themeMarketplaceService.getUserThemeTransactions(
      user.id,
      page,
      limit,
    );
  }
}
