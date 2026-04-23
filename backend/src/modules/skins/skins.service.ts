import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skin } from './entities/skin.entity';
import { CreateSkinDto } from './dto/create-skin.dto';
import { UpdateSkinDto } from './dto/update-skin.dto';
import { SkinCategory } from './enums/skin-category.enum';
import { SkinRarity } from './enums/skin-rarity.enum';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SkinsService {
  constructor(
    @InjectRepository(Skin)
    private readonly skinRepository: Repository<Skin>,
    private readonly redisService: RedisService,
  ) {}

  async create(createSkinDto: CreateSkinDto): Promise<Skin> {
    const skin = this.skinRepository.create(createSkinDto);
    const saved = await this.skinRepository.save(skin);
    await this.invalidateCache();
    return saved;
  }

  async findAll(query?: {
    category?: SkinCategory;
    rarity?: SkinRarity;
  }): Promise<Skin[]> {
    const qb = this.skinRepository.createQueryBuilder('skin');

    if (query?.category) {
      qb.andWhere('skin.category = :category', { category: query.category });
    }

    if (query?.rarity) {
      qb.andWhere('skin.rarity = :rarity', { rarity: query.rarity });
    }

    // Sort appropriately
    qb.orderBy('skin.created_at', 'DESC');

    return await qb.getMany();
  }

  async findByCategory(category: SkinCategory): Promise<Skin[]> {
    return await this.skinRepository.find({
      where: { category },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Skin> {
    const skin = await this.skinRepository.findOne({ where: { id } });
    if (!skin) {
      throw new NotFoundException(`Skin with ID ${id} not found`);
    }
    return skin;
  }

  async update(id: number, updateSkinDto: UpdateSkinDto): Promise<Skin> {
    const skin = await this.findOne(id);
    const updatedSkin = this.skinRepository.merge(skin, updateSkinDto);
    const saved = await this.skinRepository.save(updatedSkin);
    await this.invalidateCache(id);
    return saved;
  }

  async remove(id: number): Promise<void> {
    const skin = await this.findOne(id);
    await this.skinRepository.remove(skin);
    await this.invalidateCache(id);
  }

  async unlockSkin(userId: string, skinId: number): Promise<boolean> {
    // In a real application, you'd check if the user has enough currency,
    // verify the skin isn't already unlocked, and store the relation.
    // Assuming you have a user_skins table or similar.
    // Ensure the skin exists
    await this.findOne(skinId);

    // Logic to actually bind the skin to the user would go here.
    // For now, we simulate success.

    return true;
  }

  private async invalidateCache(id?: number): Promise<void> {
    await this.redisService.delByPattern('tycoon:skins:skins:*');
    if (id) {
      await this.redisService.delByPattern(`tycoon:skins:skins:${id}:*`);
    }
  }
}
