import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import { ShopModule } from './shop.module';
import { ShopService } from './shop.service';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../../common/logger/logger.service';
import { ShopItem } from './entities/shop-item.entity';
import { databaseConfig } from '../../config/database.config';
import { redisConfig } from '../../config/redis.config';
import { CacheInterceptor } from '../../common/interceptors/cache.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

/**
 * Integration test for shop catalog cache invalidation via key versioning.
 *
 * Demonstrates that when an admin updates/creates/deletes an item,
 * the catalog cache is properly invalidated through version bumping,
 * and subsequent reads return the updated data, not stale cached data.
 */
describe('Shop Catalog Cache Invalidation via Versioning (Issue #1443)', () => {
  let app: INestApplication;
  let shopService: ShopService;
  let redisService: RedisService;
  let shopRepository: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [databaseConfig, redisConfig],
          envFilePath: '.env',
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const dbConfig = configService.get('database') as Record<
              string,
              unknown
            >;
            return dbConfig;
          },
        }),
        CacheModule.registerAsync({
          isGlobal: true,
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => {
            const redisConfig = configService.get<{
              host: string;
              port: number;
              password?: string;
              db: number;
            }>('redis');
            return {
              store: await redisStore({
                host: redisConfig.host,
                port: redisConfig.port,
                password: redisConfig.password,
                db: redisConfig.db,
              }),
              ttl: 300,
            };
          },
        }),
        ShopModule,
      ],
      providers: [
        LoggerService,
        {
          provide: APP_INTERCEPTOR,
          useClass: CacheInterceptor,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    shopService = moduleFixture.get<ShopService>(ShopService);
    redisService = moduleFixture.get<RedisService>(RedisService);
    shopRepository = moduleFixture.get('ShopItemRepository');
  });

  afterAll(async () => {
    // Clear Redis cache after tests
    await redisService.reset();
    await app.close();
  });

  it('should cache the shop catalog list on first GET', async () => {
    // Create a test item
    const item = await shopService.create({
      name: 'Cache Test Item 1',
      description: 'Test item for cache invalidation',
      type: 'cosmetic',
      price: 99.99,
      currency: 'USD',
      rarity: 'common',
    });

    // Call findAll to populate cache
    const result1 = await shopService.findAll({ active: true });
    expect(result1.data.some((i: any) => i.id === item.id)).toBe(true);

    // Verify that a cache entry was created by checking Redis
    // Cache key format: cache:GET:/api/v1/shop/items:userId:queryParams
    const cacheKeys = await redisService.scanPage('cache:GET*', 0, 100);
    expect(cacheKeys.keys.length).toBeGreaterThan(0);
  });

  it('should invalidate catalog cache when admin updates a shop item (versioning)', async () => {
    // 1. Create a test item
    const item = await shopService.create({
      name: 'Cache Test Item 2',
      description: 'Original description',
      type: 'cosmetic',
      price: 50.0,
      currency: 'USD',
      rarity: 'common',
    });

    // 2. Read the catalog (populates cache)
    const beforeUpdate = await shopService.findAll({ active: true });
    const cachedItem = beforeUpdate.data.find((i: any) => i.id === item.id);
    expect(cachedItem).toBeDefined();
    expect(cachedItem.price).toBe('50.00');

    // 3. Admin updates the item price
    const updatedItem = await shopService.update(item.id, {
      price: 150.0,
      description: 'Updated description',
    });
    expect(updatedItem.price).toBe('150.00');

    // 4. Read the catalog again without TTL expiry
    // With cache versioning, this should NOT return the stale cached data
    const afterUpdate = await shopService.findAll({ active: true });
    const freshItem = afterUpdate.data.find((i: any) => i.id === item.id);
    expect(freshItem).toBeDefined();
    expect(freshItem.price).toBe('150.00');
    expect(freshItem.description).toBe('Updated description');
  });

  it('should invalidate catalog cache when admin deactivates a shop item', async () => {
    // 1. Create and cache a test item
    const item = await shopService.create({
      name: 'Active Item',
      description: 'Initially active',
      type: 'cosmetic',
      price: 25.0,
      currency: 'USD',
      rarity: 'common',
      active: true,
    });

    // 2. Read the catalog (populates cache)
    const beforeRemove = await shopService.findAll({ active: true });
    expect(beforeRemove.data.some((i: any) => i.id === item.id)).toBe(true);

    // 3. Admin deactivates the item
    const deactivated = await shopService.remove(item.id);
    expect(deactivated.active).toBe(false);

    // 4. Read catalog again — item should not appear in active list
    const afterRemove = await shopService.findAll({ active: true });
    expect(afterRemove.data.some((i: any) => i.id === item.id)).toBe(false);
  });

  it('should invalidate catalog cache on bulk update', async () => {
    // 1. Create multiple test items
    const item1 = await shopService.create({
      name: 'Bulk Update Test 1',
      description: 'Item 1',
      type: 'cosmetic',
      price: 10.0,
      currency: 'USD',
      rarity: 'common',
    });

    const item2 = await shopService.create({
      name: 'Bulk Update Test 2',
      description: 'Item 2',
      type: 'cosmetic',
      price: 20.0,
      currency: 'USD',
      rarity: 'common',
    });

    // 2. Read the catalog (populates cache)
    const beforeBulk = await shopService.findAll({ active: true });
    const cachedItem1 = beforeBulk.data.find((i: any) => i.id === item1.id);
    expect(cachedItem1.price).toBe('10.00');

    // 3. Bulk update prices
    await shopService.bulkUpdate([
      { id: item1.id, price: 30.0 },
      { id: item2.id, price: 40.0 },
    ]);

    // 4. Read catalog again — should see updated prices, not stale cache
    const afterBulk = await shopService.findAll({ active: true });
    const freshItem1 = afterBulk.data.find((i: any) => i.id === item1.id);
    const freshItem2 = afterBulk.data.find((i: any) => i.id === item2.id);
    expect(freshItem1.price).toBe('30.00');
    expect(freshItem2.price).toBe('40.00');
  });
});
