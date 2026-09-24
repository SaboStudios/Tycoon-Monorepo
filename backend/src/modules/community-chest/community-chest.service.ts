import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityChest } from './entities/community-chest.entity';
import { CreateCommunityChestDto } from './dto/create-community-chest.dto';
import {
  GetCommunityChestListDto,
  CommunityChestSortBy,
} from './dto/get-community-chest-list.dto';
import { secureRandomInt } from '../../common/crypto-secure-random';

@Injectable()
export class CommunityChestService {
  constructor(
    @InjectRepository(CommunityChest)
    private readonly communityChestRepository: Repository<CommunityChest>,
  ) {}

  async drawCard(): Promise<CommunityChest | null> {
    const count = await this.communityChestRepository.count();
    if (count === 0) {
      return null;
    }
    const skip = secureRandomInt(count);
    const rows = await this.communityChestRepository.find({
      order: { id: 'ASC' },
      skip,
      take: 1,
    });
    return rows[0] ?? null;
  }

  async create(createDto: CreateCommunityChestDto): Promise<CommunityChest> {
    try {
      // Check for duplicate instruction
      const existingCard = await this.communityChestRepository.findOne({
        where: { instruction: createDto.instruction },
      });

      if (existingCard) {
        throw new ConflictException(
          'A Community Chest card with this instruction already exists',
        );
      }

      // Create and save the new card
      const communityChest = this.communityChestRepository.create({
        instruction: createDto.instruction,
        type: createDto.type,
        amount: createDto.amount ?? null,
        position: createDto.position ?? null,
        extra: createDto.extra ?? null,
      });

      return await this.communityChestRepository.save(communityChest);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to create Community Chest card',
      );
    }
  }

  /**
   * Get all Community Chest cards with optional filtering and ordering
   * Supports flexible ordering by any field and type filtering
   * Optimized query with index on type and createdAt for efficient filtering/sorting
   */
  async findAll(query: GetCommunityChestListDto): Promise<CommunityChest[]> {
    const { sortBy = CommunityChestSortBy.ID, sortOrder = 'ASC', type } = query;

    const qb =
      this.communityChestRepository.createQueryBuilder('community_chest');

    // Apply type filter if provided
    if (type) {
      qb.andWhere('community_chest.type = :type', { type });
    }

    // Apply ordering - validate sortBy is a valid column
    const validSortColumns = Object.values(CommunityChestSortBy);
    const sortColumn = validSortColumns.includes(sortBy)
      ? sortBy
      : CommunityChestSortBy.ID;

    qb.orderBy(`community_chest.${sortColumn}`, sortOrder);

    return await qb.getMany();
  }

  async findOne(id: number): Promise<CommunityChest | null> {
    return this.communityChestRepository.findOne({ where: { id } });
  }
}
