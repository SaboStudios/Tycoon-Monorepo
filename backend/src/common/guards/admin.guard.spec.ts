import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { Role } from '../../modules/auth/enums/role.enum';
import { ForbiddenException } from '@nestjs/common';

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminGuard],
    }).compile();

    guard = module.get<AdminGuard>(AdminGuard);
  });

  it('should allow admin user with role ADMIN', () => {
    const mockRequest = {
      user: { id: 1, role: Role.ADMIN, is_admin: false },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should allow user with is_admin flag true', () => {
    const mockRequest = {
      user: { id: 2, role: Role.USER, is_admin: true },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should deny regular user without admin role or flag', () => {
    const mockRequest = {
      user: { id: 3, role: Role.USER, is_admin: false },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(
      ForbiddenException,
    );
  });

  it('should deny unauthenticated request (no user)', () => {
    const mockRequest = { user: null };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(
      ForbiddenException,
    );
  });

  it('should deny request without user property', () => {
    const mockRequest = {};

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(
      ForbiddenException,
    );
  });
});
