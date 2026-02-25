import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseIntPipe,
} from '@nestjs/common';
import { GamePlayersService } from './game-players.service';
import { LockBalanceDto } from './dto/lock-balance.dto';
import { UnlockBalanceDto } from './dto/unlock-balance.dto';
import { RollDiceDto } from './dto/roll-dice.dto';

@Controller('game-players')
export class GamePlayersController {
  constructor(private readonly gamePlayersService: GamePlayersService) {}

  @Get(':id/available-balance')
  async getAvailableBalance(@Param('id', ParseIntPipe) id: number) {
    const player = await this.gamePlayersService.findOne(id);
    const available = this.gamePlayersService.getAvailableBalance(player);
    return { playerId: id, availableBalance: available };
  }

  @Post(':id/lock-balance')
  async lockBalance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LockBalanceDto,
  ) {
    const player = await this.gamePlayersService.lockBalance(id, dto.amount);
    return {
      playerId: player.id,
      balance: player.balance,
      tradeLockedBalance: player.trade_locked_balance,
      availableBalance: this.gamePlayersService.getAvailableBalance(player),
    };
  }

  @Post(':id/unlock-balance')
  async unlockBalance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UnlockBalanceDto,
  ) {
    const player = await this.gamePlayersService.unlockBalance(id, dto.amount);
    return {
      playerId: player.id,
      balance: player.balance,
      tradeLockedBalance: player.trade_locked_balance,
      availableBalance: this.gamePlayersService.getAvailableBalance(player),
    };
  }
}
