import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Game, GameStatus } from './entities/game.entity';
import { GameSettings } from './entities/game-settings.entity';
import { CreateGameDto } from './dto/create-game.dto';
import { PaginatedResponse, PaginationService, SortOrder } from '../../common';
import { GetGamesDto } from './dto/get-games.dto';

const DEFAULT_SETTINGS = {
  auction: true,
  rentInPrison: false,
  mortgage: true,
  evenBuild: true,
  randomizePlayOrder: true,
  startingCash: 1500,
};

/**
 * Generate a unique game code
 * Format: 6-character alphanumeric string (uppercase letters and numbers)
 */
function generateGameCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    @InjectRepository(GameSettings)
    private readonly gameSettingsRepository: Repository<GameSettings>,
    private readonly dataSource: DataSource,
    private readonly paginationService: PaginationService,
  ) {}

  async findAll(dto: GetGamesDto): Promise<PaginatedResponse<Game>> {
    const qb = this.gameRepository.createQueryBuilder('g');

    if (dto.userId !== undefined) {
      qb.andWhere('g.creator_id = :userId', { userId: dto.userId });
    }

    if (dto.status !== undefined) {
      qb.andWhere('g.status = :status', { status: dto.status });
    }

    if (dto.mode !== undefined) {
      qb.andWhere('g.mode = :mode', { mode: dto.mode });
    }

    if (dto.isAi !== undefined) {
      qb.andWhere('g.is_ai = :isAi', { isAi: dto.isAi });
    }

    if (dto.isMinipay !== undefined) {
      qb.andWhere('g.is_minipay = :isMinipay', { isMinipay: dto.isMinipay });
    }

    if (dto.chain !== undefined) {
      qb.andWhere('g.chain = :chain', { chain: dto.chain });
    }

    if (dto.activeOnly === true) {
      qb.andWhere('g.status = :activeStatus', {
        activeStatus: GameStatus.RUNNING,
      });
    }

    if (dto.startedOrPending === true) {
      qb.andWhere('g.status IN (:...startedStatuses)', {
        startedStatuses: [GameStatus.PENDING, GameStatus.RUNNING],
      });
    }

    const sortBy = dto.sortBy || 'created_at';
    const sortOrder = dto.sortOrder || SortOrder.DESC;

    return this.paginationService.paginate(qb, { ...dto, sortBy, sortOrder }, [
      'code',
      'chain',
    ]);
  }

  /**
   * Generate a unique game code, retrying if collision occurs
   */
  private async generateUniqueCode(): Promise<string> {
    let code = generateGameCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const existing = await this.gameRepository.findOne({
        where: { code },
      });

      if (!existing) {
        return code;
      }

      code = generateGameCode();
      attempts++;
    }

    throw new Error(
      'Failed to generate unique game code after multiple attempts',
    );
  }

  /**
   * Find a game by ID with relations (creator, winner, nextPlayer)
   */
  async findById(id: number): Promise<Game> {
    const game = await this.gameRepository.findOne({
      where: { id },
      relations: ['creator', 'winner', 'nextPlayer'],
    });

    if (!game) {
      throw new NotFoundException(`Game with ID ${id} not found`);
    }

    return game;
  }

  /**
   * Find a game by unique code with relations (creator, winner, nextPlayer)
   */
  async findByCode(code: string): Promise<Game> {
    const game = await this.gameRepository.findOne({
      where: { code: code.toUpperCase() },
      relations: ['creator', 'winner', 'nextPlayer'],
    });

    if (!game) {
      throw new NotFoundException(`Game with code ${code} not found`);
    }

    return game;
  }

  /**
   * Create a game with optional settings in a single transaction.
   * Uses defaults if no settings provided. Rollback on failure.
   */
  async create(
    dto: CreateGameDto,
    creatorId: number,
  ): Promise<{
    id: number;
    code: string;
    mode: string;
    number_of_players: number;
    status: string;
    is_ai: boolean;
    is_minipay: boolean;
    chain: string | null;
    contract_game_id: string | null;
    creator_id: number;
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
      // Generate unique game code
      const gameCode = await this.generateUniqueCode();

      const game = queryRunner.manager.create(Game, {
        code: gameCode,
        mode: dto.mode,
        number_of_players: dto.numberOfPlayers,
        creator_id: creatorId,
        status: GameStatus.PENDING,
        is_ai: dto.is_ai ?? false,
        is_minipay: dto.is_minipay ?? false,
        chain: dto.chain ?? null,
        contract_game_id: dto.contract_game_id ?? null,
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
        code: savedGame.code,
        mode: savedGame.mode as string,
        number_of_players: savedGame.number_of_players,
        status: savedGame.status as string,
        is_ai: savedGame.is_ai,
        is_minipay: savedGame.is_minipay,
        chain: savedGame.chain,
        contract_game_id: savedGame.contract_game_id,
        creator_id: savedGame.creator_id,
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
