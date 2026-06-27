// src/chances/chances.controller.ts

import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChanceService } from './chance.service';
import { Chance } from './entities/chance.entity';
import { ListChancesQueryDto } from './dto/list-chances-query.dto';
import { PaginatedResponse } from '../../common';
import { ChanceValidationFilter, ChanceExceptionFilter } from './filters/chance-validation.filter';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { CreateChanceDto } from './dto/create-chance.dto';

@Controller('chances')
@UseFilters(ChanceValidationFilter, ChanceExceptionFilter)
export class ChanceController {
  constructor(private readonly chanceService: ChanceService) {}

  @Get()
  async getAllChances(
    @Query() queryDto: ListChancesQueryDto,
  ): Promise<PaginatedResponse<Chance>> {
    return this.chanceService.findAll(queryDto);
  }

  @Post()
  @Get('draw')
  async draw(): Promise<Chance> {
    return await this.chanceService.drawCard();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createChanceDto: CreateChanceDto): Promise<Chance> {
    return await this.chanceService.createChance(createChanceDto);
  }
}
