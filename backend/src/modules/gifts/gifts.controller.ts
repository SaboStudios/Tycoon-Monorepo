import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { GiftsService, PaginatedGifts } from './gifts.service';
import { CreateGiftDto } from './dto/create-gift.dto';
import { FilterGiftsDto } from './dto/filter-gifts.dto';
import { RespondGiftDto } from './dto/respond-gift.dto';
import { Gift } from './entities/gift.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  RedisRateLimitGuard,
  RateLimit,
} from '../../common/guards/redis-rate-limit.guard';

@ApiTags('gifts')
@Controller('gifts')
@UseGuards(JwtAuthGuard, RedisRateLimitGuard)
@ApiBearerAuth()
export class GiftsController {
  constructor(private readonly giftsService: GiftsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RateLimit(10, 60) // 10 gifts per minute
  @ApiOperation({ summary: 'Send a gift to another user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Gift created successfully.',
    type: Gift,
  })
  create(
    @CurrentUser() user: { id: number },
    @Body() createGiftDto: CreateGiftDto,
    @Req() req: Request,
  ): Promise<Gift> {
    return this.giftsService.create(user.id, createGiftDto, req);
  }

  @Get('sent')
  @RateLimit(30, 60)
  @ApiOperation({ summary: 'Get gifts sent by the current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated list of sent gifts.',
  })
  findSentGifts(
    @CurrentUser() user: { id: number },
    @Query() filterDto: FilterGiftsDto,
  ): Promise<PaginatedGifts> {
    return this.giftsService.findSentGifts(user.id, filterDto);
  }

  @Get('received')
  @RateLimit(30, 60)
  @ApiOperation({ summary: 'Get gifts received by the current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated list of received gifts.',
  })
  findReceivedGifts(
    @CurrentUser() user: { id: number },
    @Query() filterDto: FilterGiftsDto,
  ): Promise<PaginatedGifts> {
    return this.giftsService.findReceivedGifts(user.id, filterDto);
  }

  @Get(':id')
  @RateLimit(60, 60)
  @ApiOperation({ summary: 'Get a gift by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Gift found.',
    type: Gift,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Gift not found.',
  })
  findOne(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Gift> {
    return this.giftsService.findOne(id, user.id);
  }

  @Post(':id/respond')
  @RateLimit(20, 60) // 20 responses per minute
  @ApiOperation({ summary: 'Accept or reject a gift' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Gift response recorded.',
    type: Gift,
  })
  respondToGift(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() respondDto: RespondGiftDto,
    @Req() req: Request,
  ): Promise<Gift> {
    return this.giftsService.respondToGift(id, user.id, respondDto.action, req);
  }

  @Delete(':id')
  @RateLimit(20, 60)
  @ApiOperation({ summary: 'Cancel a pending gift (sender only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Gift cancelled.',
    type: Gift,
  })
  cancelGift(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<Gift> {
    return this.giftsService.cancelGift(id, user.id, req);
  }
}
