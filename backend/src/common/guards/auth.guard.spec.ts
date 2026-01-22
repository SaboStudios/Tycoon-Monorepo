import { AuthGuard } from './auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('AuthGuard', () => {
    let guard: AuthGuard;

    beforeEach(() => {
        guard = new AuthGuard();
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    it('should return true if authorization header is valid', () => {
        const mockContext = {
            switchToHttp: () => ({
                getRequest: () => ({
                    headers: {
                        authorization: 'Bearer secret-token',
                    },
                }),
            }),
        } as unknown as ExecutionContext;

        expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should throw UnauthorizedException if no authorization header', () => {
        const mockContext = {
            switchToHttp: () => ({
                getRequest: () => ({
                    headers: {},
                }),
            }),
        } as unknown as ExecutionContext;

        expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token is invalid', () => {
        const mockContext = {
            switchToHttp: () => ({
                getRequest: () => ({
                    headers: {
                        authorization: 'Bearer invalid-token',
                    },
                }),
            }),
        } as unknown as ExecutionContext;

        expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });
});
