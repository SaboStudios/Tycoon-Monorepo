import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { BoardStylesService } from './board-styles.service';
import { AdvancedCacheInterceptor } from '../../common/interceptors/advanced-cache.interceptor';
import { CacheOptions } from '../../common/decorators/cache-options.decorator';
import { CreateBoardStyleDto } from './dto/create-board-style.dto';
import { UpdateBoardStyleDto } from './dto/update-board-style.dto';
import { BoardStylesPaginationDto } from './dto/board-styles-pagination.dto';
import { PaginatedResponse } from '../../common';
import { BoardStyle } from './entities/board-style.entity';
import { IdempotencyInterceptor } from '../redis/idempotency.interceptor';

@ApiTags('board-styles')
@Controller('board-styles')
@UseInterceptors(IdempotencyInterceptor)
export class BoardStylesController {
  constructor(private readonly boardStylesService: BoardStylesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new board style (Admin)' })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    required: false,
    description:
      'Optional idempotency key; duplicate POSTs with the same key return the cached response',
  })
  create(@Body() createBoardStyleDto: CreateBoardStyleDto) {
    return this.boardStylesService.create(createBoardStyleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all board styles' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    example: 'created_at',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by name or description',
  })
  @ApiQuery({
    name: 'is_premium',
    required: false,
    type: Boolean,
    description: 'Filter by premium status',
  })
  @UseInterceptors(AdvancedCacheInterceptor)
  @CacheOptions({ ttl: 600, keyPrefix: 'board-styles', useUserPrefix: false })
  findAll(
    @Query() paginationDto: BoardStylesPaginationDto,
  ): Promise<PaginatedResponse<BoardStyle>> {
    return this.boardStylesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a board style by id' })
  @UseInterceptors(AdvancedCacheInterceptor)
  @CacheOptions({ ttl: 600, keyPrefix: 'board-styles', useUserPrefix: false })
  findOne(@Param('id') id: string) {
    return this.boardStylesService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a board style (Admin)' })
  update(
    @Param('id') id: string,
    @Body() updateBoardStyleDto: UpdateBoardStyleDto,
  ) {
    return this.boardStylesService.update(+id, updateBoardStyleDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a board style (Admin)' })
  remove(@Param('id') id: string) {
    return this.boardStylesService.remove(+id);
  }
}
