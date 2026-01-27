import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityChest } from './entities/community-chest.entity';

@Injectable()
export class CommunityChestService {
  constructor(
    @InjectRepository(CommunityChest)
    private readonly communityChestRepository: Repository<CommunityChest>,
  ) {}

  async drawCard(): Promise<CommunityChest | null> {
    const result = await this.communityChestRepository
      .createQueryBuilder('community_chest')
      .orderBy('RANDOM()')
      .limit(1)
      .getOne();

    return result;
  }
}
