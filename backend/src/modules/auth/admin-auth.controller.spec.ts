import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuthController } from './admin-auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { AdminLoginDto } from './dto/admin-login.dto';

describe('AdminAuthController', () => {
  let controller: AdminAuthController;
  let authService: AuthService;

  const mockAuthService = {
    validateAdmin: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AdminAuthController>(AdminAuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    const adminLoginDto: AdminLoginDto = {
      email: 'admin@example.com',
      password: 'password123',
    };

    it('should return tokens on successful login', async () => {
      const mockUser = {
        id: 1,
        email: 'admin@example.com',
        role: 'admin',
        is_admin: true,
      };
      const mockTokens = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      };

      mockAuthService.validateAdmin.mockResolvedValue(mockUser);
      mockAuthService.login.mockResolvedValue(mockTokens);

      const result = await controller.login(adminLoginDto);

      expect(result).toEqual(mockTokens);
      expect(authService.validateAdmin).toHaveBeenCalledWith(
        adminLoginDto.email,
        adminLoginDto.password,
      );
      expect(authService.login).toHaveBeenCalledWith({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      mockAuthService.validateAdmin.mockResolvedValue(null);

      await expect(controller.login(adminLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authService.validateAdmin).toHaveBeenCalledWith(
        adminLoginDto.email,
        adminLoginDto.password,
      );
    });
  });
});
