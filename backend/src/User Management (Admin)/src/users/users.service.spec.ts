import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { AuditLog, AuditAction } from './entities/audit-log.entity';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: Repository<User>;
  let auditLogRepository: Repository<AuditLog>;

  const mockUser: User = {
    id: '123',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    auditLogRepository = module.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const users = [mockUser];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([users, 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.data[0]).not.toHaveProperty('password');
    });

    it('should filter by search term', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockUser], 1]);

      await service.findAll({ page: 1, limit: 10, search: 'john' });

      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });

    it('should filter by role', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockUser], 1]);

      await service.findAll({ page: 1, limit: 10, role: UserRole.ADMIN });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.role = :role',
        { role: UserRole.ADMIN },
      );
    });

    it('should filter by status', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockUser], 1]);

      await service.findAll({
        page: 1,
        limit: 10,
        status: UserStatus.SUSPENDED,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.status = :status',
        { status: UserStatus.SUSPENDED },
      );
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(mockUser);

      const result = await service.findOne('123');

      expect(result).toBeDefined();
      expect(result.id).toBe('123');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRole', () => {
    it('should update user role and create audit log', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(mockUser);
      jest
        .spyOn(usersRepository, 'save')
        .mockResolvedValue({ ...mockUser, role: UserRole.ADMIN });
      jest.spyOn(auditLogRepository, 'create').mockReturnValue({} as AuditLog);
      jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as AuditLog);

      const result = await service.updateRole(
        '123',
        { role: UserRole.ADMIN },
        'admin-id',
      );

      expect(result.role).toBe(UserRole.ADMIN);
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ROLE_CHANGED,
          targetUserId: '123',
          performedById: 'admin-id',
        }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateRole('999', { role: UserRole.ADMIN }, 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should suspend user and create audit log', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(mockUser);
      jest
        .spyOn(usersRepository, 'save')
        .mockResolvedValue({ ...mockUser, status: UserStatus.SUSPENDED });
      jest.spyOn(auditLogRepository, 'create').mockReturnValue({} as AuditLog);
      jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as AuditLog);

      const result = await service.updateStatus(
        '123',
        { status: UserStatus.SUSPENDED },
        'admin-id',
      );

      expect(result.status).toBe(UserStatus.SUSPENDED);
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_SUSPENDED,
        }),
      );
    });

    it('should activate user and create audit log', async () => {
      const suspendedUser = { ...mockUser, status: UserStatus.SUSPENDED };
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(suspendedUser);
      jest
        .spyOn(usersRepository, 'save')
        .mockResolvedValue({ ...suspendedUser, status: UserStatus.ACTIVE });
      jest.spyOn(auditLogRepository, 'create').mockReturnValue({} as AuditLog);
      jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as AuditLog);

      const result = await service.updateStatus(
        '123',
        { status: UserStatus.ACTIVE },
        'admin-id',
      );

      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_ACTIVATED,
        }),
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset user password and create audit log', async () => {
      jest.spyOn(usersRepository, 'findOne').mockResolvedValue(mockUser);
      jest.spyOn(usersRepository, 'save').mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      jest.spyOn(auditLogRepository, 'create').mockReturnValue({} as AuditLog);
      jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as AuditLog);

      const result = await service.resetPassword(
        '123',
        { newPassword: 'newPassword123' },
        'admin-id',
      );

      expect(result.message).toBe('Password reset successfully');
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.PASSWORD_RESET,
        }),
      );
    });
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const mockAuditLog = {
        id: 'log-1',
        action: AuditAction.ROLE_CHANGED,
        targetUserId: '123',
        targetUser: mockUser,
        performedById: 'admin-id',
        performedBy: {
          ...mockUser,
          id: 'admin-id',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          role: UserRole.ADMIN,
        },
        metadata: { oldRole: UserRole.USER, newRole: UserRole.ADMIN },
        createdAt: new Date(),
      };

      jest
        .spyOn(auditLogRepository, 'findAndCount')
        .mockResolvedValue([[mockAuditLog], 1]);

      const result = await service.getAuditLogs('123', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0].action).toBe(AuditAction.ROLE_CHANGED);
    });
  });
});
