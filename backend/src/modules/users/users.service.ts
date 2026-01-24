import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationService, PaginationDto, PaginatedResponse } from '../../common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly paginationService: PaginationService,
    private readonly redisService: RedisService,
  ) { }

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(createUserDto);
    const savedUser = await this.userRepository.save(user);
    
    // Invalidate users list cache
    await this.invalidateUsersCache();
    
    return savedUser;
  }

  /**
   * Get all users with pagination, sorting, and filtering
   */
  async findAll(paginationDto: PaginationDto): Promise<PaginatedResponse<User>> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');
    const searchableFields = ['email', 'firstName', 'lastName'];
    return await this.paginationService.paginate(queryBuilder, paginationDto, searchableFields);
  }

  /**
   * Get a single user by ID
   */
  async findOne(id: string): Promise<User> {
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
   * Update a user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
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
  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
    
    // Invalidate cache for this user and users list
    await this.invalidateUserCache(id);
    await this.invalidateUsersCache();
  }

  /**
   * Invalidate cache for a specific user
   */
  private async invalidateUserCache(userId: string): Promise<void> {
    await this.redisService.del(`cache:GET:/api/v1/users/${userId}:*`);
  }

  /**
   * Invalidate cache for users list
   */
  private async invalidateUsersCache(): Promise<void> {
    await this.redisService.del('cache:GET:/api/v1/users:*');
  }
}
