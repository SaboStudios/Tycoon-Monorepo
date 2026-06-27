import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Game } from '../games/entities/game.entity';
import { GamePlayer } from '../games/entities/game-player.entity';
import { Transaction } from './entities/transaction.entity';
import { PlayerActivity } from './entities/player-activity.entity';
import { DashboardAnalyticsDto } from './dto/dashboard-analytics.dto';
import { ShopAnalyticsDto, PopularItemDto } from './dto/shop-analytics.dto';
import { AdminAnalyticsObservabilityService } from './admin-analytics-observability.service';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Game)
    private gameRepo: Repository<Game>,
    @InjectRepository(GamePlayer)
    private gamePlayerRepo: Repository<GamePlayer>,
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @InjectRepository(PlayerActivity)
    private activityRepo: Repository<PlayerActivity>,
    private readonly observability: AdminAnalyticsObservabilityService,
  ) {}

  async getDashboardAnalytics(): Promise<DashboardAnalyticsDto> {
    const startedAt = Date.now();

    try {
      const [totalUsers, activeUsers, totalGames, totalGamePlayers] =
        await Promise.all([
          this.countTotalUsers(),
          this.countActiveUsers(),
          this.countTotalGames(),
          this.countTotalGamePlayers(),
        ]);

      const result = {
        totalUsers,
        activeUsers,
        totalGames,
        totalGamePlayers,
      };

      this.observability.recordRequest(
        'dashboard',
        true,
        Date.now() - startedAt,
      );

      return result;
    } catch (error) {
      this.observability.recordRequest(
        'dashboard',
        false,
        Date.now() - startedAt,
      );
      throw error;
    }
  }

  async getShopAnalytics(): Promise<ShopAnalyticsDto> {
    return this.trackRequest('shop', async () => {
      const [totalRevenue, popularItems, conversionRate, retentionMetrics] =
        await Promise.all([
          this.getTotalRevenue(),
          this.getPopularItems(),
          this.getConversionRate(),
          this.getRetentionMetrics(),
        ]);

      return {
        totalRevenue,
        popularItems,
        conversionRate,
        retentionMetrics,
      };
    });
  }

  async getTotalUsers(): Promise<number> {
    return this.trackRequest('users_total', () => this.countTotalUsers());
  }

  async getActiveUsers(): Promise<number> {
    return this.trackRequest('users_active', () => this.countActiveUsers());
  }

  async getTotalGames(): Promise<number> {
    return this.trackRequest('games_total', () => this.countTotalGames());
  }

  async getTotalGamePlayers(): Promise<number> {
    return this.trackRequest('games_players_total', () =>
      this.countTotalGamePlayers(),
    );
  }

  private async trackRequest<T>(
    endpoint: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();

    try {
      const result = await callback();
      this.observability.recordRequest(
        endpoint,
        true,
        Date.now() - startedAt,
      );
      return result;
    } catch (error) {
      this.observability.recordRequest(
        endpoint,
        false,
        Date.now() - startedAt,
      );
      throw error;
    }
  }

  private async getTotalRevenue(): Promise<number> {
    const result = await this.transactionRepo
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  private async getPopularItems(): Promise<PopularItemDto[]> {
    const rawItems = await this.transactionRepo
      .createQueryBuilder('transaction')
      .select('transaction.itemId', 'itemId')
      .addSelect('transaction.itemName', 'itemName')
      .addSelect('COUNT(*)', 'purchaseCount')
      .addSelect('SUM(transaction.amount)', 'totalRevenue')
      .groupBy('transaction.itemId')
      .addGroupBy('transaction.itemName')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany();

    return rawItems.map((item: any) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      purchaseCount: parseInt(item.purchaseCount, 10),
      totalRevenue: parseFloat(item.totalRevenue),
    }));
  }

  private async getConversionRate(): Promise<number> {
    const totalPlayersRaw = await this.activityRepo
      .createQueryBuilder('activity')
      .select('COUNT(DISTINCT activity.playerId)', 'count')
      .getRawOne();

    const purchasedPlayersRaw = await this.transactionRepo
      .createQueryBuilder('transaction')
      .select('COUNT(DISTINCT transaction.playerId)', 'count')
      .getRawOne();

    const total = parseInt(totalPlayersRaw?.count || '0', 10);
    const purchased = parseInt(purchasedPlayersRaw?.count || '0', 10);

    return total > 0 ? (purchased / total) * 100 : 0;
  }

  private async getRetentionMetrics(): Promise<{
    day1: number;
    day7: number;
    day30: number;
  }> {
    const now = new Date();

    const [day1, day7, day30] = await Promise.all([
      this.calculateRetention(1, now),
      this.calculateRetention(7, now),
      this.calculateRetention(30, now),
    ]);

    return { day1, day7, day30 };
  }

  private async calculateRetention(
    days: number,
    now: Date,
  ): Promise<number> {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days - 1);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - days);

    const initialPlayers = await this.activityRepo
      .createQueryBuilder('activity')
      .select('DISTINCT activity.playerId', 'playerId')
      .where('activity.createdAt >= :start AND activity.createdAt < :end', {
        start: startDate,
        end: endDate,
      })
      .getRawMany();

    if (!initialPlayers?.length) {
      return 0;
    }

    const returnedPlayers = await this.activityRepo
      .createQueryBuilder('activity')
      .select('COUNT(DISTINCT activity.playerId)', 'count')
      .where('activity.playerId IN (:...playerIds)', {
        playerIds: initialPlayers.map((player: any) => player.playerId),
      })
      .andWhere('activity.createdAt >= :end', { end: endDate })
      .getRawOne();

    const returned = parseInt(returnedPlayers?.count || '0', 10);
    return (returned / initialPlayers.length) * 100;
  }

  private async countTotalUsers(): Promise<number> {
    return this.userRepo.count();
  }

  private async countActiveUsers(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.userRepo.count({
      where: {
        updated_at: MoreThan(thirtyDaysAgo),
      },
    });
  }

  private async countTotalGames(): Promise<number> {
    return this.gameRepo.count();
  }

  private async countTotalGamePlayers(): Promise<number> {
    return this.gamePlayerRepo.count();
  }
}
