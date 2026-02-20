import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamePlayer } from './entities/game-player.entity';
import { Game, GameStatus } from './entities/game.entity';
import { UpdateGamePlayerDto } from './dto/update-game-player.dto';

@Injectable()
export class GamePlayersService {
  constructor(
    @InjectRepository(GamePlayer)
    private readonly gamePlayerRepository: Repository<GamePlayer>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
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
    player.trade_locked_balance = Math.max(0, currentLocked - amount).toFixed(2);
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

  private async isGameStarted(gameId: number): Promise<boolean> {
    const game = await this.gameRepository.findOne({ where: { id: gameId } });
    if (!game) return false;
    return game.status === GameStatus.STARTED || game.status === GameStatus.ENDED;
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
}
