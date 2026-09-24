import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Game } from '../games/entities/game.entity';
import { GamePlayer } from '../games/entities/game-player.entity';
import { DashboardAnalyticsDto } from './dto/dashboard-analytics.dto';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Game)
    private gameRepo: Repository<Game>,
    @InjectRepository(GamePlayer)
    private gamePlayerRepo: Repository<GamePlayer>,
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
}
