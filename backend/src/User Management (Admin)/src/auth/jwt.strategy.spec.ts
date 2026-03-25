import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should validate and return user payload', async () => {
    const payload = {
      sub: 'user-id',
      email: 'test@example.com',
      role: 'admin',
    };

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      userId: 'user-id',
      email: 'test@example.com',
      role: 'admin',
    });
  });
});
