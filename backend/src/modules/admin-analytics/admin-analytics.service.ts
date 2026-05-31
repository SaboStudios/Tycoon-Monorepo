import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Game } from '../games/entities/game.entity';
import { GamePlayer } from '../games/entities/game-player.entity';
import { DashboardAnalyticsDto } from './dto/dashboard-analytics.dto';
import { PaginatedUsersQueryDto, PaginatedGamesQueryDto } from './dto/analytics-query.dto';
import { PaginationService } from '../../common/services/pagination.service';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';

@Injectable()
export class AdminAnalyticsService {
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
    const [totalUsers, activeUsers, totalGames, totalGamePlayers] =
      await Promise.all([
        this.getTotalUsers(),
        this.getActiveUsers(),
        this.getTotalGames(),
        this.getTotalGamePlayers(),
      ]);

    return {
      totalUsers,
      activeUsers,
      totalGames,
      totalGamePlayers,
    };
  }

  async getTotalUsers(): Promise<number> {
    return this.userRepo.count();
  }

  async getActiveUsers(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.userRepo.count({
      where: {
        updated_at: MoreThan(thirtyDaysAgo),
      },
    });
  }

  async getTotalGames(): Promise<number> {
    return this.gameRepo.count();
  }

  async getTotalGamePlayers(): Promise<number> {
    return this.gamePlayerRepo.count();
  }

  async getPaginatedUsers(query: PaginatedUsersQueryDto): Promise<PaginatedResponse<User>> {
    const qb = this.userRepo.createQueryBuilder('user');

    const allowedSortFields = ['id', 'email', 'created_at', 'games_played', 'game_won'];
    const searchableFields = ['email', 'firstName', 'lastName', 'username'];

    return this.paginationService.paginate(qb, query, searchableFields, allowedSortFields);
  }

  async getPaginatedGames(query: PaginatedGamesQueryDto): Promise<PaginatedResponse<Game>> {
    const qb = this.gameRepo.createQueryBuilder('game');

    const allowedSortFields = ['id', 'status', 'created_at', 'mode'];
    const searchableFields = ['code', 'status', 'mode'];

    return this.paginationService.paginate(qb, query, searchableFields, allowedSortFields);
  }
}
