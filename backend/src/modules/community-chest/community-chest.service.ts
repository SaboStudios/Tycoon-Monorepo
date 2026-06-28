import {
  Injectable,
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityChest } from './entities/community-chest.entity';
import { CreateCommunityChestDto } from './dto/create-community-chest.dto';
import { UpdateCommunityChestDto } from './dto/update-community-chest.dto';
import {
  GetCommunityChestListDto,
  CommunityChestSortBy,
  COMMUNITY_CHEST_MAX_LIMIT,
} from './dto/get-community-chest-list.dto';
import { PaginatedResponse } from '../../common/interfaces/paginated-response.interface';
import { secureRandomInt } from '../../common/crypto-secure-random';
import {
  CommunityChestErrorMapperService,
  CommunityChestErrorCode,
} from './community-chest-error-mapper.service';

@Injectable()
export class CommunityChestService {
  constructor(
    @InjectRepository(CommunityChest)
    private readonly communityChestRepository: Repository<CommunityChest>,
    private readonly errorMapper: CommunityChestErrorMapperService,
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
    const existingCard = await this.communityChestRepository.findOne({
      where: { instruction: createDto.instruction },
    });

    if (existingCard) {
      const mapped = this.errorMapper.mapError(
        CommunityChestErrorCode.DUPLICATE_INSTRUCTION,
      );
      throw new HttpException(mapped, mapped.statusCode);
    }

    try {
      const communityChest = this.communityChestRepository.create({
        instruction: createDto.instruction,
        type: createDto.type,
        amount: createDto.amount ?? null,
        position: createDto.position ?? null,
        extra: createDto.extra ?? null,
      });

      return await this.communityChestRepository.save(communityChest);
    } catch {
      const mapped = this.errorMapper.mapError(
        CommunityChestErrorCode.CREATE_FAILED,
      );
      throw new HttpException(mapped, mapped.statusCode);
    }
  }

  async update(
    id: number,
    updateDto: UpdateCommunityChestDto,
  ): Promise<CommunityChest> {
    const card = await this.communityChestRepository.findOne({ where: { id } });

    if (!card) {
      const mapped = this.errorMapper.mapError(
        CommunityChestErrorCode.NOT_FOUND,
      );
      throw new HttpException(mapped, mapped.statusCode);
    }

    if (updateDto.instruction !== undefined) {
      const duplicate = await this.communityChestRepository.findOne({
        where: { instruction: updateDto.instruction },
      });
      if (duplicate && duplicate.id !== id) {
        const mapped = this.errorMapper.mapError(
          CommunityChestErrorCode.DUPLICATE_INSTRUCTION,
        );
        throw new HttpException(mapped, mapped.statusCode);
      }
    }

    try {
      Object.assign(card, updateDto);
      return await this.communityChestRepository.save(card);
    } catch {
      const mapped = this.errorMapper.mapError(
        CommunityChestErrorCode.UPDATE_FAILED,
      );
      throw new HttpException(mapped, mapped.statusCode);
    }
  }

  async findAll(
    query: GetCommunityChestListDto,
  ): Promise<PaginatedResponse<CommunityChest>> {
    const {
      page = 1,
      limit: rawLimit = 10,
      sortBy = CommunityChestSortBy.ID,
      sortOrder = 'ASC',
      type,
    } = query;

    const limit = Math.min(Math.max(1, rawLimit), COMMUNITY_CHEST_MAX_LIMIT);

    const qb =
      this.communityChestRepository.createQueryBuilder('community_chest');

    if (type) {
      qb.andWhere('community_chest.type = :type', { type });
    }

    const validSortColumns = Object.values(CommunityChestSortBy);
    const sortColumn = validSortColumns.includes(sortBy)
      ? sortBy
      : CommunityChestSortBy.ID;

    qb.orderBy(`community_chest.${sortColumn}`, sortOrder);

    if (sortColumn !== CommunityChestSortBy.ID) {
      qb.addOrderBy('community_chest.id', sortOrder);
    }

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [data, totalItems] = await qb.getManyAndCount();
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: number): Promise<CommunityChest | null> {
    return this.communityChestRepository.findOne({ where: { id } });
  }
}
