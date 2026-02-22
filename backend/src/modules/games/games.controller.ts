import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { GamePlayersService } from './game-players.service';
import { GamesService } from './games.service';
import { UpdateGamePlayerDto } from './dto/update-game-player.dto';
import { CreateGameDto } from './dto/create-game.dto';
import { GetGamePlayersDto } from './dto/get-game-players.dto';
import { GetGamesDto } from './dto/get-games.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(
    private readonly gamePlayersService: GamePlayersService,
    private readonly gamesService: GamesService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new game' })
  @ApiCreatedResponse({
    description: 'Game created successfully',
    schema: {
      example: {
        id: 1,
        code: 'ABC123',
        mode: 'PUBLIC',
        numberOfPlayers: 4,
        status: 'PENDING',
        is_ai: false,
        is_minipay: false,
        chain: null,
        contract_game_id: null,
        creator_id: 1,
        created_at: '2024-01-01T00:00:00.000Z',
        settings: {
          auction: true,
          rentInPrison: false,
          mortgage: true,
          evenBuild: true,
          randomizePlayOrder: true,
          startingCash: 1500,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async create(
    @Body() dto: CreateGameDto,
    @Req() req: Request & { user: { id: number; role?: string } },
  ) {
    const creatorId = req.user.id;
    return this.gamesService.create(dto, creatorId);
  }

  @Get()
  @ApiOperation({ summary: 'Get games with filters and pagination' })
  @ApiOkResponse({
    description: 'Paginated list of games with metadata',
    schema: {
      example: {
        data: [
          {
            id: 1,
            code: 'ABC123',
            mode: 'PUBLIC',
            status: 'PENDING',
            is_ai: false,
            is_minipay: false,
            chain: 'base',
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    },
  })
  async findAll(@Query() dto: GetGamesDto) {
    return this.gamesService.findAll(dto);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get a game by its unique code' })
  @ApiOkResponse({
    description: 'Game found with relations',
    schema: {
      example: {
        id: 1,
        code: 'ABC123',
        mode: 'PUBLIC',
        status: 'PENDING',
        creator: { id: 1, email: 'user@example.com', username: 'player1' },
        winner: null,
        nextPlayer: null,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Game not found' })
  async findByCode(@Param('code') code: string) {
    return this.gamesService.findByCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a game by ID' })
  @ApiOkResponse({
    description: 'Game found with relations',
    schema: {
      example: {
        id: 1,
        code: 'ABC123',
        mode: 'PUBLIC',
        status: 'PENDING',
        creator: { id: 1, email: 'user@example.com', username: 'player1' },
        winner: null,
        nextPlayer: null,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Game not found' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.gamesService.findById(id);
  }

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

  @Delete(':gameId/players/me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async leaveGame(
    @Param('gameId', ParseIntPipe) gameId: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    await this.gamePlayersService.leaveGameForUser(gameId, req.user.id);
  }
}
