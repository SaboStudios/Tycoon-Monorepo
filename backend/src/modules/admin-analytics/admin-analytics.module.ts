import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAnalyticsObservabilityService } from './admin-analytics-observability.service';
import { User } from '../users/entities/user.entity';
import { Game } from '../games/entities/game.entity';
import { GamePlayer } from '../games/entities/game-player.entity';
import { Transaction } from './entities/transaction.entity';
import { PlayerActivity } from './entities/player-activity.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Game,
      GamePlayer,
      Transaction,
      PlayerActivity,
    ]),
  ],
  controllers: [AdminAnalyticsController],
  providers: [AdminAnalyticsService, AdminAnalyticsObservabilityService],
  exports: [AdminAnalyticsService],
})
export class AdminAnalyticsModule {}
