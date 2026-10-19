import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ApiKeyAuthGuard } from './api-key.guard';

describe('ApiKeyAuthGuard', () => {
  const originalApiKey = process.env.API_KEY;
  const originalJwtSecret = process.env.JWT_SECRET;

  let guard: ApiKeyAuthGuard;
  let jwtService: JwtService;
  let reflector: Reflector;

  const buildContext = (headers: Record<string, string>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    delete process.env.API_KEY;
    delete process.env.JWT_SECRET;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ApiKeyAuthGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn().mockReturnValue(false) },
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    guard = moduleRef.get(ApiKeyAuthGuard);
    jwtService = moduleRef.get(JwtService);
    reflector = moduleRef.get(Reflector);
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalApiKey;
    }
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
    jest.restoreAllMocks();
  });

  it('allows the request when a valid API key is provided', async () => {
    process.env.API_KEY = 'valid-api-key';

    const context = buildContext({ 'x-api-key': 'valid-api-key' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalled();
  });

  it('rejects the request when the API key is missing', async () => {
    process.env.API_KEY = 'valid-api-key';

    const context = buildContext({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects the request when the API key is invalid', async () => {
    process.env.API_KEY = 'valid-api-key';

    const context = buildContext({ 'x-api-key': 'wrong-api-key' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('skips JWT verification when JWT_SECRET is unset', async () => {
    const verifySpy = jest.spyOn(jwtService, 'verifyAsync');

    const context = buildContext({ authorization: 'Bearer some.jwt.token' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('verifies a JWT when JWT_SECRET is configured', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const verifySpy = jest
      .spyOn(jwtService, 'verifyAsync')
      .mockResolvedValue({ sub: 'user-1' });

    const context = buildContext({ authorization: 'Bearer some.jwt.token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifySpy).toHaveBeenCalledWith('some.jwt.token', {
      secret: 'test-secret',
    });
  });
});
