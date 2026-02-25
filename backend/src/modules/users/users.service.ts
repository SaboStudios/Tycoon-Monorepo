import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import {
  PaginationService,
  PaginationDto,
  PaginatedResponse,
} from '../../common';
import { RedisService } from '../redis/redis.service';
import { AdminLogsService } from '../admin-logs/admin-logs.service';
import { Request } from 'express';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly paginationService: PaginationService,
    private readonly redisService: RedisService,
    private readonly adminLogsService: AdminLogsService,
  ) {}

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user entity with mapped fields
    const user = this.userRepository.create({
      email: createUserDto.email,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);

    // Invalidate users list cache
    await this.invalidateUsersCache();

    return savedUser;
  }

  /**
   * Get all users with pagination, sorting, and filtering
   */
  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<User>> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');
    const searchableFields = ['email', 'firstName', 'lastName'];
    return await this.paginationService.paginate(
      queryBuilder,
      paginationDto,
      searchableFields,
    );
  }

  /**
   * Get a single user by ID
   */
  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  /**
   * Get a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  /**
   * Get user profile with aggregated gameplay statistics
   * Returns only non-sensitive data for authenticated users
   */
  async getProfile(userId: number): Promise<UserProfileDto> {
    const user = await this.findOne(userId);

    return {
      username: user.username,
      games_played: user.games_played,
      game_won: user.game_won,
      game_lost: user.game_lost,
      total_staked: user.total_staked,
      total_earned: user.total_earned,
      total_withdrawn: user.total_withdrawn,
      is_admin: user.is_admin,
    };
  }

  /**
   * Update a user
   */
  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    adminId?: number,
    req?: Request,
  ): Promise<User> {
    const user = await this.findOne(id);

    // Track changes for audit log if performed by an admin
    if (adminId) {
      if (
        updateUserDto.role !== undefined &&
        updateUserDto.role !== user.role
      ) {
        await this.adminLogsService.createLog(
          adminId,
          'USER_ROLE_CHANGE',
          id,
          { from: user.role, to: updateUserDto.role },
          req,
        );
      }
      if (
        updateUserDto.is_admin !== undefined &&
        updateUserDto.is_admin !== user.is_admin
      ) {
        await this.adminLogsService.createLog(
          adminId,
          'USER_ADMIN_STATUS_CHANGE',
          id,
          { from: user.is_admin, to: updateUserDto.is_admin },
          req,
        );
      }
      if (
        updateUserDto.is_suspended !== undefined &&
        updateUserDto.is_suspended !== user.is_suspended
      ) {
        await this.adminLogsService.createLog(
          adminId,
          updateUserDto.is_suspended ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED',
          id,
          undefined,
          req,
        );
      }

      // Generic modification log if nothing specific was logged but something changed
      // (Simplified: we already logged the most important ones as per requirement)
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    // Invalidate cache for this user and users list
    await this.invalidateUserCache(id);
    await this.invalidateUsersCache();

    return updatedUser;
  }

  /**
   * Delete a user
   */
  async remove(id: number, adminId?: number, req?: Request): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);

    if (adminId) {
      await this.adminLogsService.createLog(
        adminId,
        'USER_DELETED',
        id,
        { email: user.email },
        req,
      );
    }

    // Invalidate cache for this user and users list
    await this.invalidateUserCache(id);
    await this.invalidateUsersCache();
  }

  /**
   * Invalidate cache for a specific user
   */
  private async invalidateUserCache(userId: number): Promise<void> {
    await this.redisService.del(`cache:GET:/api/v1/users/${userId}:*`);
  }

  /**
   * Invalidate cache for users list
   */
  private async invalidateUsersCache(): Promise<void> {
    await this.redisService.del('cache:GET:/api/v1/users:*');
  }

  /**
   * Update user game statistics atomically
   */
  async updateGameStats(
    userId: number,
    isWin: boolean,
    stakedAmount: number,
    earnedAmount: number,
  ): Promise<void> {
    const queryBuilder = this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        games_played: () => 'games_played + 1',
        game_won: () => (isWin ? 'game_won + 1' : 'game_won'),
        game_lost: () => (!isWin ? 'game_lost + 1' : 'game_lost'),
        total_staked: () => `total_staked + :stakedAmount`,
        total_earned: () => `total_earned + :earnedAmount`,
      })
      .where('id = :id', { id: userId })
      .setParameter('stakedAmount', stakedAmount)
      .setParameter('earnedAmount', earnedAmount);

    await queryBuilder.execute();

    // Invalidate cache for this user and users list
    await this.invalidateUserCache(userId);
    await this.invalidateUsersCache();
  }
}
