import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { GamePlayersService } from './game-players.service';
import { GamesController } from './games.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Game, GamePlayer])],
  controllers: [GamesController],
  providers: [GamePlayersService],
  exports: [GamePlayersService],
})
export class GamesModule {}
