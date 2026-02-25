import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSkin } from './entities/user-skin.entity';
import { Skin } from './entities/skin.entity';

@Injectable()
export class UserSkinsService {
  constructor(
    @InjectRepository(UserSkin)
    private readonly userSkinRepository: Repository<UserSkin>,
    @InjectRepository(Skin)
    private readonly skinRepository: Repository<Skin>,
  ) {}

  /**
   * Get all skins owned by a user.
   */
  async findAllByUserId(userId: number): Promise<UserSkin[]> {
    return this.userSkinRepository.find({
      where: { user_id: userId },
      relations: ['skin'],
      order: { unlocked_at: 'DESC' },
    });
  }

  /**
   * Check if a user owns a specific skin.
   */
  async checkOwnership(userId: number, skinId: number): Promise<boolean> {
    const ownership = await this.userSkinRepository.findOne({
      where: { user_id: userId, skin_id: skinId },
    });
    return !!ownership;
  }

  /**
   * Unlock a skin for a user.
   */
  async unlockSkin(userId: number, skinId: number): Promise<UserSkin> {
    const skin = await this.skinRepository.findOne({ where: { id: skinId } });
    if (!skin) {
      throw new NotFoundException(`Skin with ID ${skinId} not found`);
    }

    const existing = await this.userSkinRepository.findOne({
      where: { user_id: userId, skin_id: skinId },
    });

    if (existing) {
      return existing;
    }

    const userSkin = this.userSkinRepository.create({
      user_id: userId,
      skin_id: skinId,
    });

    return this.userSkinRepository.save(userSkin);
  }
}
