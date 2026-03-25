import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole, UserStatus } from './entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateRole: jest.fn(),
    updateStatus: jest.fn(),
    resetPassword: jest.fn(),
    getAuditLogs: jest.fn(),
  };

  const mockRequest = {
    user: {
      userId: 'admin-id',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const result = {
        data: [{ id: '1', email: 'test@example.com' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockUsersService.findAll.mockResolvedValue(result);

      expect(await controller.findAll({ page: 1, limit: 10 })).toBe(result);
    });
  });

  describe('findOne', () => {
    it('should return a single user', async () => {
      const result = { id: '1', email: 'test@example.com' };
      mockUsersService.findOne.mockResolvedValue(result);

      expect(await controller.findOne('1')).toBe(result);
    });
  });

  describe('updateRole', () => {
    it('should update user role', async () => {
      const result = { id: '1', role: UserRole.ADMIN };
      mockUsersService.updateRole.mockResolvedValue(result);

      expect(
        await controller.updateRole('1', { role: UserRole.ADMIN }, mockRequest),
      ).toBe(result);
      expect(mockUsersService.updateRole).toHaveBeenCalledWith(
        '1',
        { role: UserRole.ADMIN },
        'admin-id',
      );
    });
  });

  describe('updateStatus', () => {
    it('should update user status', async () => {
      const result = { id: '1', status: UserStatus.SUSPENDED };
      mockUsersService.updateStatus.mockResolvedValue(result);

      expect(
        await controller.updateStatus(
          '1',
          { status: UserStatus.SUSPENDED },
          mockRequest,
        ),
      ).toBe(result);
      expect(mockUsersService.updateStatus).toHaveBeenCalledWith(
        '1',
        { status: UserStatus.SUSPENDED },
        'admin-id',
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset user password', async () => {
      const result = { message: 'Password reset successfully' };
      mockUsersService.resetPassword.mockResolvedValue(result);

      expect(
        await controller.resetPassword(
          '1',
          { newPassword: 'newPass123' },
          mockRequest,
        ),
      ).toBe(result);
      expect(mockUsersService.resetPassword).toHaveBeenCalledWith(
        '1',
        { newPassword: 'newPass123' },
        'admin-id',
      );
    });
  });

  describe('getAuditLogs', () => {
    it('should return audit logs for a user', async () => {
      const result = {
        data: [{ id: 'log-1', action: 'role_changed' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockUsersService.getAuditLogs.mockResolvedValue(result);

      expect(await controller.getAuditLogs('1', 1, 10)).toBe(result);
    });
  });
});
