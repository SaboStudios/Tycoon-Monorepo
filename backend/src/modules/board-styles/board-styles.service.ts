import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoardStyle } from './entities/board-style.entity';
import { CreateBoardStyleDto } from './dto/create-board-style.dto';
import { UpdateBoardStyleDto } from './dto/update-board-style.dto';
import { BoardStylesPaginationDto } from './dto/board-styles-pagination.dto';
import {
  PaginationService,
  PaginatedResponse,
  SortOrder,
} from '../../common';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../../common/logger/logger.service';

const BOARD_STYLE_SORT_FIELDS = [
  'created_at',
  'updated_at',
  'name',
  'price',
  'id',
] as const;

@Injectable()
export class BoardStylesService {
  constructor(
    @InjectRepository(BoardStyle)
    private readonly boardStyleRepository: Repository<BoardStyle>,
    private readonly paginationService: PaginationService,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async create(createBoardStyleDto: CreateBoardStyleDto): Promise<BoardStyle> {
    const trimmedName = createBoardStyleDto.name?.trim();
    if (!trimmedName) {
      throw new BadRequestException('board style name is required');
    }

    const style = this.boardStyleRepository.create({
      ...createBoardStyleDto,
      name: trimmedName,
    });
    const saved = await this.boardStyleRepository.save(style);
    await this.invalidateCache();
    return saved;
  }

  async findAll(
    paginationDto: BoardStylesPaginationDto,
  ): Promise<PaginatedResponse<BoardStyle>> {
    const qb = this.boardStyleRepository.createQueryBuilder('board_style');

    if (paginationDto.is_premium !== undefined) {
      qb.andWhere('board_style.is_premium = :isPremium', {
        isPremium: paginationDto.is_premium,
      });
    }

    const pagination = {
      ...paginationDto,
      sortBy: paginationDto.sortBy ?? 'created_at',
      sortOrder: paginationDto.sortOrder ?? SortOrder.DESC,
    };

    return this.paginationService.paginate(
      qb,
      pagination,
      ['name', 'description'],
      [...BOARD_STYLE_SORT_FIELDS],
    );
  }

  async findOne(id: number): Promise<BoardStyle> {
    try {
      const style = await this.boardStyleRepository.findOne({ where: { id } });
      if (!style) {
        this.logger.logWithMeta('warn', 'Board style not found', {
          styleId: id,
          context: 'BoardStylesService',
        });
        throw new NotFoundException(`Board style with ID ${id} not found`);
      }

      this.logger.logWithMeta('debug', 'Board style retrieved', {
        styleId: id,
        context: 'BoardStylesService',
      });
      return style;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to fetch board style ${id}: ${(error as Error).message}`,
        (error as Error).stack,
        'BoardStylesService.findOne'
      );
      throw error;
    }
  }

  async update(
    id: number,
    updateBoardStyleDto: UpdateBoardStyleDto,
  ): Promise<BoardStyle> {
    const startTime = Date.now();
    try {
      const style = await this.findOne(id);
      const updatedStyle = this.boardStyleRepository.merge(
        style,
        updateBoardStyleDto,
      );
      const saved = await this.boardStyleRepository.save(updatedStyle);
      const duration = Date.now() - startTime;

      this.logger.logWithMeta('info', 'Board style updated', {
        styleId: id,
        duration,
        context: 'BoardStylesService',
      });

      await this.invalidateCache(id);
      return saved;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to update board style ${id}: ${(error as Error).message}`,
        (error as Error).stack,
        'BoardStylesService.update'
      );
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const startTime = Date.now();
    try {
      const style = await this.findOne(id);
      await this.boardStyleRepository.remove(style);
      const duration = Date.now() - startTime;

      this.logger.logWithMeta('info', 'Board style deleted', {
        styleId: id,
        duration,
        context: 'BoardStylesService',
      });

      await this.invalidateCache(id);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to delete board style ${id}: ${(error as Error).message}`,
        (error as Error).stack,
        'BoardStylesService.remove'
      );
      throw error;
    }
  }

  private async invalidateCache(id?: number) {
    try {
      await this.redisService.delByPattern('tycoon:board-styles:board-styles:*');
      if (id) {
        await this.redisService.delByPattern(
          `tycoon:board-styles:board-styles:${id}:*`,
        );
      }
      this.logger.logWithMeta('debug', 'Board styles cache invalidated', {
        styleId: id,
        context: 'BoardStylesService',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate board styles cache: ${(error as Error).message}`,
        'BoardStylesService.invalidateCache'
      );
    }
  }
}
