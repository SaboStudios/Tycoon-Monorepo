import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { GamePlayersService } from './game-players.service';
import { LockBalanceDto } from './dto/lock-balance.dto';
import { UnlockBalanceDto } from './dto/unlock-balance.dto';
import { PayRentDto } from './dto/pay-rent.dto';
import { PayTaxDto } from './dto/pay-tax.dto';
import { BuyPropertyDto } from './dto/buy-property.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SeatOwnershipGuard } from './guards/seat-ownership.guard';

/**
 * Balance and economic mutations are seat-scoped: every route requires a
 * verified JWT and only the owning seat (or an admin) may act on it.
 */
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('game-players')
export class GamePlayersController {
  constructor(private readonly gamePlayersService: GamePlayersService) {}

  @Get(':id/available-balance')
  @UseGuards(SeatOwnershipGuard)
  async getAvailableBalance(@Param('id', ParseIntPipe) id: number) {
    const player = await this.gamePlayersService.findOne(id);
    const available = this.gamePlayersService.getAvailableBalance(player);
    return { playerId: id, availableBalance: available };
  }

  @Post(':id/lock-balance')
  @UseGuards(SeatOwnershipGuard)
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
  @UseGuards(SeatOwnershipGuard)
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

  @Post(':id/pay-rent/:gameId')
  @UseGuards(SeatOwnershipGuard)
  async payRent(
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: PayRentDto,
  ) {
    return this.gamePlayersService.payRent(
      gameId,
      id,
      dto.payeeId,
      dto.baseRent,
    );
  }

  @Post(':id/pay-tax/:gameId')
  @UseGuards(SeatOwnershipGuard)
  async payTax(
    @Param('id', ParseIntPipe) id: number,
    @Param('gameId', ParseIntPipe) gameId: number,
    @Body() dto: PayTaxDto,
  ) {
    return this.gamePlayersService.payTax(gameId, id, dto.baseTax);
  }

  @Post(':id/buy-property/:gameId')
  @UseGuards(SeatOwnershipGuard)
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
