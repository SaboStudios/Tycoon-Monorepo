import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import * as request from "supertest";
import * as bcrypt from "bcrypt";
import { Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { v4 as uuidv4 } from "uuid";
import { UsersModule } from "../src/users/users.module";
import { AuthModule } from "../src/auth/auth.module";
import { IdempotencyModule } from "../src/idempotency/idempotency.module";
import { User, UserRole, UserStatus } from "../src/users/entities/user.entity";
import { AuditLog } from "../src/users/entities/audit-log.entity";
import { IdempotencyRecord } from "../src/idempotency/idempotency-record.entity";
import { IDEMPOTENCY_KEY_HEADER } from "../src/idempotency/idempotency.interceptor";

describe("Idempotency (e2e)", () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let idempotencyRepo: Repository<IdempotencyRecord>;
  let adminToken: string;
  let testUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "postgres",
          host: process.env.DB_HOST || "localhost",
          port: parseInt(process.env.DB_PORT) || 5432,
          username: process.env.DB_USERNAME || "postgres",
          password: process.env.DB_PASSWORD || "postgres",
          database: process.env.DB_NAME || "test_db",
          entities: [User, AuditLog, IdempotencyRecord],
          synchronize: true,
          dropSchema: true,
        }),
        UsersModule,
        AuthModule,
        IdempotencyModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    userRepo = moduleFixture.get(getRepositoryToken(User));
    idempotencyRepo = moduleFixture.get(getRepositoryToken(IdempotencyRecord));
    const jwtService = moduleFixture.get(JwtService);

    const admin = await userRepo.save(
      userRepo.create({
        email: "admin@test.com",
        password: await bcrypt.hash("admin123", 10),
        firstName: "Admin",
        lastName: "User",
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      }),
    );

    testUser = await userRepo.save(
      userRepo.create({
        email: "user@test.com",
        password: await bcrypt.hash("user123", 10),
        firstName: "Test",
        lastName: "User",
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      }),
    );

    adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });
  });

  afterAll(async () => {
    await idempotencyRepo.delete({});
    await userRepo.delete({});
    await app.close();
  });

  afterEach(async () => {
    // Clear idempotency records between tests for isolation
    await idempotencyRepo.delete({});
  });

  describe("POST /admin/users/:id/reset-password", () => {
    it("replay with same key + same body returns same response (200/201)", async () => {
      const key = uuidv4();
      const body = { newPassword: "Password123!" };

      const first = await request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send(body);

      expect(first.status).toBe(201);
      expect(first.body.message).toBe("Password reset successfully");

      const replay = await request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send(body);

      expect(replay.status).toBe(201);
      expect(replay.body).toEqual(first.body);
    });

    it("replay with same key + different body returns 409", async () => {
      const key = uuidv4();

      await request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send({ newPassword: "Password123!" });

      const conflict = await request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send({ newPassword: "DifferentPass456!" });

      expect(conflict.status).toBe(409);
    });

    it("without Idempotency-Key header proceeds normally each time", async () => {
      const body = { newPassword: "Password123!" };

      const r1 = await request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(body);

      const r2 = await request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(body);

      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
    });

    it("different keys for same endpoint are independent", async () => {
      const body = { newPassword: "Password123!" };

      const r1 = await request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, uuidv4())
        .send(body);

      const r2 = await request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, uuidv4())
        .send(body);

      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
    });
  });

  describe("PATCH /admin/users/:id/role", () => {
    it("replay with same key + same body returns same response", async () => {
      const key = uuidv4();
      const body = { role: UserRole.MODERATOR };

      const first = await request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send(body);

      expect(first.status).toBe(200);

      const replay = await request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send(body);

      expect(replay.status).toBe(200);
      expect(replay.body).toEqual(first.body);
    });

    it("same key + different body returns 409", async () => {
      const key = uuidv4();

      await request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send({ role: UserRole.MODERATOR });

      const conflict = await request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send({ role: UserRole.USER });

      expect(conflict.status).toBe(409);
    });
  });

  describe("PATCH /admin/users/:id/status", () => {
    it("replay with same key + same body returns same response", async () => {
      const key = uuidv4();
      const body = { status: UserStatus.SUSPENDED };

      const first = await request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send(body);

      expect(first.status).toBe(200);

      const replay = await request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send(body);

      expect(replay.status).toBe(200);
      expect(replay.body).toEqual(first.body);
    });

    it("same key + different body returns 409", async () => {
      const key = uuidv4();

      await request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send({ status: UserStatus.SUSPENDED });

      const conflict = await request(app.getHttpServer())
        .patch(`/admin/users/${testUser.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send({ status: UserStatus.ACTIVE });

      expect(conflict.status).toBe(409);
    });
  });

  describe("TTL / expiry", () => {
    it("expired record is treated as fresh (no replay)", async () => {
      const key = uuidv4();
      const body = { newPassword: "Password123!" };

      await request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send(body);

      // Manually expire the record
      await idempotencyRepo.update(
        { id: `POST:/admin/users/${testUser.id}/reset-password:${key}` },
        { expiresAt: new Date(Date.now() - 1000) },
      );

      // Should execute fresh (not replay)
      const fresh = await request(app.getHttpServer())
        .post(`/admin/users/${testUser.id}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set(IDEMPOTENCY_KEY_HEADER, key)
        .send(body);

      expect(fresh.status).toBe(201);
    });
  });
});
