import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAnalyticsService } from './admin-analytics.service';
import { DashboardAnalyticsDto } from './dto/dashboard-analytics.dto';
import { PaginatedUsersQueryDto, PaginatedGamesQueryDto } from './dto/analytics-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { User } from '../users/entities/user.entity';
import { Game } from '../games/entities/game.entity';

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

  @Get('users')
  async getPaginatedUsers(
    @Query() query: PaginatedUsersQueryDto,
  ): Promise<PaginatedResponse<User>> {
    return this.analyticsService.getPaginatedUsers(query);
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

  @Get('games')
  async getPaginatedGames(
    @Query() query: PaginatedGamesQueryDto,
  ): Promise<PaginatedResponse<Game>> {
    return this.analyticsService.getPaginatedGames(query);
  }
}
