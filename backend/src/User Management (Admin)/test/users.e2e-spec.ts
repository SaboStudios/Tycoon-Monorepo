import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { UsersModule } from '../src/users/users.module';
import { AuthModule } from '../src/auth/auth.module';
import { User, UserRole, UserStatus } from '../src/users/entities/user.entity';
import { AuditLog } from '../src/users/entities/audit-log.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

describe('Users Admin (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let auditLogRepository: Repository<AuditLog>;
  let jwtService: JwtService;
  let adminToken: string;
  let testUser: User;
  let adminUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USERNAME || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'test_db',
          entities: [User, AuditLog],
          synchronize: true,
          dropSchema: true,
        }),
        UsersModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    auditLogRepository = moduleFixture.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create admin user
    adminUser = userRepository.create({
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 10),
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    adminUser = await userRepository.save(adminUser);

    // Create test user
    testUser = userRepository.create({
      email: 'test@example.com',
      password: await bcrypt.hash('test123', 10),
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    testUser = await userRepository.save(testUser);

    // Generate admin token
    adminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });
  });

  afterAll(async () => {
    // TypeORM rejects delete({}); use clear(). Guard when beforeAll never completed.
    try {
      if (auditLogRepository && userRepository) {
        await auditLogRepository.clear();
        await userRepository.clear();
      }
    } catch {
      // ignore cleanup failures
    }
    if (app) {
      await app.close();
    }
  });

  describe('/admin/users (GET)', () => {
    it('should return paginated users', () => {
      return request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.meta).toHaveProperty('total');
          expect(res.body.meta).toHaveProperty('page');
          expect(res.body.meta).toHaveProperty('limit');
          expect(res.body.data.length).toBeGreaterThan(0);
        });
    });

    it('should filter users by search term', () => {
      return request(app.getHttpServer())
        .get('/admin/users?search=test')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data.some((u) => u.email.includes('test'))).toBe(
            true,
          );
        });
    });

    it('should filter users by role', () => {
      return request(app.getHttpServer())
        .get(`/admin/users?role=${UserRole.ADMIN}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data.every((u) => u.role === UserRole.ADMIN)).toBe(
            true,
          );
        });
    });

    it('should filter users by status', () => {
      return request(app.getHttpServer())
        .get(`/admin/users?status=${UserStatus.ACTIVE}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(
            res.body.data.every((u) => u.status === UserStatus.ACTIVE),
          ).toBe(true);
        });
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer()).get('/admin/users').expect(401);
    });
  });

  describe('/admin/users/:id (GET)', () => {
    it('should return a single user', () => {
      return request(app.getHttpServer())
        .get(`/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(testUser.id);
          expect(res.body.email).toBe(testUser.email);
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should return 404 for non-existent user', () => {
      return request(app.getHttpServer())
        .get('/admin/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('/admin/users/:id/role (PATCH)', () => {
    it('should update user role', () => {
      return request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: UserRole.MODERATOR })
        .expect(200)
        .expect((res) => {
          expect(res.body.role).toBe(UserRole.MODERATOR);
        });
    });

    it('should create audit log for role change', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: UserRole.USER });

      const logs = await auditLogRepository.find({
        where: { targetUserId: testUser.id },
      });
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid role', () => {
      return request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'invalid_role' })
        .expect(400);
    });
  });

  describe('/admin/users/:id/status (PATCH)', () => {
    it('should suspend user', () => {
      return request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: UserStatus.SUSPENDED })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(UserStatus.SUSPENDED);
        });
    });

    it('should activate user', () => {
      return request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: UserStatus.ACTIVE })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(UserStatus.ACTIVE);
        });
    });

    it('should create audit log for status change', async () => {
      await auditLogRepository.delete({ targetUserId: testUser.id });

      await request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: UserStatus.SUSPENDED });

      const logs = await auditLogRepository.find({
        where: { targetUserId: testUser.id },
      });
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('/admin/users/:id/reset-password (POST)', () => {
    it('should reset user password', () => {
      return request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newPassword: 'newPassword123' })
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toBe('Password reset successfully');
        });
    });

    it('should create audit log for password reset', async () => {
      await auditLogRepository.delete({ targetUserId: testUser.id });

      await request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newPassword: 'anotherPassword123' });

      const logs = await auditLogRepository.find({
        where: { targetUserId: testUser.id },
      });
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should return 400 for short password', () => {
      return request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newPassword: 'short' })
        .expect(400);
    });
  });

  describe('/admin/users/:id/audit-logs (GET)', () => {
    it('should return audit logs for user', async () => {
      // Create some audit logs
      await request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: UserRole.MODERATOR });

      return request(app.getHttpServer())
        .get(`/admin/users/${testUser.id}/audit-logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.meta).toHaveProperty('total');
        });
    });

    it('should paginate audit logs', () => {
      return request(app.getHttpServer())
        .get(`/admin/users/${testUser.id}/audit-logs?page=1&limit=5`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.meta.page).toBe(1);
          expect(res.body.meta.limit).toBe(5);
        });
    });
  });
});
