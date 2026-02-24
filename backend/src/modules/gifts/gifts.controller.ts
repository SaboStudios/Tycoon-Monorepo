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
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GiftsService, PaginatedGifts } from './gifts.service';
import { CreateGiftDto } from './dto/create-gift.dto';
import { FilterGiftsDto } from './dto/filter-gifts.dto';
import { RespondGiftDto } from './dto/respond-gift.dto';
import { Gift } from './entities/gift.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('gifts')
@Controller('gifts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GiftsController {
  constructor(private readonly giftsService: GiftsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a gift to another user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Gift created successfully.',
    type: Gift,
  })
  create(
    @CurrentUser() user: { id: number },
    @Body() createGiftDto: CreateGiftDto,
  ): Promise<Gift> {
    return this.giftsService.create(user.id, createGiftDto);
  }

  @Get('sent')
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
  ): Promise<Gift> {
    return this.giftsService.respondToGift(id, user.id, respondDto.action);
  }

  @Delete(':id')
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
  ): Promise<Gift> {
    return this.giftsService.cancelGift(id, user.id);
  }
}
