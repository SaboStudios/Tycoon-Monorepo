// src/chances/chances.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ChancesService } from './chances.service';
import { Chance } from './entities/chance.entity';

@Controller('chances')
export class ChancesController {
  constructor(private readonly chancesService: ChancesService) {}

  @Get()
  async getAllChances(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ success: boolean; page: number; limit: number; data: Chance[] }> {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;

    const data = await this.chancesService.findAll(pageNum, limitNum);

    return {
      success: true,
      page: pageNum,
      limit: limitNum,
      data,
    };
  }
}
