import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Post,
  Body,
} from '@nestjs/common';
import { ChanceService } from './chance.service';
import { Chance } from './entities/chance.entity';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { RolesGuard } from '../auth/guards/roles.guard';

import { Roles } from '../auth/decorators/roles.decorator';

import { Role } from '../auth/enums/role.enum';

import { CreateChanceDto } from './dto/create-chance.dto';
@Controller('chances')
export class ChanceController {
  constructor(private readonly chanceService: ChanceService) { }

  @Get()
  async getAllChances(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ success: boolean; page: number; limit: number; data: Chance[] }> {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;

    const data = await this.chanceService.findAll(pageNum, limitNum);

    return {
      success: true,
      page: pageNum,
      limit: limitNum,
      data,
    };
  }

  @Post()

  @UseGuards(JwtAuthGuard, RolesGuard)

  @Roles(Role.ADMIN)

  @HttpCode(HttpStatus.CREATED)

  async create(@Body() createChanceDto: CreateChanceDto): Promise<Chance> {

    return await this.chanceService.createChance(createChanceDto);

  }

}
