import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { GamePlayersService } from './game-players.service';
import { LockBalanceDto } from './dto/lock-balance.dto';
import { UnlockBalanceDto } from './dto/unlock-balance.dto';
import { RollDiceDto } from './dto/roll-dice.dto';
import { PayRentDto } from './dto/pay-rent.dto';
import { PayTaxDto } from './dto/pay-tax.dto';
import { BuyPropertyDto } from './dto/buy-property.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
  @UseGuards(JwtAuthGuard)
  async unlockBalance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UnlockBalanceDto,
    @Req() req: Request & { user: { id: number } },
  ) {
    const player = await this.gamePlayersService.unlockBalance(
      id,
      dto.amount,
      req.user.id,
    );
    return {
      playerId: player.id,
      balance: player.balance,
      tradeLockedBalance: player.trade_locked_balance,
      availableBalance: this.gamePlayersService.getAvailableBalance(player),
    };
  }

  @Post(':id/pay-rent/:gameId')
  @UseGuards(JwtAuthGuard)
  async payRent(
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: PayRentDto,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.gamePlayersService.payRent(
      gameId,
      id,
      dto.payeeId,
      dto.baseRent,
      req.user.id,
    );
  }

  @Post(':id/pay-tax/:gameId')
  async payTax(
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: PayTaxDto,
  ) {
    return this.gamePlayersService.payTax(gameId, id, dto.baseTax);
  }

  @Post(':id/buy-property/:gameId')
  async buyProperty(
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: BuyPropertyDto,
  ) {
    return this.gamePlayersService.buyProperty(
      gameId,
      id,
      dto.propertyCost,
      dto.propertyId,
    );
  }
}
