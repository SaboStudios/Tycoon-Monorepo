import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { GameSettings } from './entities/game-settings.entity';
import { GamePlayer } from './entities/game-player.entity';
import { GamePlayersService } from './game-players.service';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Game, GameSettings, GamePlayer])],
  controllers: [GamesController],
  providers: [GamePlayersService, GamesService],
  exports: [GamePlayersService],
})
export class GamesModule {}
