import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GamePlayer } from './entities/game-player.entity';
import { GamePlayersService } from './game-players.service';
import { GamePlayersController } from './game-players.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GamePlayer])],
  controllers: [GamePlayersController],
  providers: [GamePlayersService],
  exports: [GamePlayersService],
})
export class GamesModule {}
