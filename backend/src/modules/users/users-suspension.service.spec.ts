import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserSuspension } from './entities/user-suspension.entity';
import { PaginationService } from '../../common/services/pagination.service';
import { RedisService } from '../redis/redis.service';
import { AdminLogsService } from '../admin-logs/admin-logs.service';

describe('UsersService - Suspension', () => {
  let service: UsersService;
  let userRepo: Repository<User>;
  let suspensionRepo: Repository<UserSuspension>;
  let adminLogsService: AdminLogsService;

  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockSuspensionRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  };

  const mockAdminLogsService = {
    createLog: jest.fn(),
  };

  const mockRedisService = {
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(UserSuspension),
          useValue: mockSuspensionRepo,
        },
        {
          provide: PaginationService,
          useValue: {},
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: AdminLogsService,
          useValue: mockAdminLogsService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    suspensionRepo = module.get<Repository<UserSuspension>>(
      getRepositoryToken(UserSuspension),
    );
    adminLogsService = module.get<AdminLogsService>(AdminLogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('suspendUser', () => {
    it('should suspend a user successfully', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        is_suspended: false,
      };

      const dto = { userId: 1, reason: 'Suspicious activity' };
      const adminId = 2;

      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockUserRepo.save.mockResolvedValue({ ...mockUser, is_suspended: true });
      mockSuspensionRepo.create.mockReturnValue({
        userId: 1,
        suspendedBy: adminId,
        reason: dto.reason,
        isActive: true,
      });
      mockSuspensionRepo.save.mockResolvedValue({});

      await service.suspendUser(dto, adminId);

      expect(userRepo.save).toHaveBeenCalledWith({
        ...mockUser,
        is_suspended: true,
      });
      expect(suspensionRepo.save).toHaveBeenCalled();
      expect(adminLogsService.createLog).toHaveBeenCalledWith(
        adminId,
        'USER_SUSPENDED',
        1,
        { reason: dto.reason },
        undefined,
      );
    });
  });

  describe('unsuspendUser', () => {
    it('should unsuspend a user successfully', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        is_suspended: true,
      };

      const dto = { userId: 1 };
      const adminId = 2;

      mockUserRepo.findOne.mockResolvedValue(mockUser);
      mockUserRepo.save.mockResolvedValue({
        ...mockUser,
        is_suspended: false,
      });
      mockSuspensionRepo.update.mockResolvedValue({});

      await service.unsuspendUser(dto, adminId);

      expect(userRepo.save).toHaveBeenCalledWith({
        ...mockUser,
        is_suspended: false,
      });
      expect(suspensionRepo.update).toHaveBeenCalled();
      expect(adminLogsService.createLog).toHaveBeenCalledWith(
        adminId,
        'USER_UNSUSPENDED',
        1,
        undefined,
        undefined,
      );
    });
  });

  describe('getSuspensionHistory', () => {
    it('should return suspension history for a user', async () => {
      const mockHistory = [
        {
          id: 1,
          userId: 1,
          suspendedBy: 2,
          reason: 'Test reason',
          isActive: false,
          suspendedAt: new Date(),
          unsuspendedAt: new Date(),
        },
      ];

      mockSuspensionRepo.find.mockResolvedValue(mockHistory);

      const result = await service.getSuspensionHistory(1);

      expect(result).toEqual(mockHistory);
      expect(suspensionRepo.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        relations: ['admin'],
        order: { suspendedAt: 'DESC' },
      });
    });
  });
});
