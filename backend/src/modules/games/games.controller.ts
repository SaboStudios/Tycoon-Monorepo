import {
  Body,
  Controller,
  Post,
  Patch,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { GamePlayersService } from './game-players.service';
import { GamesService } from './games.service';
import { UpdateGamePlayerDto } from './dto/update-game-player.dto';
import { CreateGameDto } from './dto/create-game.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(
    private readonly gamePlayersService: GamePlayersService,
    private readonly gamesService: GamesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new game' })
  @ApiCreatedResponse({ description: 'Game and settings created' })
  async create(@Body() dto: CreateGameDto) {
    return this.gamesService.create(dto);
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
