import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Game } from '../games/entities/game.entity';
import { GamePlayer } from '../games/entities/game-player.entity';
import { DashboardAnalyticsDto } from './dto/dashboard-analytics.dto';
import {
  PaginatedUsersQueryDto,
  PaginatedGamesQueryDto,
} from './dto/analytics-query.dto';
import { PaginationService } from '../../common/services/pagination.service';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';

@Injectable()
export class AdminAnalyticsService {
  private readonly logger = new Logger(AdminAnalyticsService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Game)
    private gameRepo: Repository<Game>,
    @InjectRepository(GamePlayer)
    private gamePlayerRepo: Repository<GamePlayer>,
    private readonly paginationService: PaginationService,
  ) {}

  async getDashboardAnalytics(): Promise<DashboardAnalyticsDto> {
    this.logger.log('Fetching dashboard analytics');
    const [totalUsers, activeUsers, totalGames, totalGamePlayers] =
      await Promise.all([
        this.getTotalUsers(),
        this.getActiveUsers(),
        this.getTotalGames(),
        this.getTotalGamePlayers(),
      ]);
    this.logger.log(
      `Dashboard analytics: users=${totalUsers}, active=${activeUsers}, games=${totalGames}, players=${totalGamePlayers}`,
    );
    return { totalUsers, activeUsers, totalGames, totalGamePlayers };
  }

  async getTotalUsers(): Promise<number> {
    const count = await this.userRepo.count();
    this.logger.debug(`getTotalUsers: ${count}`);
    return count;
  }

  async getActiveUsers(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const count = await this.userRepo.count({
      where: { updated_at: MoreThan(thirtyDaysAgo) },
    });
    this.logger.debug(`getActiveUsers (last 30d): ${count}`);
    return count;
  }

  async getTotalGames(): Promise<number> {
    const count = await this.gameRepo.count();
    this.logger.debug(`getTotalGames: ${count}`);
    return count;
  }

  async getTotalGamePlayers(): Promise<number> {
    const count = await this.gamePlayerRepo.count();
    this.logger.debug(`getTotalGamePlayers: ${count}`);
    return count;
  }

  async getPaginatedUsers(
    query: PaginatedUsersQueryDto,
  ): Promise<PaginatedResponse<User>> {
    this.logger.log(
      `getPaginatedUsers: page=${query.page}, limit=${query.limit}, sortBy=${query.sortBy}`,
    );
    const qb = this.userRepo.createQueryBuilder('user');
    return this.paginationService.paginate(
      qb,
      query,
      ['email', 'firstName', 'lastName', 'username'],
      ['id', 'email', 'created_at', 'games_played', 'game_won'],
    );
  }

  async getPaginatedGames(
    query: PaginatedGamesQueryDto,
  ): Promise<PaginatedResponse<Game>> {
    this.logger.log(
      `getPaginatedGames: page=${query.page}, limit=${query.limit}, sortBy=${query.sortBy}`,
    );
    const qb = this.gameRepo.createQueryBuilder('game');
    return this.paginationService.paginate(
      qb,
      query,
      ['code', 'status', 'mode'],
      ['id', 'status', 'created_at', 'mode'],
    );
  }
}
