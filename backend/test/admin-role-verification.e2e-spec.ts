import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

// Modules
import { UsersModule } from '../src/modules/users/users.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AdminAnalyticsModule } from '../src/modules/admin-analytics/admin-analytics.module';
import { AdminLogsModule } from '../src/modules/admin-logs/admin-logs.module';
import { CouponsModule } from '../src/modules/coupons/coupons.module';
import { PerksModule } from '../src/modules/perks/perks.module';
import { WaitlistModule } from '../src/modules/waitlist/waitlist.module';
import { ChanceModule } from '../src/modules/chance/chance.module';

// Entities
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/modules/auth/enums/role.enum';

// Guards and Services
import { RedisRateLimitGuard } from '../src/common/guards/redis-rate-limit.guard';
import { RedisService } from '../src/modules/redis/redis.service';

/**
 * Admin Role Verification Integration Tests
 *
 * This test suite verifies that non-admin users receive 403 Forbidden responses
 * when attempting to access admin-protected endpoints across all modules.
 *
 * Test Coverage:
 * - Admin Analytics Module
 * - Admin Logs Module
 * - Users Module (admin endpoints)
 * - Coupons Module (admin endpoints)
 * - Perks Admin Module
 * - Waitlist Admin Module
 * - Chance Module (admin endpoints)
 */
describe('Admin Role Verification (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let nonAdminToken: string;
  let adminToken: string;
  let nonAdminUser: User;
  let adminUser: User;

  beforeAll(async () => {
    // Mock RedisService
    const mockRedisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(-1),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // Use in-memory SQLite for testing
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          autoLoadEntities: true,
          synchronize: true,
          dropSchema: true,
        }),
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              jwt: {
                secret: 'test-secret-key-for-admin-verification',
                expiresIn: 3600,
              },
              redis: {
                host: 'localhost',
                port: 6379,
              },
            }),
          ],
        }),
        JwtModule.register({
          secret: 'test-secret-key-for-admin-verification',
          signOptions: { expiresIn: '1h' },
        }),
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 100,
          },
        ]),
        UsersModule,
        AuthModule,
        AdminAnalyticsModule,
        AdminLogsModule,
        CouponsModule,
        PerksModule,
        WaitlistModule,
        ChanceModule,
      ],
    })
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideGuard(RedisRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create test users
    await createTestUsers();
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.destroy();
    }
    if (app) {
      await app.close();
    }
  });

  /**
   * Helper function to create test users and generate JWT tokens
   */
  async function createTestUsers() {
    const userRepository = dataSource.getRepository(User);
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create non-admin user
    nonAdminUser = userRepository.create({
      email: 'user@test.com',
      password: hashedPassword,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      role: Role.USER,
      is_admin: false,
    });
    await userRepository.save(nonAdminUser);

    // Create admin user
    adminUser = userRepository.create({
      email: 'admin@test.com',
      password: hashedPassword,
      username: 'adminuser',
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
      is_admin: true,
    });
    await userRepository.save(adminUser);

    // Generate JWT tokens
    nonAdminToken = jwtService.sign({
      sub: nonAdminUser.id,
      email: nonAdminUser.email,
      role: nonAdminUser.role,
      is_admin: nonAdminUser.is_admin,
    });

    adminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      is_admin: adminUser.is_admin,
    });
  }

  describe('Admin Analytics Module', () => {
    it('should return 403 when non-admin user accesses GET /admin/analytics/dashboard', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/analytics/dashboard')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 200 when admin user accesses GET /admin/analytics/dashboard', async () => {
      await request(app.getHttpServer())
        .get('/admin/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Admin Logs Module', () => {
    it('should return 403 when non-admin user accesses GET /admin/logs', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/logs')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 200 when admin user accesses GET /admin/logs', async () => {
      await request(app.getHttpServer())
        .get('/admin/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Users Module - Admin Endpoints', () => {
    it('should return 403 when non-admin user accesses GET /users (list all)', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 200 when admin user accesses GET /users (list all)', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should return 403 when non-admin user attempts PATCH /users/:id', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/users/${nonAdminUser.id}`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({ firstName: 'Updated' })
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 403 when non-admin user attempts DELETE /users/:id', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/users/${nonAdminUser.id}`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 403 when non-admin user attempts POST /users/suspend', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/suspend')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({ userId: nonAdminUser.id, reason: 'Test' })
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });
  });

  describe('Coupons Module - Admin Endpoints', () => {
    it('should return 403 when non-admin user attempts POST /coupons (create)', async () => {
      const response = await request(app.getHttpServer())
        .post('/coupons')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({
          code: 'TEST123',
          discount_type: 'percentage',
          discount_value: 10,
          max_uses: 100,
        })
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 403 when non-admin user attempts PATCH /coupons/:id', async () => {
      const response = await request(app.getHttpServer())
        .patch('/coupons/1')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({ discount_value: 15 })
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 403 when non-admin user attempts DELETE /coupons/:id', async () => {
      const response = await request(app.getHttpServer())
        .delete('/coupons/1')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });
  });

  describe('Perks Admin Module', () => {
    it('should return 403 when non-admin user accesses GET /admin/perks', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/perks')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 200 when admin user accesses GET /admin/perks', async () => {
      await request(app.getHttpServer())
        .get('/admin/perks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should return 403 when non-admin user attempts POST /admin/perks', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/perks')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({
          name: 'Test Perk',
          description: 'Test Description',
          perk_type: 'boost',
        })
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });
  });

  describe('Waitlist Admin Module', () => {
    it('should return 403 when non-admin user accesses GET /admin/waitlist', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/waitlist')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 200 when admin user accesses GET /admin/waitlist', async () => {
      await request(app.getHttpServer())
        .get('/admin/waitlist')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should return 403 when non-admin user attempts POST /admin/waitlist/bulk-import', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/waitlist/bulk-import')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });
  });

  describe('Chance Module - Admin Endpoints', () => {
    it('should return 403 when non-admin user attempts POST /chances (create)', async () => {
      const response = await request(app.getHttpServer())
        .post('/chances')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({
          card_type: 'reward',
          description: 'Test Chance',
          probability: 0.1,
        })
        .expect(403);

      expect(response.body).toHaveProperty('message');
      // RolesGuard throws a different message
      expect(
        response.body.message.includes('role') ||
          response.body.message.includes('Access denied'),
      ).toBe(true);
    });

    it('should allow admin user to POST /chances (create)', async () => {
      // This test verifies admin can create, but may fail due to validation
      // The important part is it doesn't return 403
      const response = await request(app.getHttpServer())
        .post('/chances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          card_type: 'reward',
          description: 'Test Chance',
          probability: 0.1,
        });

      // Should not be 403 Forbidden
      expect(response.status).not.toBe(403);
    });
  });

  describe('Unauthenticated Access', () => {
    it('should return 401 when accessing admin endpoint without token', async () => {
      await request(app.getHttpServer())
        .get('/admin/analytics/dashboard')
        .expect(401);
    });

    it('should return 401 when accessing admin endpoint with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/admin/analytics/dashboard')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Error Message Consistency', () => {
    it('should return consistent error messages for AdminGuard protected routes', async () => {
      const endpoints = [
        '/admin/analytics/dashboard',
        '/admin/logs',
        '/users',
        '/admin/perks',
        '/admin/waitlist',
      ];

      for (const endpoint of endpoints) {
        const response = await request(app.getHttpServer())
          .get(endpoint)
          .set('Authorization', `Bearer ${nonAdminToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Admin role required');
      }
    });
  });
});
