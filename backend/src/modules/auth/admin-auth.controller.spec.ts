import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AuthService } from './auth.service';
import { Role } from './enums/role.enum';
import { AdminLogsService } from '../admin-logs/admin-logs.service';
import { Request } from 'express';

describe('AdminAuthController', () => {
  let controller: AdminAuthController;
  let authService: Partial<AuthService>;
  let adminLogsService: Partial<AdminLogsService>;

  beforeEach(async () => {
    authService = {
      validateAdmin: jest.fn(),
      login: jest.fn(),
    };

    adminLogsService = {
      createLog: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: AdminLogsService,
          useValue: adminLogsService,
        },
      ],
    }).compile();

    controller = module.get<AdminAuthController>(AdminAuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should login admin successfully', async () => {
      const adminLoginDto = {
        email: 'admin@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: 1,
        email: 'admin@example.com',
        role: Role.ADMIN,
        is_admin: true,
      };

      (authService.validateAdmin as jest.Mock).mockResolvedValue(mockUser);
      (authService.login as jest.Mock).mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      const mockRequest = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as unknown as Request;

      const result = await controller.login(adminLoginDto, mockRequest);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
      expect(authService.validateAdmin).toHaveBeenCalledWith(
        adminLoginDto.email,
        adminLoginDto.password,
      );
      expect(authService.login).toHaveBeenCalledWith({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        is_admin: mockUser.is_admin,
      });
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const adminLoginDto = {
        email: 'wrong@example.com',
        password: 'wrongpassword',
      };

      (authService.validateAdmin as jest.Mock).mockResolvedValue(null);

      const mockRequest = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
      } as unknown as Request;

      await expect(
        controller.login(adminLoginDto, mockRequest),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
