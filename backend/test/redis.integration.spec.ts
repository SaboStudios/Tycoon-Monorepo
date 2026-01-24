import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../src/modules/redis/redis.module';
import { RedisService } from '../src/modules/redis/redis.service';
import { redisConfig } from '../src/config/redis.config';

describe('Redis Integration', () => {
  let service: RedisService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [redisConfig],
          isGlobal: true,
        }),
        RedisModule,
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should set and get cache values', async () => {
    const key = 'test-key';
    const value = { message: 'Hello Redis!' };
    
    await service.set(key, value, 60);
    const result = await service.get(key);
    
    expect(result).toEqual(value);
  });

  it('should handle refresh tokens', async () => {
    const userId = 'test-user-123';
    const token = 'refresh-token-abc';
    
    await service.setRefreshToken(userId, token, 3600);
    const result = await service.getRefreshToken(userId);
    
    expect(result).toBe(token);
    
    await service.deleteRefreshToken(userId);
    const deletedResult = await service.getRefreshToken(userId);
    
    expect(deletedResult).toBeNull();
  });

  it('should handle rate limiting', async () => {
    const key = 'rate-limit-test';
    
    const count1 = await service.incrementRateLimit(key, 60);
    const count2 = await service.incrementRateLimit(key, 60);
    
    expect(count1).toBe(1);
    expect(count2).toBe(2);
  });
});