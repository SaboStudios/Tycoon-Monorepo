import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { Role } from '../enums/role.enum';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should validate and return user payload with defaults', async () => {
    const payload = {
      sub: 42,
      email: 'test@example.com',
    };

    const result = strategy.validate(payload);

    expect(result).toEqual({
      sub: 42,
      id: 42,
      email: 'test@example.com',
      role: Role.USER,
      is_admin: false,
    });
  });

  it('should preserve role and is_admin from payload', async () => {
    const payload = {
      sub: 1,
      email: 'admin@example.com',
      role: Role.ADMIN,
      is_admin: true,
    };

    const result = strategy.validate(payload);

    expect(result.role).toBe(Role.ADMIN);
    expect(result.is_admin).toBe(true);
  });
});
