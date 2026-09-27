import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { User } from '../users/entities/user.entity';
import { Game } from '../games/entities/game.entity';
import { GamePlayer } from '../games/entities/game-player.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Game, GamePlayer])],
  controllers: [AdminAnalyticsController],
  providers: [AdminAnalyticsService],
  exports: [AdminAnalyticsService],
})
export class AdminAnalyticsModule {}
