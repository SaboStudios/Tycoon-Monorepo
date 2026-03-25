import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoardStyle } from './entities/board-style.entity';
import { CreateBoardStyleDto } from './dto/create-board-style.dto';
import { UpdateBoardStyleDto } from './dto/update-board-style.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class BoardStylesService {
  constructor(
    @InjectRepository(BoardStyle)
    private readonly boardStyleRepository: Repository<BoardStyle>,
    private readonly redisService: RedisService,
  ) {}

  async create(createBoardStyleDto: CreateBoardStyleDto): Promise<BoardStyle> {
    const style = this.boardStyleRepository.create(createBoardStyleDto);
    const saved = await this.boardStyleRepository.save(style);
    await this.invalidateCache();
    return saved;
  }

  async findAll(isPremium?: boolean): Promise<BoardStyle[]> {
    const qb = this.boardStyleRepository.createQueryBuilder('board_style');

    if (isPremium !== undefined) {
      qb.andWhere('board_style.is_premium = :isPremium', { isPremium });
    }

    qb.orderBy('board_style.created_at', 'DESC');

    return await qb.getMany();
  }

  async findOne(id: number): Promise<BoardStyle> {
    const style = await this.boardStyleRepository.findOne({ where: { id } });
    if (!style) {
      throw new NotFoundException(`Board style with ID ${id} not found`);
    }
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
    await this.invalidateCache(id);
    return saved;
  }

  async remove(id: number): Promise<void> {
    const style = await this.findOne(id);
    await this.boardStyleRepository.remove(style);
    await this.invalidateCache(id);
  }

  private async invalidateCache(id?: number) {
    await this.redisService.delByPattern('tycoon:board-styles:board-styles:*');
    if (id) {
      await this.redisService.delByPattern(
        `tycoon:board-styles:board-styles:${id}:*`,
      );
    }
  }
}
