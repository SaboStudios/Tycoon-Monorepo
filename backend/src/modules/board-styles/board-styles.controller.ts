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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BoardStylesService } from './board-styles.service';
import { CreateBoardStyleDto } from './dto/create-board-style.dto';
import { UpdateBoardStyleDto } from './dto/update-board-style.dto';
import { CacheInterceptor } from '@nestjs/cache-manager';

@ApiTags('board-styles')
@Controller('board-styles')
export class BoardStylesController {
  constructor(private readonly boardStylesService: BoardStylesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new board style (Admin)' })
  create(@Body() createBoardStyleDto: CreateBoardStyleDto) {
    return this.boardStylesService.create(createBoardStyleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all board styles' })
  @ApiQuery({
    name: 'is_premium',
    required: false,
    type: Boolean,
    description: 'Filter by premium status',
  })
  // We can use standard cache interceptor, but our service already handles deep caching.
  // @UseInterceptors(CacheInterceptor)
  findAll(@Query('is_premium') is_premium?: string) {
    let isPremiumBool: boolean | undefined;
    if (is_premium !== undefined) {
      isPremiumBool = is_premium === 'true';
    }
    return this.boardStylesService.findAll(isPremiumBool);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a board style by id' })
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
