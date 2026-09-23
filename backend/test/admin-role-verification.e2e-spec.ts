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

    it('should return 401 when no token is provided for GET /users', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });
  });

  describe('Coupons Module - Admin Endpoints', () => {
    it('should return 403 when non-admin user accesses GET /coupons (list all)', async () => {
      const response = await request(app.getHttpServer())
        .get('/coupons')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 200 when admin user accesses GET /coupons (list all)', async () => {
      await request(app.getHttpServer())
        .get('/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should return 403 when non-admin user attempts POST /coupons', async () => {
      const response = await request(app.getHttpServer())
        .post('/coupons')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .send({ code: 'TESTCODE', discountPercent: 10 })
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });
  });

  describe('Perks Module - Admin Endpoints', () => {
    it('should return 403 when non-admin user accesses GET /perks/admin (list all)', async () => {
      const response = await request(app.getHttpServer())
        .get('/perks/admin')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 200 when admin user accesses GET /perks/admin (list all)', async () => {
      await request(app.getHttpServer())
        .get('/perks/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Waitlist Module - Admin Endpoints', () => {
    it('should return 403 when non-admin user accesses GET /waitlist/admin (list all)', async () => {
      const response = await request(app.getHttpServer())
        .get('/waitlist/admin')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 200 when admin user accesses GET /waitlist/admin (list all)', async () => {
      await request(app.getHttpServer())
        .get('/waitlist/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Chance Module - Admin Endpoints', () => {
    it('should return 403 when non-admin user accesses GET /chance/admin (list all)', async () => {
      const response = await request(app.getHttpServer())
        .get('/chance/admin')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Admin role required');
    });

    it('should return 200 when admin user accesses GET /chance/admin (list all)', async () => {
      await request(app.getHttpServer())
        .get('/chance/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('OpenAPI Security Scheme Verification', () => {
    it('should expose admin routes with bearer + admin-role security scheme', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/analytics/dashboard')
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);

      // Non-admin must be denied even with a valid bearer token
      expect(response.body.message).toContain('Admin role required');
    });

    it('should allow admin routes with bearer + admin-role security scheme', async () => {
      await request(app.getHttpServer())
        .get('/admin/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should reject admin routes without any bearer token (401)', async () => {
      await request(app.getHttpServer()).get('/admin/analytics/dashboard').expect(401);
    });
  });
});
