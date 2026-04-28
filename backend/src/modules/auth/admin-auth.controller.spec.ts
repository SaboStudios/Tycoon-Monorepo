import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AuthService } from './auth.service';
import { Role } from './enums/role.enum';
import { AdminLogsService } from '../admin-logs/admin-logs.service';
import { AuthAuditService } from './audit/auth-audit.service';
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
    const mockRequest = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest-agent' },
    } as unknown as Request;

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

      const result = await controller.login(adminLoginDto, mockRequest);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    });

    it('passes ip and userAgent to validateAdmin', async () => {
      const adminLoginDto = { email: 'admin@example.com', password: 'pw' };
      const mockUser = { id: 1, email: 'admin@example.com', role: Role.ADMIN, is_admin: true };
      (authService.validateAdmin as jest.Mock).mockResolvedValue(mockUser);
      (authService.login as jest.Mock).mockResolvedValue({});

      await controller.login(adminLoginDto, mockRequest);

      expect(authService.validateAdmin).toHaveBeenCalledWith(
        adminLoginDto.email,
        adminLoginDto.password,
        '127.0.0.1',
        'jest-agent',
      );
    });

    it('passes ip and userAgent to login', async () => {
      const adminLoginDto = { email: 'admin@example.com', password: 'pw' };
      const mockUser = { id: 1, email: 'admin@example.com', role: Role.ADMIN, is_admin: true };
      (authService.validateAdmin as jest.Mock).mockResolvedValue(mockUser);
      (authService.login as jest.Mock).mockResolvedValue({});

      await controller.login(adminLoginDto, mockRequest);

      expect(authService.login).toHaveBeenCalledWith(
        { id: mockUser.id, email: mockUser.email, role: mockUser.role, is_admin: mockUser.is_admin },
        '127.0.0.1',
        'jest-agent',
      );
    });

    it('logs a redacted email, not the raw email', async () => {
      const adminLoginDto = { email: 'admin@example.com', password: 'pw' };
      const mockUser = { id: 1, email: 'admin@example.com', role: Role.ADMIN, is_admin: true };
      (authService.validateAdmin as jest.Mock).mockResolvedValue(mockUser);
      (authService.login as jest.Mock).mockResolvedValue({});

      await controller.login(adminLoginDto, mockRequest);

      // The admin log should contain the redacted form, not the raw email
      const redacted = AuthAuditService.redactEmail('admin@example.com');
      expect(adminLogsService.createLog).toHaveBeenCalledWith(
        mockUser.id,
        'ADMIN_LOGIN_SUCCESS',
        mockUser.id,
        { email: redacted },
        mockRequest,
      );
    });

    it('logs redacted email on failed login', async () => {
      const adminLoginDto = { email: 'admin@example.com', password: 'wrong' };
      (authService.validateAdmin as jest.Mock).mockResolvedValue(null);

      await expect(controller.login(adminLoginDto, mockRequest)).rejects.toThrow(
        UnauthorizedException,
      );

      const redacted = AuthAuditService.redactEmail('admin@example.com');
      expect(adminLogsService.createLog).toHaveBeenCalledWith(
        undefined,
        'ADMIN_LOGIN_FAILED',
        undefined,
        { email: redacted },
        mockRequest,
      );
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const adminLoginDto = {
        email: 'wrong@example.com',
        password: 'wrongpassword',
      };

      (authService.validateAdmin as jest.Mock).mockResolvedValue(null);

      await expect(
        controller.login(adminLoginDto, mockRequest),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
