import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import {
  repositoryMockFactory,
  MockType,
} from '../../../test/mocks/database.mock';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { PaginationService } from '../../common/services/pagination.service';
import { RedisService } from '../redis/redis.service';

describe('UsersService', () => {
  let service: UsersService;
  let repositoryMock: MockType<Repository<User>>;

  const mockPaginationService = {
    paginate: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    deleteByPattern: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useFactory: repositoryMockFactory,
        },
        {
          provide: PaginationService,
          useValue: mockPaginationService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repositoryMock = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
      };
      const user = { id: '1', ...createUserDto };
      repositoryMock.create!.mockReturnValue(user);
      repositoryMock.save!.mockReturnValue(user);

      const result = await service.create(createUserDto);
      expect(result).toEqual(user);
      expect(repositoryMock.save).toHaveBeenCalledWith(user);
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const paginatedResponse = {
        data: [{ id: '1', email: 'test@example.com' }],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 1,
          totalPages: 1,
        },
      };
      mockPaginationService.paginate.mockResolvedValue(paginatedResponse);
      repositoryMock.createQueryBuilder = jest.fn().mockReturnValue({});

      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result).toEqual(paginatedResponse);
      expect(mockPaginationService.paginate).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a user if found', async () => {
      const user = { id: '1', email: 'test@example.com' };
      repositoryMock.findOne!.mockReturnValue(user);

      const result = await service.findOne('1');
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException if user not found', async () => {
      repositoryMock.findOne!.mockReturnValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      const user = { id: '1', email: 'test@example.com' };
      repositoryMock.findOne!.mockReturnValue(user);
      repositoryMock.remove!.mockReturnValue(user);

      await service.remove('1');
      expect(repositoryMock.remove).toHaveBeenCalledWith(user);
    });
  });
});
