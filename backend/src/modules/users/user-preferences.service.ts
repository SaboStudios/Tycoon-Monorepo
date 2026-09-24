import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { UserPreference } from './entities/user-preference.entity';
import { UpdateUserPreferenceDto } from './dto/update-user-preference.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserPreferencesService {
  constructor(
    @InjectRepository(UserPreference)
    private readonly preferenceRepository: Repository<UserPreference>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  private getCacheKey(userId: number): string {
    return `user-preferences-${userId}`;
  }

  /**
   * Retrieves user preferences, using cache for high throughput during game sessions.
   * If they don't exist, we return a default structure without saving it to avoid database bloat.
   */
  async getPreferences(userId: number): Promise<UserPreference> {
    const cacheKey = this.getCacheKey(userId);
    const cached = await this.cacheManager.get<UserPreference>(cacheKey);

    if (cached) {
      return cached;
    }

    let pref = await this.preferenceRepository.findOne({
      where: { user_id: userId },
      relations: ['boardStyle'],
    });

    if (!pref) {
      // Return a default set of preferences in memory
      pref = this.preferenceRepository.create({
        user_id: userId,
        settings: {
          soundEnabled: true,
          animationSpeed: 'normal',
        },
      });
    }

    await this.cacheManager.set(cacheKey, pref, 3600); // 1-hour cache
    return pref;
  }

  /**
   * Updates user preferences and invalidates cache.
   */
  async updatePreferences(
    userId: number,
    dto: UpdateUserPreferenceDto,
  ): Promise<UserPreference> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    let pref = await this.preferenceRepository.findOne({
      where: { user_id: userId },
    });

    if (!pref) {
      pref = this.preferenceRepository.create({
        user_id: userId,
        board_style_id: dto.board_style_id,
        settings: dto.settings || {},
      });
    } else {
      if (dto.board_style_id !== undefined) {
        pref.board_style_id = dto.board_style_id;
      }
      if (dto.settings !== undefined) {
        // Deep merge the JSON settings
        pref.settings = { ...pref.settings, ...dto.settings };
      }
    }

    const saved = await this.preferenceRepository.save(pref);

    // Invalidate Cache
    await this.cacheManager.del(this.getCacheKey(userId));

    // Refresh with relationships for the response
    return this.getPreferences(userId);
  }
}
