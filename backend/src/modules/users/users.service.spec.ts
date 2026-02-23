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
      const user = { id: '1', is_admin: false, ...createUserDto };
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

      const result = await service.findOne(1);
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException if user not found', async () => {
      repositoryMock.findOne!.mockReturnValue(null);

      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      const user = { id: 1, email: 'test@example.com', is_admin: false };
      repositoryMock.findOne!.mockReturnValue(user);
      repositoryMock.remove!.mockReturnValue(user);

      await service.remove(1);
      expect(repositoryMock.remove).toHaveBeenCalledWith(user);
    });
  });

  describe('updateGameStats', () => {
    let createQueryBuilderSpy: jest.SpyInstance;
    let setSpy: jest.SpyInstance;
    let whereSpy: jest.SpyInstance;
    let setParameterSpy: jest.SpyInstance;
    let executeSpy: jest.SpyInstance;

    beforeEach(() => {
      // Create spies for query builder chain
      executeSpy = jest.fn().mockResolvedValue({});
      setParameterSpy = jest.fn().mockReturnThis();
      whereSpy = jest.fn().mockReturnThis();
      setSpy = jest.fn().mockReturnThis();

      const queryBuilderMock = {
        update: jest.fn().mockReturnThis(),
        set: setSpy,
        where: whereSpy,
        setParameter: setParameterSpy,
        execute: executeSpy,
      };

      createQueryBuilderSpy = repositoryMock.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilderMock);
    });

    it('should increment stats for a win', async () => {
      const userId = 1;
      const amount = 100;
      const earnings = 200;

      await service.updateGameStats(userId, true, amount, earnings);

      expect(createQueryBuilderSpy).toHaveBeenCalled();
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          games_played: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          game_won: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          game_lost: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          total_staked: expect.any(Function),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          total_earned: expect.any(Function),
        }),
      );

      // Verify logic inside set functions
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const setCall = setSpy.mock.calls[0][0] as Record<string, () => string>;
      expect(setCall.games_played()).toBe('games_played + 1');
      expect(setCall.game_won()).toBe('game_won + 1');
      expect(setCall.game_lost()).toBe('game_lost'); // Should not increment
      expect(setCall.total_staked()).toBe('total_staked + :stakedAmount');
      expect(setCall.total_earned()).toBe('total_earned + :earnedAmount');

      expect(whereSpy).toHaveBeenCalledWith('id = :id', { id: userId });
      expect(setParameterSpy).toHaveBeenCalledWith('stakedAmount', amount);
      expect(setParameterSpy).toHaveBeenCalledWith('earnedAmount', earnings);
    });

    it('should increment stats for a loss', async () => {
      const userId = 1;
      const amount = 100;
      const earnings = 0;

      await service.updateGameStats(userId, false, amount, earnings);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const setCall = setSpy.mock.calls[0][0] as Record<string, () => string>;
      expect(setCall.game_won()).toBe('game_won'); // Should not increment
      expect(setCall.game_lost()).toBe('game_lost + 1');
    });
  });
});
