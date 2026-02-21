import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Game } from './entities/game.entity';
import { GameSettings } from './entities/game-settings.entity';
import { CreateGameDto } from './dto/create-game.dto';

const DEFAULT_SETTINGS = {
  auction: true,
  rentInPrison: false,
  mortgage: true,
  evenBuild: true,
  randomizePlayOrder: true,
  startingCash: 1500,
};

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    @InjectRepository(GameSettings)
    private readonly gameSettingsRepository: Repository<GameSettings>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a game with optional settings in a single transaction.
   * Uses defaults if no settings provided. Rollback on failure.
   */
  async create(dto: CreateGameDto): Promise<{
    id: number;
    mode: string;
    numberOfPlayers: number;
    status: string;
    created_at: Date;
    settings: {
      auction: boolean;
      rentInPrison: boolean;
      mortgage: boolean;
      evenBuild: boolean;
      randomizePlayOrder: boolean;
      startingCash: number;
    };
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const game = queryRunner.manager.create(Game, {
        mode: dto.mode,
        numberOfPlayers: dto.numberOfPlayers,
        status: 'pending',
      });
      const savedGame = await queryRunner.manager.save(game);

      const settingsPayload = {
        ...DEFAULT_SETTINGS,
        ...(dto.settings ?? {}),
      };

      const gameSettings = queryRunner.manager.create(GameSettings, {
        game_id: savedGame.id,
        auction: settingsPayload.auction,
        rentInPrison: settingsPayload.rentInPrison,
        mortgage: settingsPayload.mortgage,
        evenBuild: settingsPayload.evenBuild,
        randomizePlayOrder: settingsPayload.randomizePlayOrder,
        startingCash: settingsPayload.startingCash,
      });
      await queryRunner.manager.save(gameSettings);

      await queryRunner.commitTransaction();

      return {
        id: savedGame.id,
        mode: savedGame.mode,
        numberOfPlayers: savedGame.numberOfPlayers,
        status: savedGame.status,
        created_at: savedGame.created_at,
        settings: {
          auction: settingsPayload.auction,
          rentInPrison: settingsPayload.rentInPrison,
          mortgage: settingsPayload.mortgage,
          evenBuild: settingsPayload.evenBuild,
          randomizePlayOrder: settingsPayload.randomizePlayOrder,
          startingCash: settingsPayload.startingCash,
        },
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
