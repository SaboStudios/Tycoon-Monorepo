import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamePlayer } from './entities/game-player.entity';
import { Game } from './entities/game.entity';
import { UpdateGamePlayerDto } from './dto/update-game-player.dto';
import { GetGamePlayersDto } from './dto/get-game-players.dto';
import { GetUserGamesDto } from './dto/get-user-games.dto';
import { PaginationService } from '../../common/services/pagination.service';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { GameStatus } from './entities/game.entity';

@Injectable()
export class GamePlayersService {
  constructor(
    @InjectRepository(GamePlayer)
    private readonly gamePlayerRepository: Repository<GamePlayer>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    private readonly paginationService: PaginationService,
  ) {}

  /**
   * Get available balance (balance minus trade_locked_balance).
   */
  getAvailableBalance(player: GamePlayer): number {
    const balance = player.balance;
    const locked = parseFloat(player.trade_locked_balance ?? '0');
    return Math.max(0, balance - locked);
  }

  /**
   * Lock funds during trade negotiation.
   */
  async lockBalance(playerId: number, amount: number): Promise<GamePlayer> {
    if (amount <= 0) {
      throw new BadRequestException('Lock amount must be positive');
    }
    const player = await this.findOne(playerId);
    const available = this.getAvailableBalance(player);
    if (amount > available) {
      throw new BadRequestException(
        `Cannot lock ${amount}: available balance is ${available}`,
      );
    }
    const currentLocked = parseFloat(player.trade_locked_balance ?? '0');
    player.trade_locked_balance = (currentLocked + amount).toFixed(2);
    return this.gamePlayerRepository.save(player);
  }

  /**
   * Unlock funds when trade is cancelled or completed.
   */
  async unlockBalance(playerId: number, amount: number): Promise<GamePlayer> {
    if (amount <= 0) {
      throw new BadRequestException('Unlock amount must be positive');
    }
    const player = await this.findOne(playerId);
    const currentLocked = parseFloat(player.trade_locked_balance ?? '0');
    if (amount > currentLocked) {
      throw new BadRequestException(
        `Cannot unlock ${amount}: locked balance is ${currentLocked}`,
      );
    }
    player.trade_locked_balance = Math.max(0, currentLocked - amount).toFixed(
      2,
    );
    return this.gamePlayerRepository.save(player);
  }

  async findOne(id: number): Promise<GamePlayer> {
    const player = await this.gamePlayerRepository.findOne({ where: { id } });
    if (!player) {
      throw new NotFoundException(`Game player ${id} not found`);
    }
    return player;
  }

  async findByGameAndPlayer(
    gameId: number,
    playerId: number,
  ): Promise<GamePlayer> {
    const player = await this.gamePlayerRepository.findOne({
      where: { id: playerId, game_id: gameId },
    });
    if (!player) {
      throw new NotFoundException(
        `Game player ${playerId} not found in game ${gameId}`,
      );
    }
    return player;
  }

