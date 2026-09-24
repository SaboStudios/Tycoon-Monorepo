import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Perk } from './entities/perk.entity';
import { Boost } from './entities/boost.entity';
import { CreatePerkDto } from './dto/create-perk.dto';
import { UpdatePerkDto } from './dto/update-perk.dto';
import { CreateBoostDto } from './dto/create-boost.dto';
import { UpdateBoostDto } from './dto/update-boost.dto';
import { FilterPerksDto } from './dto/filter-perks.dto';
import {
  PaginationService,
  PaginationDto,
  PaginatedResponse,
} from '../../common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PerksService {
  constructor(
    @InjectRepository(Perk)
    private readonly perkRepository: Repository<Perk>,
    @InjectRepository(Boost)
    private readonly boostRepository: Repository<Boost>,
    private readonly paginationService: PaginationService,
    private readonly redisService: RedisService,
  ) {}

  async create(createPerkDto: CreatePerkDto): Promise<Perk> {
    const perk = this.perkRepository.create({
      ...createPerkDto,
      price: String(createPerkDto.price),
    });
    const saved = await this.perkRepository.save(perk);
    await this.invalidateCache();
    return saved;
  }

  async findAllAdmin(
    paginationDto: PaginationDto & FilterPerksDto,
  ): Promise<PaginatedResponse<Perk>> {
    const qb = this.perkRepository
      .createQueryBuilder('perk')
      .leftJoinAndSelect('perk.boosts', 'boosts');

    if (paginationDto.type) {
      qb.andWhere('perk.type = :type', { type: paginationDto.type });
    }
    if (paginationDto.category) {
      qb.andWhere('perk.category = :category', {
        category: paginationDto.category,
      });
    }
    if (paginationDto.is_active !== undefined) {
      qb.andWhere('perk.is_active = :is_active', {
        is_active: paginationDto.is_active,
      });
    }

    return this.paginationService.paginate(qb, paginationDto, [
      'name',
      'description',
    ]);
  }

  async findAllPublic(filterDto?: FilterPerksDto): Promise<Perk[]> {
    const qb = this.perkRepository
      .createQueryBuilder('perk')
      .leftJoinAndSelect('perk.boosts', 'boosts')
      .where('perk.is_active = :is_active', { is_active: true });

    if (filterDto?.type) {
      qb.andWhere('perk.type = :type', { type: filterDto.type });
    }
    if (filterDto?.category) {
      qb.andWhere('perk.category = :category', {
        category: filterDto.category,
      });
    }

    return qb.orderBy('perk.created_at', 'DESC').getMany();
  }

  async findOne(id: number, includeBoosts = true): Promise<Perk> {
    const perk = await this.perkRepository.findOne({
      where: { id },
      relations: includeBoosts ? ['boosts'] : [],
    });
    if (!perk) {
      throw new NotFoundException(`Perk with ID ${id} not found`);
    }
    return perk;
  }

  async findOnePublic(id: number): Promise<Perk> {
    const perk = await this.findOne(id);
    if (!perk.is_active) {
      throw new NotFoundException(`Perk with ID ${id} not found`);
    }
    return perk;
  }

  async findAllByPerkId(perkId: number): Promise<Boost[]> {
    await this.findOne(perkId, false);
    return this.boostRepository.find({
      where: { perk_id: perkId },
      order: { id: 'ASC' },
    });
  }

  async update(id: number, updatePerkDto: UpdatePerkDto): Promise<Perk> {
    const perk = await this.findOne(id);
    const { price, ...rest } = updatePerkDto;
    const toUpdate: Partial<Perk> = {
      ...rest,
      ...(price !== undefined ? { price: String(price) } : {}),
    };

    this.perkRepository.merge(perk, toUpdate);
    const saved = await this.perkRepository.save(perk);
    await this.invalidateCache(id);
    return saved;
  }

  async remove(id: number): Promise<void> {
    const perk = await this.findOne(id);
    await this.perkRepository.remove(perk);
    await this.invalidateCache(id);
  }

  async activate(id: number): Promise<Perk> {
    const perk = await this.findOne(id);
    if (perk.is_active) {
      throw new ConflictException(`Perk with ID ${id} is already active`);
    }
    perk.is_active = true;
    const saved = await this.perkRepository.save(perk);
    await this.invalidateCache(id);
    return saved;
  }

  async deactivate(id: number): Promise<Perk> {
    const perk = await this.findOne(id);
    if (!perk.is_active) {
      throw new ConflictException(`Perk with ID ${id} is already inactive`);
    }
    perk.is_active = false;
    const saved = await this.perkRepository.save(perk);
    await this.invalidateCache(id);
    return saved;
  }

  async createBoost(
    perkId: number,
    createBoostDto: CreateBoostDto,
  ): Promise<Boost> {
    await this.findOne(perkId, false);
    const boost = this.boostRepository.create({
      ...createBoostDto,
      perk_id: perkId,
      effect_value: String(createBoostDto.effect_value),
    });
    const saved = await this.boostRepository.save(boost);
    await this.invalidateCache(perkId);
    return saved;
  }

  async updateBoost(
    perkId: number,
    boostId: number,
    updateBoostDto: UpdateBoostDto,
  ): Promise<Boost> {
    const boost = await this.findBoostByIdAndPerkId(boostId, perkId);
    const { effect_value, ...rest } = updateBoostDto;
    const toUpdate: Partial<Boost> = {
      ...rest,
      ...(effect_value !== undefined
        ? { effect_value: String(effect_value) }
        : {}),
    };

    this.boostRepository.merge(boost, toUpdate);
    const saved = await this.boostRepository.save(boost);
    await this.invalidateCache(perkId);
    return saved;
  }

  async removeBoost(perkId: number, boostId: number): Promise<void> {
    const boost = await this.findBoostByIdAndPerkId(boostId, perkId);
    await this.boostRepository.remove(boost);
    await this.invalidateCache(perkId);
  }

  private async findBoostByIdAndPerkId(
    boostId: number,
    perkId: number,
  ): Promise<Boost> {
    const boost = await this.boostRepository.findOne({
      where: { id: boostId, perk_id: perkId },
    });
    if (!boost) {
      throw new NotFoundException(
        `Boost with ID ${boostId} not found for perk ${perkId}`,
      );
    }
    return boost;
  }

  private async invalidateCache(id?: number): Promise<void> {
    await this.redisService.delByPattern('tycoon:perks:perks:*');
    if (id) {
      await this.redisService.delByPattern(`tycoon:perks:perks:${id}:*`);
    }
  }
}
