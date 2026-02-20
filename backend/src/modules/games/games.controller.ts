import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { GamePlayersService } from './game-players.service';
import { UpdateGamePlayerDto } from './dto/update-game-player.dto';
import { GetGamePlayersDto } from './dto/get-game-players.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(private readonly gamePlayersService: GamePlayersService) {}

  @Get(':gameId/players')
  @ApiOperation({ summary: 'Get players for a game' })
  @ApiOkResponse({ description: 'Paginated list of game players' })
  async getPlayers(
    @Param('gameId', ParseIntPipe) gameId: number,
    @Query() dto: GetGamePlayersDto,
  ) {
    return this.gamePlayersService.findPlayersByGame(gameId, dto);
  }

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
