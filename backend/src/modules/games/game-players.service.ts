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