  async leaveGameForUser(gameId: number, userId: number): Promise<void> {
    const game = await this.gameRepository.findOne({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }
    if (game.status !== GameStatus.PENDING) {
      throw new BadRequestException('Cannot leave game after it has started');
    }

    const player = await this.gamePlayerRepository.findOne({
      where: { game_id: gameId, user_id: userId },
    });
    if (!player) {
      throw new NotFoundException(
        `User ${userId} is not a player in game ${gameId}`,
      );
    }

    if (player.turn_order !== null) {
      await this.gamePlayerRepository
        .createQueryBuilder()
        .update(GamePlayer)
        .set({ turn_order: () => 'turn_order - 1' })
        .where('game_id = :gameId', { gameId })
        .andWhere('turn_order > :turnOrder', {
          turnOrder: player.turn_order,
        })
        .execute();
    }

    await this.gamePlayerRepository.delete(player.id);
  }

  private async isGameStarted(gameId: number): Promise<boolean> {
    const game = await this.gameRepository.findOne({ where: { id: gameId } });
    if (!game) return false;
    return (
      game.status === GameStatus.RUNNING || game.status === GameStatus.FINISHED
    );
  }

  async update(
    gameId: number,
    playerId: number,
    dto: UpdateGamePlayerDto,
    isAdmin = false,
  ): Promise<GamePlayer> {
    const player = await this.findByGameAndPlayer(gameId, playerId);
    const gameStarted = await this.isGameStarted(gameId);

    if (dto.symbol !== undefined) {
      if (gameStarted) {
        throw new BadRequestException(
          'Cannot update symbol after game has started',
        );
      }
      player.symbol = dto.symbol;
    }

    if (dto.address !== undefined) {
      player.address = dto.address;
    }

    if (dto.trade_locked_balance !== undefined) {
      player.trade_locked_balance = dto.trade_locked_balance.toFixed(2);
    }

    if (dto.in_jail !== undefined) {
      if (!isAdmin) {
        throw new ForbiddenException('Only admin/system can update in_jail');
      }
      player.in_jail = dto.in_jail;
    }

    return this.gamePlayerRepository.save(player);
  }

  /**
   * Get players for a game with filters and pagination.
   * Uses indexes on game_id, user_id, in_jail.
   */
  async findPlayersByGame(
    gameId: number,
    dto: GetGamePlayersDto,
  ): Promise<PaginatedResponse<GamePlayer>> {
    const game = await this.gameRepository.findOne({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    const qb = this.gamePlayerRepository
      .createQueryBuilder('gp')
      .where('gp.game_id = :gameId', { gameId });

    if (dto.userId !== undefined) {
      qb.andWhere('gp.user_id = :userId', { userId: dto.userId });
    }
    if (dto.inJail !== undefined) {
      qb.andWhere('gp.in_jail = :inJail', { inJail: dto.inJail });
    }
    if (dto.activeTurn === true) {
      qb.andWhere('gp.turn_order = 1');
    }
    if (dto.balanceMin !== undefined) {
      qb.andWhere('gp.balance >= :balanceMin', { balanceMin: dto.balanceMin });
    }
    if (dto.balanceMax !== undefined) {
      qb.andWhere('gp.balance <= :balanceMax', { balanceMax: dto.balanceMax });
    }

    return this.paginationService.paginate(qb, dto, []);
  }

  /**
   * Get games for a user with filters and pagination.
   * Joins game_players with games. Uses indexes on user_id, game_id.
   */
  async findGamesByUser(
    userId: number,
    dto: GetUserGamesDto,
  ): Promise<PaginatedResponse<Game>> {
    const qb = this.gameRepository
      .createQueryBuilder('g')
      .innerJoin('game_players', 'gp', 'gp.game_id = g.id')
      .where('gp.user_id = :userId', { userId });

    if (dto.gameId !== undefined) {
      qb.andWhere('g.id = :gameId', { gameId: dto.gameId });
    }
    if (dto.inJail !== undefined) {
      qb.andWhere('gp.in_jail = :inJail', { inJail: dto.inJail });
    }

    return this.paginationService.paginate(qb, dto, []);
  }

  async rollDice(
    gameId: number,
    playerId: number,
    dice1: number,
    dice2: number,
  ): Promise<GamePlayer> {
    const player = await this.findByGameAndPlayer(gameId, playerId);
    const BOARD_SIZE = 40;
    const START_BONUS = 200;
    const JAIL_POSITION = 10;
    const MAX_JAIL_ROLLS = 3;

    if (player.rolled === 1) {
      throw new BadRequestException('Player has already rolled this turn');
    }

    const total = dice1 + dice2;
    const oldPosition = player.position;
    const newPosition = (oldPosition + total) % BOARD_SIZE;

    if (player.in_jail) {
      player.in_jail_rolls += 1;
      if (dice1 === dice2) {
        player.in_jail = false;
        player.in_jail_rolls = 0;
        player.position = newPosition;
      } else if (player.in_jail_rolls >= MAX_JAIL_ROLLS) {
        player.in_jail = false;
        player.in_jail_rolls = 0;
        player.position = newPosition;
      }
    } else {
      player.position = newPosition;
      if (newPosition < oldPosition) {
        player.circle += 1;
        player.balance += START_BONUS;
      }
    }

    player.rolls += 1;
    player.rolled = 1;

    return this.gamePlayerRepository.save(player);
  }

  async advanceTurn(
    gameId: number,
    currentUserId: number,
    options?: { isTimeout?: boolean; now?: string },
  ): Promise<void> {
    const game = await this.gameRepository.findOne({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException(`Game ${gameId} not found`);
    }

    const players = await this.gamePlayerRepository.find({
      where: { game_id: gameId },
      order: { turn_order: 'ASC' },
    });

    if (players.length === 0) {
      throw new BadRequestException('No players found for this game');
    }

    const currentIndex = players.findIndex(
      (player) => player.user_id === currentUserId,
    );

    if (currentIndex === -1) {
      throw new NotFoundException(
        `User ${currentUserId} is not a player in game ${gameId}`,
      );
    }

    const currentPlayer = players[currentIndex];
    const isTimeout = options?.isTimeout ?? false;
    const now = options?.now ?? Date.now().toString();

    if (isTimeout) {
      currentPlayer.consecutive_timeouts += 1;
      currentPlayer.last_timeout_turn_start = currentPlayer.turn_start;
    } else {
      currentPlayer.consecutive_timeouts = 0;
    }
    currentPlayer.turn_start = null;

    let nextPlayer = currentPlayer;
    for (let offset = 1; offset <= players.length; offset++) {
      const index = (currentIndex + offset) % players.length;
      const candidate = players[index];
      if (!candidate.in_jail) {
        nextPlayer = candidate;
        break;
      }
    }

    nextPlayer.turn_start = now;
    nextPlayer.turn_count += 1;
    nextPlayer.consecutive_timeouts = 0;
    nextPlayer.rolled = 0;

    await this.gamePlayerRepository.save([currentPlayer, nextPlayer]);
    game.next_player_id = nextPlayer.user_id;
    await this.gameRepository.save(game);
  }
}
