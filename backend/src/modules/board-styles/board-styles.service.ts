import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { BoardStyle } from './entities/board-style.entity';
import { CreateBoardStyleDto } from './dto/create-board-style.dto';
import { UpdateBoardStyleDto } from './dto/update-board-style.dto';

const CACHE_PREFIX = 'board_styles_';
const CACHE_TTL = 3600; // 1 hour

@Injectable()
export class BoardStylesService {
  constructor(
    @InjectRepository(BoardStyle)
    private readonly boardStyleRepository: Repository<BoardStyle>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createBoardStyleDto: CreateBoardStyleDto): Promise<BoardStyle> {
    const style = this.boardStyleRepository.create(createBoardStyleDto);
    const saved = await this.boardStyleRepository.save(style);
    await this.clearCache();
    return saved;
  }

  async findAll(isPremium?: boolean): Promise<BoardStyle[]> {
    const cacheKey = `${CACHE_PREFIX}all_${isPremium !== undefined ? isPremium : 'any'}`;
    const cached = await this.cacheManager.get<BoardStyle[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const qb = this.boardStyleRepository.createQueryBuilder('board_style');

    if (isPremium !== undefined) {
      qb.andWhere('board_style.is_premium = :isPremium', { isPremium });
    }

    qb.orderBy('board_style.created_at', 'DESC');

    const results = await qb.getMany();
    await this.cacheManager.set(cacheKey, results, CACHE_TTL);

    return results;
  }

  async findOne(id: number): Promise<BoardStyle> {
    const cacheKey = `${CACHE_PREFIX}${id}`;
    const cached = await this.cacheManager.get<BoardStyle>(cacheKey);

    if (cached) {
      return cached;
    }

    const style = await this.boardStyleRepository.findOne({ where: { id } });
    if (!style) {
      throw new NotFoundException(`Board style with ID ${id} not found`);
    }

    await this.cacheManager.set(cacheKey, style, CACHE_TTL);
    return style;
  }

  async update(
    id: number,
    updateBoardStyleDto: UpdateBoardStyleDto,
  ): Promise<BoardStyle> {
    const style = await this.findOne(id);
    const updatedStyle = this.boardStyleRepository.merge(
      style,
      updateBoardStyleDto,
    );
    const saved = await this.boardStyleRepository.save(updatedStyle);
    await this.clearCache(id);
    return saved;
  }

  async remove(id: number): Promise<void> {
    const style = await this.findOne(id);
    await this.boardStyleRepository.remove(style);
    await this.clearCache(id);
  }

  private async clearCache(id?: number) {
    if (id) {
      await this.cacheManager.del(`${CACHE_PREFIX}${id}`);
    }
    // We should ideally use pattern matching for redis, but simply deleting known combinations works for standard cache.
    // Given memory caches lack KEYS, we delete the exact known combinations.
    await this.cacheManager.del(`${CACHE_PREFIX}all_any`);
    await this.cacheManager.del(`${CACHE_PREFIX}all_true`);
    await this.cacheManager.del(`${CACHE_PREFIX}all_false`);
  }
}
