import { Controller, Get, UseGuards, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAnalyticsService } from './admin-analytics.service';
import { DashboardAnalyticsDto } from './dto/dashboard-analytics.dto';
import { ShopAnalyticsDto } from './dto/shop-analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('admin-analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiResponse({
  status: HttpStatus.FORBIDDEN,
  description: 'Forbidden. Admin role required.',
})
@ApiResponse({
  status: HttpStatus.UNAUTHORIZED,
  description: 'Unauthorized.',
})
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('dashboard')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Get dashboard analytics overview (admin only)' })
  @ApiResponse({ status: HttpStatus.OK, type: DashboardAnalyticsDto })
  async getDashboardAnalytics(): Promise<DashboardAnalyticsDto> {
    return this.analyticsService.getDashboardAnalytics();
  }

  @Get('shop')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Get shop sales & conversion analytics (admin only)' })
  @ApiResponse({ status: HttpStatus.OK, type: ShopAnalyticsDto })
  async getShopAnalytics(): Promise<ShopAnalyticsDto> {
    return this.analyticsService.getShopAnalytics();
  }

  @Get('users/total')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Get total registered users (admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Total user count' })
  async getTotalUsers(): Promise<{ totalUsers: number }> {
    const totalUsers = await this.analyticsService.getTotalUsers();
    return { totalUsers };
  }

  @Get('users/active')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Get active users count (admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Active user count' })
  async getActiveUsers(): Promise<{ activeUsers: number }> {
    const activeUsers = await this.analyticsService.getActiveUsers();
    return { activeUsers };
  }

  @Get('games/total')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Get total games created (admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Total game count' })
  async getTotalGames(): Promise<{ totalGames: number }> {
    const totalGames = await this.analyticsService.getTotalGames();
    return { totalGames };
  }

  @Get('games/players/total')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Get total game players count (admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Total players count' })
  async getTotalGamePlayers(): Promise<{ totalGamePlayers: number }> {
    const totalGamePlayers = await this.analyticsService.getTotalGamePlayers();
    return { totalGamePlayers };
  }
}
