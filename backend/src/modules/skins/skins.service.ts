import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skin } from './entities/skin.entity';
import { CreateSkinDto } from './dto/create-skin.dto';
import { UpdateSkinDto } from './dto/update-skin.dto';
import { SkinCategory } from './enums/skin-category.enum';
import { SkinRarity } from './enums/skin-rarity.enum';

@Injectable()
export class SkinsService {
  constructor(
    @InjectRepository(Skin)
    private readonly skinRepository: Repository<Skin>,
  ) {}

  async create(createSkinDto: CreateSkinDto): Promise<Skin> {
    const skin = this.skinRepository.create(createSkinDto);
    return await this.skinRepository.save(skin);
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
    return await this.skinRepository.save(updatedSkin);
  }

  async remove(id: number): Promise<void> {
    const skin = await this.findOne(id);
    await this.skinRepository.remove(skin);
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
}
