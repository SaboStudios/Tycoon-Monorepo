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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { PaginationDto, PaginatedResponse } from '../../common';
import { RedisRateLimitGuard, RateLimit } from '../../common/guards/redis-rate-limit.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

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
  async findAll(@Query() paginationDto: PaginationDto): Promise<PaginatedResponse<User>> {
    return await this.usersService.findAll(paginationDto);
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
