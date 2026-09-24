import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CommunityChestService } from './community-chest.service';
import { CommunityChest } from './entities/community-chest.entity';
import { CreateCommunityChestDto } from './dto/create-community-chest.dto';
import { GetCommunityChestListDto } from './dto/get-community-chest-list.dto';

@Controller('community-chest')
export class CommunityChestController {
  constructor(private readonly communityChestService: CommunityChestService) {}

  @Get('draw')
  async draw(): Promise<CommunityChest | null> {
    return this.communityChestService.drawCard();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreateCommunityChestDto,
  ): Promise<CommunityChest> {
    return this.communityChestService.create(createDto);
  }

  @Get()
  async findAll(
    @Query() query: GetCommunityChestListDto,
  ): Promise<CommunityChest[]> {
    return this.communityChestService.findAll(query);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CommunityChest | null> {
    return this.communityChestService.findOne(id);
  }
}
