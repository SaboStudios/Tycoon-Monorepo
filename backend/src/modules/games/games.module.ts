import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { GameSettings } from './entities/game-settings.entity';
import { GamePlayer } from './entities/game-player.entity';
import { GamePlayersService } from './game-players.service';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { PerksBoostsModule } from '../perks-boosts/perks-boosts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, GameSettings, GamePlayer]),
    forwardRef(() => PerksBoostsModule),
  ],
  controllers: [GamesController],
  providers: [GamePlayersService, GamesService],
  exports: [GamePlayersService],
})
export class GamesModule {}
