import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GamePlayer } from './entities/game-player.entity';

@Injectable()
export class GamePlayersService {
  constructor(
    @InjectRepository(GamePlayer)
    private readonly gamePlayerRepository: Repository<GamePlayer>,
  ) {}

  async findOne(id: number): Promise<GamePlayer> {
    const player = await this.gamePlayerRepository.findOne({ where: { id } });
    if (!player) {
      throw new NotFoundException(`Game player ${id} not found`);
    }
    return player;
  }

  /**
   * Get available balance (balance minus trade_locked_balance).
   * Locked funds cannot be spent during trade negotiation.
   */
  getAvailableBalance(player: GamePlayer): number {
    const balance = player.balance;
    const locked = parseFloat(player.trade_locked_balance ?? '0');
    return Math.max(0, balance - locked);
  }

  /**
   * Check if player can spend the given amount.
   * Validates: available balance >= amount.
   */
  canSpend(player: GamePlayer, amount: number): boolean {
    return this.getAvailableBalance(player) >= amount;
  }

  /**
   * Lock funds during trade negotiation.
   * Cannot lock more than available balance.
   */
  async lockBalance(playerId: number, amount: number): Promise<GamePlayer> {
    if (amount <= 0) {
      throw new BadRequestException('Lock amount must be positive');
    }

    const player = await this.gamePlayerRepository.findOne({
      where: { id: playerId },
    });
    if (!player) {
      throw new BadRequestException('Player not found');
    }

    const available = this.getAvailableBalance(player);
    if (amount > available) {
      throw new BadRequestException(
        `Cannot lock ${amount}: available balance is ${available}`,
      );
    }

    const currentLocked = parseFloat(player.trade_locked_balance ?? '0');
    const newLocked = currentLocked + amount;
    player.trade_locked_balance = newLocked.toFixed(2);

    return this.gamePlayerRepository.save(player);
  }

  /**
   * Unlock funds when trade is cancelled or completed without using locked amount.
   * Cannot unlock more than currently locked.
   */
  async unlockBalance(playerId: number, amount: number): Promise<GamePlayer> {
    if (amount <= 0) {
      throw new BadRequestException('Unlock amount must be positive');
    }

    const player = await this.gamePlayerRepository.findOne({
      where: { id: playerId },
    });
    if (!player) {
      throw new BadRequestException('Player not found');
    }

    const currentLocked = parseFloat(player.trade_locked_balance ?? '0');
    if (amount > currentLocked) {
      throw new BadRequestException(
        `Cannot unlock ${amount}: locked balance is ${currentLocked}`,
      );
    }

    const newLocked = Math.max(0, currentLocked - amount);
    player.trade_locked_balance = newLocked.toFixed(2);

    return this.gamePlayerRepository.save(player);
  }

  /**
   * Deduct locked amount from balance and reset trade_locked_balance.
   * Call when trade completes and locked funds are actually spent.
   */
  async commitLockedBalance(
    playerId: number,
    amountToDeduct: number,
  ): Promise<GamePlayer> {
    if (amountToDeduct <= 0) {
      throw new BadRequestException('Amount to deduct must be positive');
    }

    const player = await this.gamePlayerRepository.findOne({
      where: { id: playerId },
    });
    if (!player) {
      throw new BadRequestException('Player not found');
    }

    const currentLocked = parseFloat(player.trade_locked_balance ?? '0');
    if (amountToDeduct > currentLocked) {
      throw new BadRequestException(
        `Cannot deduct ${amountToDeduct}: locked balance is ${currentLocked}`,
      );
    }

    player.balance -= amountToDeduct;
    player.trade_locked_balance = (currentLocked - amountToDeduct).toFixed(2);

    return this.gamePlayerRepository.save(player);
  }
}
