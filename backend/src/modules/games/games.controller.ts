import {
  Body,
  Controller,
  Patch,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { GamePlayersService } from './game-players.service';
import { UpdateGamePlayerDto } from './dto/update-game-player.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('games')
export class GamesController {
  constructor(private readonly gamePlayersService: GamePlayersService) {}

  @Patch(':gameId/players/:playerId')
  @UseGuards(JwtAuthGuard)
  async updatePlayer(
    @Param('gameId', ParseIntPipe) gameId: number,
    @Param('playerId', ParseIntPipe) playerId: number,
    @Body() dto: UpdateGamePlayerDto,
    @Req() req: Request & { user?: { role?: string } },
  ) {
    const isAdmin = req.user?.role === 'admin';
    const player = await this.gamePlayersService.update(
      gameId,
      playerId,
      dto,
      isAdmin,
    );
    return player;
  }
}
