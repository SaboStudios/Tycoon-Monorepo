import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { GamePlayersService } from '../games/game-players.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { GetUserGamesDto } from '../games/dto/get-user-games.dto';
import { User } from './entities/user.entity';
import { PaginationDto, PaginatedResponse } from '../../common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  RedisRateLimitGuard,
  RateLimit,
} from '../../common/guards/redis-rate-limit.guard';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly gamePlayersService: GamePlayersService,
  ) {}

  /**
   * Create a new user
   * POST /users
   * Apply stricter rate limiting for registration/creation
   */
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return await this.usersService.create(createUserDto);
  }

  /**
   * Get all users
   * GET /users
   * Cached automatically by CacheInterceptor
   */
  @Get()
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(50, 60) // 50 requests per minute
  async findAll(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<User>> {
    return await this.usersService.findAll(paginationDto);
  }

  /**
   * Get authenticated user's profile with gameplay statistics
   * GET /users/me/profile
   * Requires JWT authentication
   * Returns: username, games_played, game_won, game_lost, total_staked, total_earned, total_withdrawn
   */
  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(100, 60) // 100 requests per minute
  async getProfile(@Request() req: any): Promise<UserProfileDto> {
    return await this.usersService.getProfile(req.user.id);
  }

  /**
   * Get games for a user
   * GET /users/:id/games
   * Filters: gameId, inJail. Supports pagination.
   */
  @Get(':id/games')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(100, 60)
  async getGames(
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: GetUserGamesDto,
  ) {
    return this.gamePlayersService.findGamesByUser(id, dto);
  }

  /**
   * Get a single user by ID
   * GET /users/:id
   * Cached automatically by CacheInterceptor
   */
  @Get(':id')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(100, 60) // 100 requests per minute
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return await this.usersService.findOne(id);
  }

  /**
   * Update a user
   * PATCH /users/:id
   */
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return await this.usersService.update(id, updateUserDto);
  }

  /**
   * Delete a user
   * DELETE /users/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.usersService.remove(id);
  }
}
