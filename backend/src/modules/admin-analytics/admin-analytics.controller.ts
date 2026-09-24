import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAnalyticsService } from './admin-analytics.service';
import { DashboardAnalyticsDto } from './dto/dashboard-analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AdminAnalyticsService) {}

  @Get('dashboard')
  async getDashboardAnalytics(): Promise<DashboardAnalyticsDto> {
    return this.analyticsService.getDashboardAnalytics();
  }

  @Get('users/total')
  async getTotalUsers(): Promise<{ totalUsers: number }> {
    const totalUsers = await this.analyticsService.getTotalUsers();
    return { totalUsers };
  }

  @Get('users/active')
  async getActiveUsers(): Promise<{ activeUsers: number }> {
    const activeUsers = await this.analyticsService.getActiveUsers();
    return { activeUsers };
  }

  @Get('games/total')
  async getTotalGames(): Promise<{ totalGames: number }> {
    const totalGames = await this.analyticsService.getTotalGames();
    return { totalGames };
  }

  @Get('games/players/total')
  async getTotalGamePlayers(): Promise<{ totalGamePlayers: number }> {
    const totalGamePlayers = await this.analyticsService.getTotalGamePlayers();
    return { totalGamePlayers };
  }
}
