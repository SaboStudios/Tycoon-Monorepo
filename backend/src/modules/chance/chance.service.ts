// src/chances/chances.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chance } from './entities/chance.entity';

@Injectable()
export class ChancesService {
  constructor(
    @InjectRepository(Chance)
    private readonly chanceRepo: Repository<Chance>,
  ) {}

  async findAll(page?: number, limit?: number): Promise<Chance[]> {
    const take = limit || 20;
    const skip = page && page > 0 ? (page - 1) * take : 0;

    return await this.chanceRepo.find({
      order: { id: 'ASC' },
      take,
      skip,
    });
  }
}
